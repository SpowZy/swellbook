-- Swellbook schema. The one rule that matters lives here:
-- a stay can never overlap another active stay for the same listing.
-- The database enforces it, so no bug in application code can ever double-book.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE hosts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  story TEXT NOT NULL DEFAULT '',
  -- Stands in for auth in this demo: an unguessable link is the host's key.
  dashboard_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id BIGSERIAL PRIMARY KEY,
  host_id BIGINT NOT NULL REFERENCES hosts(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  place TEXT NOT NULL,
  country TEXT NOT NULL,
  vibe_tags TEXT[] NOT NULL DEFAULT '{}',
  price_per_night_cents INT NOT NULL CHECK (price_per_night_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  capacity INT NOT NULL DEFAULT 8 CHECK (capacity > 0),
  story TEXT NOT NULL DEFAULT '',
  host_story TEXT NOT NULL DEFAULT '',
  hue INT NOT NULL DEFAULT 200,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listings_published_idx ON listings (published) WHERE published;

CREATE TYPE reservation_status AS ENUM ('hold', 'confirmed', 'blocked', 'cancelled', 'expired');

CREATE TABLE reservations (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id),
  status reservation_status NOT NULL,
  -- Half-open range [check_in, check_out): checkout day is free for the next guest.
  stay DATERANGE NOT NULL CHECK (
    NOT isempty(stay) AND lower_inc(stay) AND NOT upper_inc(stay)
    AND lower(stay) IS NOT NULL AND upper(stay) IS NOT NULL
  ),
  guest_name TEXT,
  guest_email TEXT,
  -- Money is integer cents, always. Floats never touch a price.
  total_cents INT CHECK (total_cents IS NULL OR total_cents >= 0),
  -- Same key replayed = same reservation returned, never a second row.
  idempotency_key TEXT UNIQUE,
  ref TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The kill switch. Two active reservations for the same listing whose date
  -- ranges overlap cannot both exist, no matter how many requests race.
  CONSTRAINT no_double_booking EXCLUDE USING gist (
    listing_id WITH =,
    stay WITH &&
  ) WHERE (status IN ('hold', 'confirmed', 'blocked'))
);

CREATE INDEX reservations_listing_idx ON reservations (listing_id, status);
CREATE INDEX reservations_expiry_idx ON reservations (expires_at) WHERE status = 'hold';
