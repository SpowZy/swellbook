import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { getPool } from "../db";
import { VIBES } from "../vibes";
import { parseStay, ValidationError } from "./bookings";

export { VIBES };

export type Listing = {
  id: string;
  slug: string;
  name: string;
  place: string;
  country: string;
  vibeTags: string[];
  pricePerNightCents: number;
  currency: string;
  capacity: number;
  story: string;
  hostStory: string;
  hostName: string;
  hue: number;
};

export type SearchResult = {
  listing: Listing;
  /** Transparent ranking: every point is explainable to a non-technical reader. */
  score: number;
  matchedVibes: string[];
  withinBudget: boolean | null;
};

function rowToListing(row: Record<string, unknown>): Listing {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    place: String(row.place),
    country: String(row.country),
    vibeTags: (row.vibe_tags as string[]) ?? [],
    pricePerNightCents: Number(row.price_per_night_cents),
    currency: String(row.currency),
    capacity: Number(row.capacity),
    story: String(row.story),
    hostStory: String(row.host_story),
    hostName: String(row.host_name ?? ""),
    hue: Number(row.hue),
  };
}

export type SearchParams = {
  vibes?: string[];
  budgetMaxCents?: number;
  checkIn?: string;
  checkOut?: string;
};

/**
 * Discovery with a transparent "vibe match" score:
 *   +10 per matched vibe, +6 when the nightly price fits the budget.
 * When dates are given, listings that are not free for them are excluded
 * up front, so nothing un-bookable is ever ranked.
 * At catalog scale this moves into SQL or a learned ranker; at demo scale,
 * explainability beats machinery.
 */
export async function searchListings(params: SearchParams, pool: Pool = getPool()): Promise<SearchResult[]> {
  const { vibes = [], budgetMaxCents, checkIn, checkOut } = params;
  const hasDates = Boolean(checkIn && checkOut);

  const { rows } = await pool.query(
    `SELECT l.*, h.name AS host_name
     FROM listings l
     JOIN hosts h ON h.id = l.host_id
     WHERE l.published
       AND ($1::date IS NULL OR NOT EXISTS (
         SELECT 1 FROM reservations r
         WHERE r.listing_id = l.id
           AND r.status IN ('hold', 'confirmed', 'blocked')
           AND (r.status <> 'hold' OR r.expires_at > now())
           AND r.stay && daterange($1::date, $2::date, '[)')
       ))
     ORDER BY l.name`,
    hasDates ? [checkIn, checkOut] : [null, null]
  );

  const wanted = vibes.map((v) => v.toLowerCase());
  const results: SearchResult[] = rows.map((row) => {
    const listing = rowToListing(row);
    const matchedVibes = listing.vibeTags.filter((t) => wanted.includes(t));
    const withinBudget =
      budgetMaxCents == null ? null : listing.pricePerNightCents <= budgetMaxCents;
    const score = matchedVibes.length * 10 + (withinBudget ? 6 : 0);
    return { listing, score, matchedVibes, withinBudget };
  });

  return results.sort(
    (a, b) =>
      b.score - a.score ||
      a.listing.pricePerNightCents - b.listing.pricePerNightCents ||
      a.listing.name.localeCompare(b.listing.name)
  );
}

export type ListingDetail = Listing & {
  bookedRanges: { checkIn: string; checkOut: string; kind: "guest" | "blocked" }[];
};

export async function getListingBySlug(slug: string, pool: Pool = getPool()): Promise<ListingDetail | null> {
  const { rows } = await pool.query(
    `SELECT l.*, h.name AS host_name FROM listings l JOIN hosts h ON h.id = l.host_id
     WHERE l.slug = $1 AND l.published`,
    [slug]
  );
  if (!rows.length) return null;
  const listing = rowToListing(rows[0]);

  const res = await pool.query(
    `SELECT stay, status FROM reservations
     WHERE listing_id = $1
       AND status IN ('hold', 'confirmed', 'blocked')
       AND (status <> 'hold' OR expires_at > now())
       AND upper(stay) >= current_date
     ORDER BY lower(stay)`,
    [listing.id]
  );
  const bookedRanges = res.rows.map((r) => {
    const { checkIn, checkOut } = parseStay(String(r.stay));
    return { checkIn, checkOut, kind: r.status === "blocked" ? ("blocked" as const) : ("guest" as const) };
  });
  return { ...listing, bookedRanges };
}

