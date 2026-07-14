/**
 * The race check: fires 25 concurrent hold attempts at the same listing for
 * the same dates and proves that exactly one wins, no matter the timing.
 * The guarantee comes from the database's exclusion constraint, not from
 * application code, so there is no interleaving that can break it.
 *
 *   pnpm race
 *
 * Cleans up after itself, so it can run any number of times.
 */
import "dotenv/config";
import { Pool } from "pg";
import { createHold, DatesUnavailableError } from "../src/lib/repo/bookings";

const ATTEMPTS = 25;
const CHECK_IN = "2027-05-10";
const CHECK_OUT = "2027-05-15";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: ATTEMPTS });
  const runId = Date.now().toString(36);

  const { rows } = await pool.query(
    "SELECT slug, name FROM listings WHERE published ORDER BY id LIMIT 1"
  );
  if (!rows.length) throw new Error("No listings found. Run: pnpm db:seed");
  const { slug, name } = rows[0];

  console.log(`Swellbook race check: ${ATTEMPTS} concurrent hold attempts, same listing, same dates`);
  console.log(`  listing  ${name}`);
  console.log(`  dates    ${CHECK_IN} to ${CHECK_OUT}\n`);

  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, (_, i) =>
      createHold(
        {
          listingSlug: slug,
          checkIn: CHECK_IN,
          checkOut: CHECK_OUT,
          guestName: `Racer ${i + 1}`,
          guestEmail: `racer${i + 1}@example.com`,
          idempotencyKey: `race-${runId}-${i + 1}`,
        },
        pool
      )
        .then((r) => ({ i: i + 1, ok: true as const, ref: r.ref }))
        .catch((err) => {
          if (err instanceof DatesUnavailableError) return { i: i + 1, ok: false as const };
          throw err;
        })
    )
  );

  const winners = results.filter((r) => r.ok);
  const losers = results.filter((r) => !r.ok);
  for (const w of winners) {
    console.log(`  attempt ${String(w.i).padStart(2, "0")}  won the hold  ${"ref" in w ? w.ref : ""}`);
  }
  console.log(`  ${losers.length} attempts  got a clean "dates unavailable" (HTTP 409 path)\n`);

  const { rows: active } = await pool.query(
    `SELECT count(*)::int AS n FROM reservations
     WHERE status IN ('hold', 'confirmed') AND stay = daterange($1::date, $2::date, '[)')
       AND idempotency_key LIKE $3`,
    [CHECK_IN, CHECK_OUT, `race-${runId}-%`]
  );
  console.log(`  database now holds exactly ${active[0].n} active reservation for those dates`);

  // Replay the winner's idempotency key: must return the same reservation, not a new one.
  let replayOk = false;
  if (winners.length === 1 && "ref" in winners[0]) {
    const winnerIndex = winners[0].i;
    const replay = await createHold(
      {
        listingSlug: slug,
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        guestName: `Racer ${winnerIndex}`,
        guestEmail: `racer${winnerIndex}@example.com`,
        idempotencyKey: `race-${runId}-${winnerIndex}`,
      },
      pool
    );
    replayOk = replay.ref === winners[0].ref && replay.replayed === true;
    console.log(
      `  replay check: same idempotency key returned ${replay.ref} again (no duplicate row)`
    );
  }

  await pool.query("DELETE FROM reservations WHERE idempotency_key LIKE $1", [`race-${runId}-%`]);

  const pass = winners.length === 1 && active[0].n === 1 && replayOk;
  console.log(`\n${pass ? "PASS" : "FAIL"}: ${winners.length}/${ATTEMPTS} holds won, ${losers.length} rejected cleanly`);
  await pool.end();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
