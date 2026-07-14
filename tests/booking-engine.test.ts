import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  blockDates,
  confirmReservation,
  createHold,
  DatesUnavailableError,
  HoldExpiredError,
} from "../src/lib/repo/bookings";
import { createListing, searchListings } from "../src/lib/repo/listings";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) throw new Error("TEST_DATABASE_URL is not set (copy .env.example to .env)");
if (!/_test\b/.test(TEST_URL)) {
  throw new Error("Refusing to run tests: TEST_DATABASE_URL must point at a *_test database.");
}

let pool: Pool;

async function ensureTestDatabase() {
  // Create the throwaway test DB if it does not exist yet.
  const adminUrl = new URL(TEST_URL!);
  const dbName = adminUrl.pathname.slice(1);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${dbName}`);
  } catch (err) {
    if ((err as { code?: string }).code !== "42P04") throw err; // 42P04 = already exists
  } finally {
    await admin.end();
  }
}

async function migrateFresh() {
  const client = new Client({ connectionString: TEST_URL });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const dir = join(process.cwd(), "db", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.query(readFileSync(join(dir, file), "utf8"));
  }
  await client.end();
}

const IN = "2027-08-01";
const OUT = "2027-08-06";
let listingSlug: string;
let listingId: string;
let dashboardKey: string;

beforeAll(async () => {
  await ensureTestDatabase();
  await migrateFresh();
  pool = new Pool({ connectionString: TEST_URL, max: 30 });

  const created = await createListing(
    {
      hostName: "Test Host",
      hostStory: "Runs the test lodge.",
      name: "Test Lodge",
      place: "Testville, Testland",
      country: "Testland",
      capacity: 8,
      pricePerNightCents: 10_000,
      vibeTags: ["surf", "yoga"],
      story: "A lodge that exists purely to be booked by tests.",
      hue: 200,
    },
    pool
  );
  listingSlug = created.slug;
  dashboardKey = created.dashboardKey;
  const { rows } = await pool.query("SELECT id FROM listings WHERE slug = $1", [listingSlug]);
  listingId = String(rows[0].id);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query("DELETE FROM reservations");
});

function holdInput(i: number, checkIn = IN, checkOut = OUT) {
  return {
    listingSlug,
    checkIn,
    checkOut,
    guestName: `Guest ${i}`,
    guestEmail: `guest${i}@example.com`,
    idempotencyKey: `test-key-${i}`,
  };
}

describe("double-booking protection", () => {
  it("lets exactly one of 25 concurrent holds win", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        createHold(holdInput(i), pool).then(
          () => "won",
          (err) => (err instanceof DatesUnavailableError ? "rejected" : Promise.reject(err))
        )
      )
    );
    expect(results.filter((r) => r === "won")).toHaveLength(1);
    expect(results.filter((r) => r === "rejected")).toHaveLength(24);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM reservations WHERE status = 'hold'"
    );
    expect(rows[0].n).toBe(1);
  });

  it("rejects a partial overlap but allows back-to-back stays", async () => {
    await createHold(holdInput(1), pool);
    // Overlaps by one night.
    await expect(createHold(holdInput(2, "2027-08-05", "2027-08-09"), pool)).rejects.toThrow(
      DatesUnavailableError
    );
    // Checkout day = next check-in day: allowed by the half-open range.
    const backToBack = await createHold(holdInput(3, "2027-08-06", "2027-08-09"), pool);
    expect(backToBack.status).toBe("hold");
  });
});

describe("idempotency", () => {
  it("replaying the same key returns the same reservation, never a second row", async () => {
    const first = await createHold(holdInput(1), pool);
    const replay = await createHold(holdInput(1), pool);
    expect(replay.ref).toBe(first.ref);
    expect(replay.replayed).toBe(true);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM reservations");
    expect(rows[0].n).toBe(1);
  });
});

describe("hold lifecycle", () => {
  it("prices the stay in integer cents", async () => {
    const hold = await createHold(holdInput(1), pool); // 5 nights x $100.00
    expect(hold.totalCents).toBe(50_000);
  });

  it("confirms a live hold and is a no-op on a second confirm", async () => {
    const hold = await createHold(holdInput(1), pool);
    const confirmed = await confirmReservation(hold.ref, pool);
    expect(confirmed.status).toBe("confirmed");
    const again = await confirmReservation(hold.ref, pool);
    expect(again.status).toBe("confirmed");
  });

  it("frees the dates once a hold expires, and refuses to confirm it", async () => {
    const hold = await createHold(holdInput(1), pool);
    await pool.query("UPDATE reservations SET expires_at = now() - interval '1 minute' WHERE ref = $1", [
      hold.ref,
    ]);
    // The expired hold no longer blocks new guests.
    const next = await createHold(holdInput(2), pool);
    expect(next.status).toBe("hold");
    // And it can no longer be confirmed.
    await expect(confirmReservation(hold.ref, pool)).rejects.toThrow(HoldExpiredError);
  });
});

describe("host blocks share the same engine", () => {
  it("a block cannot cover a guest's active stay", async () => {
    await createHold(holdInput(1), pool);
    await expect(
      blockDates({ dashboardKey, listingId, from: IN, to: OUT }, pool)
    ).rejects.toThrow(DatesUnavailableError);
  });

  it("a guest cannot book blocked dates", async () => {
    await blockDates({ dashboardKey, listingId, from: IN, to: OUT }, pool);
    await expect(createHold(holdInput(1), pool)).rejects.toThrow(DatesUnavailableError);
  });

  it("rejects a block from someone who does not own the listing", async () => {
    await expect(
      blockDates({ dashboardKey: "not-a-real-key", listingId, from: IN, to: OUT }, pool)
    ).rejects.toThrow("Listing not found for this host.");
  });
});

describe("discovery", () => {
  it("excludes listings that are not free for the searched dates", async () => {
    const before = await searchListings({ checkIn: IN, checkOut: OUT }, pool);
    expect(before.some((r) => r.listing.slug === listingSlug)).toBe(true);

    await createHold(holdInput(1), pool);
    const after = await searchListings({ checkIn: IN, checkOut: OUT }, pool);
    expect(after.some((r) => r.listing.slug === listingSlug)).toBe(false);
  });

  it("scores vibe matches transparently", async () => {
    const results = await searchListings({ vibes: ["surf", "yoga"], budgetMaxCents: 20_000 }, pool);
    const hit = results.find((r) => r.listing.slug === listingSlug);
    expect(hit).toBeDefined();
    expect(hit!.matchedVibes.sort()).toEqual(["surf", "yoga"]);
    expect(hit!.withinBudget).toBe(true);
    expect(hit!.score).toBe(26); // 2 vibes x 10 + budget 6
  });
});
