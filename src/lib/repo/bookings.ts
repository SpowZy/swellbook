import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "../db";

export const HOLD_MINUTES = 15;
const MAX_STAY_NIGHTS = 60;

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class DatesUnavailableError extends Error {
  constructor(message = "Those dates were just taken for this listing.") {
    super(message);
  }
}
export class HoldExpiredError extends Error {
  constructor(message = "This hold has expired. Pick your dates again.") {
    super(message);
  }
}

export type Reservation = {
  id: string;
  listingId: string;
  status: "hold" | "confirmed" | "blocked" | "cancelled" | "expired";
  checkIn: string;
  checkOut: string;
  guestName: string | null;
  guestEmail: string | null;
  totalCents: number | null;
  ref: string;
  expiresAt: string | null;
  replayed?: boolean;
};

// Postgres returns a daterange as text like "[2026-08-01,2026-08-05)".
export function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const match = /^[[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  if (!match) throw new Error(`unexpected daterange format: ${stay}`);
  return { checkIn: match[1], checkOut: match[2] };
}

function rowToReservation(row: Record<string, unknown>): Reservation {
  const { checkIn, checkOut } = parseStay(String(row.stay));
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    status: row.status as Reservation["status"],
    checkIn,
    checkOut,
    guestName: (row.guest_name as string) ?? null,
    guestEmail: (row.guest_email as string) ?? null,
    totalCents: row.total_cents === null ? null : Number(row.total_cents),
    ref: String(row.ref),
    expiresAt: row.expires_at ? new Date(row.expires_at as string).toISOString() : null,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function assertStay(checkIn: string, checkOut: string) {
  if (!ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) {
    throw new ValidationError("Dates must be YYYY-MM-DD.");
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new ValidationError("Check-out must be after check-in.");
  if (nights > MAX_STAY_NIGHTS) {
    throw new ValidationError(`Stays are capped at ${MAX_STAY_NIGHTS} nights.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (checkIn < today) throw new ValidationError("Check-in cannot be in the past.");
}

function newRef(): string {
  // Unambiguous alphabet, no 0/O or 1/I.
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `SWB-${out}`;
}

// Expired holds keep blocking the exclusion constraint until they are swept.
// Every write for a listing sweeps first, inside the same transaction.
async function sweepExpiredHolds(client: PoolClient, listingId: string) {
  await client.query(
    `UPDATE reservations SET status = 'expired'
     WHERE listing_id = $1 AND status = 'hold' AND expires_at <= now()`,
    [listingId]
  );
}

export type CreateHoldInput = {
  listingSlug: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  idempotencyKey: string;
};

/**
 * Places a 15-minute hold on the dates. Concurrency-safe by construction:
 * if two requests race for the same dates, the database's exclusion
 * constraint lets exactly one through and this function turns the loser
 * into a clean DatesUnavailableError. Replaying the same idempotency key
 * returns the original reservation instead of creating a second one.
 */
export async function createHold(input: CreateHoldInput, pool: Pool = getPool()): Promise<Reservation> {
  const { listingSlug, checkIn, checkOut, guestName, guestEmail, idempotencyKey } = input;
  assertStay(checkIn, checkOut);
  if (!guestName.trim()) throw new ValidationError("Guest name is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) {
    throw new ValidationError("A valid guest email is required.");
  }
  if (!idempotencyKey.trim()) throw new ValidationError("An idempotency key is required.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const listing = await client.query(
      "SELECT id, price_per_night_cents FROM listings WHERE slug = $1 AND published",
      [listingSlug]
    );
    if (!listing.rowCount) throw new NotFoundError("Listing not found.");
    const listingId = String(listing.rows[0].id);

    // Replay? Return the original reservation, do not touch the calendar.
    const replay = await client.query("SELECT * FROM reservations WHERE idempotency_key = $1", [
      idempotencyKey,
    ]);
    if (replay.rowCount) {
      await client.query("COMMIT");
      return { ...rowToReservation(replay.rows[0]), replayed: true };
    }

    await sweepExpiredHolds(client, listingId);

    const totalCents = nightsBetween(checkIn, checkOut) * Number(listing.rows[0].price_per_night_cents);
    const inserted = await client.query(
      `INSERT INTO reservations
         (listing_id, status, stay, guest_name, guest_email, total_cents, idempotency_key, ref, expires_at)
       VALUES ($1, 'hold', daterange($2::date, $3::date, '[)'), $4, $5, $6, $7, $8,
               now() + make_interval(mins => $9))
       RETURNING *`,
      [listingId, checkIn, checkOut, guestName.trim(), guestEmail.trim(), totalCents, idempotencyKey, newRef(), HOLD_MINUTES]
    );
    await client.query("COMMIT");
    return rowToReservation(inserted.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    const pgErr = err as { code?: string };
    if (pgErr.code === "23P01") throw new DatesUnavailableError();
    if (pgErr.code === "23505") {
      // Two requests raced with the same idempotency key: the second one
      // reads back what the first one created.
      const { rows } = await pool.query("SELECT * FROM reservations WHERE idempotency_key = $1", [
        input.idempotencyKey,
      ]);
      if (rows.length) return { ...rowToReservation(rows[0]), replayed: true };
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Confirms a hold before it expires. In a real payment flow this is where
 * the charge would land, between hold and confirm. Confirming an already
 * confirmed reservation is a no-op that returns it unchanged.
 */
export async function confirmReservation(ref: string, pool: Pool = getPool()): Promise<Reservation> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM reservations WHERE ref = $1 FOR UPDATE", [ref]);
    if (!existing.rowCount) throw new NotFoundError("Reservation not found.");
    const row = existing.rows[0];

    if (row.status === "confirmed") {
      await client.query("COMMIT");
      return rowToReservation(row);
    }
    if (row.status !== "hold" || new Date(row.expires_at) <= new Date()) {
      throw new HoldExpiredError();
    }
    const updated = await client.query(
      `UPDATE reservations SET status = 'confirmed', expires_at = NULL WHERE id = $1 RETURNING *`,
      [row.id]
    );
    await client.query("COMMIT");
    return rowToReservation(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getReservationByRef(ref: string, pool: Pool = getPool()) {
  const { rows } = await pool.query(
    `SELECT r.*, l.name AS listing_name, l.slug AS listing_slug, l.place, l.country, l.currency
     FROM reservations r JOIN listings l ON l.id = r.listing_id
     WHERE r.ref = $1`,
    [ref]
  );
  if (!rows.length) return null;
  return {
    ...rowToReservation(rows[0]),
    listingName: String(rows[0].listing_name),
    listingSlug: String(rows[0].listing_slug),
    place: String(rows[0].place),
    country: String(rows[0].country),
    currency: String(rows[0].currency),
  };
}

/**
 * Hosts block dates through the same engine guests book through, so a block
 * can never overlap a guest's active stay either.
 */
export async function blockDates(
  args: { dashboardKey: string; listingId: string; from: string; to: string },
  pool: Pool = getPool()
): Promise<Reservation> {
  assertStay(args.from, args.to);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(
      `SELECT l.id FROM listings l JOIN hosts h ON h.id = l.host_id
       WHERE l.id = $1 AND h.dashboard_key = $2`,
      [args.listingId, args.dashboardKey]
    );
    if (!owned.rowCount) throw new NotFoundError("Listing not found for this host.");
    await sweepExpiredHolds(client, args.listingId);
    const inserted = await client.query(
      `INSERT INTO reservations (listing_id, status, stay, ref)
       VALUES ($1, 'blocked', daterange($2::date, $3::date, '[)'), $4)
       RETURNING *`,
      [args.listingId, args.from, args.to, newRef()]
    );
    await client.query("COMMIT");
    return rowToReservation(inserted.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if ((err as { code?: string }).code === "23P01") {
      throw new DatesUnavailableError("A guest already has part of those dates. Blocks cannot cover an active stay.");
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelBlock(
  args: { dashboardKey: string; reservationId: string },
  pool: Pool = getPool()
): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE reservations r SET status = 'cancelled'
     FROM listings l JOIN hosts h ON h.id = l.host_id
     WHERE r.id = $1 AND r.listing_id = l.id AND h.dashboard_key = $2 AND r.status = 'blocked'`,
    [args.reservationId, args.dashboardKey]
  );
  if (!rowCount) throw new NotFoundError("Block not found for this host.");
}