export type CreateListingInput = {
  hostName: string;
  hostStory: string;
  name: string;
  place: string;
  country: string;
  capacity: number;
  pricePerNightCents: number;
  vibeTags: string[];
  story: string;
  hue: number;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * The whole host onboarding writes through here: one transaction, and the
 * listing is live and bookable the moment it commits.
 */
export async function createListing(input: CreateListingInput, pool: Pool = getPool()) {
  const name = input.name.trim();
  const place = input.place.trim();
  const hostName = input.hostName.trim();
  if (!name || !place || !input.country.trim() || !hostName) {
    throw new ValidationError("Name, place, country and host name are required.");
  }
  if (!Number.isInteger(input.pricePerNightCents) || input.pricePerNightCents <= 0) {
    throw new ValidationError("Nightly price must be a positive amount.");
  }
  if (!Number.isInteger(input.capacity) || input.capacity <= 0 || input.capacity > 500) {
    throw new ValidationError("Capacity must be between 1 and 500.");
  }
  const vibeTags = [...new Set(input.vibeTags.map((v) => v.toLowerCase().trim()))].filter((v) =>
    (VIBES as readonly string[]).includes(v)
  );
  if (!vibeTags.length) throw new ValidationError("Pick at least one vibe.");
  const hue = Number.isFinite(input.hue) ? ((Math.round(input.hue) % 360) + 360) % 360 : 200;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dashboardKey = randomBytes(16).toString("hex");
    const host = await client.query(
      "INSERT INTO hosts (name, story, dashboard_key) VALUES ($1, $2, $3) RETURNING id",
      [hostName, input.hostStory.trim(), dashboardKey]
    );

    const base = slugify(`${name}-${place}`) || "listing";
    let slug = base;
    for (let attempt = 1; ; attempt++) {
      const clash = await client.query("SELECT 1 FROM listings WHERE slug = $1", [slug]);
      if (!clash.rowCount) break;
      slug = `${base}-${attempt + 1}`;
    }

    const listing = await client.query(
      `INSERT INTO listings
         (host_id, slug, name, place, country, vibe_tags, price_per_night_cents, capacity, story, host_story, hue)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING slug`,
      [
        host.rows[0].id,
        slug,
        name,
        place,
        input.country.trim(),
        vibeTags,
        input.pricePerNightCents,
        input.capacity,
        input.story.trim(),
        input.hostStory.trim(),
        hue,
      ]
    );
    await client.query("COMMIT");
    return { slug: String(listing.rows[0].slug), dashboardKey };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export type HostDashboard = {
  hostName: string;
  listings: (Listing & {
    reservations: {
      id: string;
      ref: string;
      status: string;
      checkIn: string;
      checkOut: string;
      guestName: string | null;
      totalCents: number | null;
    }[];
  })[];
};

export async function getHostDashboard(dashboardKey: string, pool: Pool = getPool()): Promise<HostDashboard | null> {
  const host = await pool.query("SELECT id, name FROM hosts WHERE dashboard_key = $1", [dashboardKey]);
  if (!host.rowCount) return null;

  const listings = await pool.query(
    `SELECT l.*, h.name AS host_name FROM listings l JOIN hosts h ON h.id = l.host_id
     WHERE l.host_id = $1 ORDER BY l.created_at`,
    [host.rows[0].id]
  );
  const out: HostDashboard = { hostName: String(host.rows[0].name), listings: [] };
  for (const row of listings.rows) {
    const listing = rowToListing(row);
    const res = await pool.query(
      `SELECT id, ref, status, stay, guest_name, total_cents FROM reservations
       WHERE listing_id = $1
         AND status IN ('hold', 'confirmed', 'blocked')
         AND (status <> 'hold' OR expires_at > now())
         AND upper(stay) >= current_date
       ORDER BY lower(stay)`,
      [listing.id]
    );
    out.listings.push({
      ...listing,
      reservations: res.rows.map((r) => {
        const { checkIn, checkOut } = parseStay(String(r.stay));
        return {
          id: String(r.id),
          ref: String(r.ref),
          status: String(r.status),
          checkIn,
          checkOut,
          guestName: (r.guest_name as string) ?? null,
          totalCents: r.total_cents === null ? null : Number(r.total_cents),
        };
      }),
    });
  }
  return out;
}
