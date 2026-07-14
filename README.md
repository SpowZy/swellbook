# Swellbook

**A working slice of a zero-commission discovery and booking platform for surf camps, retreats and small lodges. Built in 48 hours by [SpowZy](https://github.com/SpowZy) as a founding-engineer application to bluepina.**

Live demo: **https://swellbook.vercel.app**

## The 60-second tour

**If you are a traveler:** search by dates, budget and vibe (surf, yoga, kite, slow living). Every result explains why it matched. Open a stay, read the host's story before the price, hold your dates for 15 minutes, confirm, get a booking reference. No account needed in the demo.

**If you are a host:** click "Become a host", answer four short steps, and your place is live and bookable, usually in under two minutes. You get a private dashboard with your bookings, and you can block dates for personal use. Zero commission is the model: what travelers pay belongs to the host.

**The invisible part, and the reason this demo exists:** two travelers can hit "book" on the same dates at the same instant, and exactly one will get them. Not because the code is careful, but because the database refuses to store a double-booking. Run `pnpm race` and watch 25 concurrent booking attempts produce exactly one reservation, every single time.

## The part that matters: a calendar that cannot lie

Booking platforms live or die on one guarantee: **the same nights are never sold twice**. Swellbook enforces that in PostgreSQL itself, so no bug in application code, no retry storm and no race condition can ever break it:

```sql
CONSTRAINT no_double_booking EXCLUDE USING gist (
  listing_id WITH =,
  stay WITH &&
) WHERE (status IN ('hold', 'confirmed', 'blocked'))
```

Around that one rule:

- **Idempotent booking creation.** Every booking request carries an idempotency key. A network retry or a double-click replays the same reservation instead of creating a second one. The tests prove it.
- **Holds with honest expiry.** Dates are held for 15 minutes (where payment would happen), then released. Expired holds are swept inside the booking transaction, never trusted implicitly.
- **Half-open date ranges.** Checkout day equals the next guest's check-in day. Back-to-back bookings work; one-night overlaps do not.
- **Money is integer cents.** Prices never touch floating point.
- **Host blocks ride the same engine.** A host cannot block dates a guest already holds, and a guest cannot book blocked dates. One rule, one enforcement point.
- **Friendly failures.** Losing a race gets a clean "those dates were just taken", HTTP 409, and the calendar refreshes. Nobody sees a stack trace.

Proof, not promises:

```
$ pnpm race
Swellbook race check: 25 concurrent hold attempts, same listing, same dates
  attempt 01  won the hold  SWB-CWT4R6
  24 attempts  got a clean "dates unavailable" (HTTP 409 path)
  database now holds exactly 1 active reservation for those dates
  replay check: same idempotency key returned SWB-CWT4R6 again (no duplicate row)
PASS: 1/25 holds won, 24 rejected cleanly

$ pnpm test
Test Files  1 passed (1)
     Tests  11 passed (11)
```

## Stack

Node.js, TypeScript, Next.js (App Router), PostgreSQL, Tailwind, and a little Python for data work. Deliberate choices, in the spirit of simplicity over cleverness:

- **Plain SQL with node-postgres, no ORM.** The correctness story lives in the schema; hiding it behind an abstraction would make the most important code the hardest to read.
- **`scripts/seed.py`** turns a deliberately messy CSV export (duplicate rows, "$68" next to "75.00", tags in random case) into clean, deterministic seed SQL, the way real listing data actually arrives.
- **Generated cover art** (SVG keyed on a hue the host picks) keeps the demo self-contained. Production gets real photos; empty listings still get their own light.
- **Transparent ranking.** Discovery scoring is a handful of explainable points (vibe overlap, budget fit, availability filter), not a black box. At catalog scale it becomes a learned ranker; the explainability stays.

## Run it locally

```bash
cp .env.example .env
docker compose up -d     # Postgres 16 on port 5433
pnpm install
pnpm db:seed             # migrations + 13 listings
pnpm dev
```

Then open http://localhost:3000. Tests: `pnpm test` (uses a throwaway `swellbook_test` database). Race check: `pnpm race`.

## If I were building this for real: the first 100 properties in 30 days

The product is a two-sided marketplace, and supply comes first. What I would ship and do, in order:

1. **Week 1: concierge onboarding.** Most camp and retreat operators run on Instagram DMs, WeTravel links and spreadsheets. Do not ask them to fill forms: get on a call, build their listing for them with the wizard (it already takes minutes), and hand them a live page that looks better than their OTA profile. Ten founding hosts, personally onboarded.
2. **Week 2: the migration magnet.** A "paste your existing listing URL" import that drafts their Swellbook page automatically. The wizard becomes the review step, not the data entry step.
3. **Week 3: make founding hosts the sales team.** These operators all know each other. Referral loop: a founding host who brings another operator keeps their "top of discovery" placement permanently. Small niches spread by word of mouth.
4. **Week 4: close the trust gap for travelers.** Booking reference pages, host reply within the product, and a visible "your money goes to your host" line on every checkout. Then measure: time-to-live per host, search-to-hold rate, hold-to-confirm rate.

## What I would build next

In priority order: real payments (Stripe Connect, with the ledger and payout states designed before the first charge), host accounts with email sign-in, photo uploads, reviews after checkout, calendar sync (iCal import to stop double-selling against OTAs during the transition), and multi-currency.

## Honest scope notes

This is a 48-hour vertical slice, and some corners are explicitly demo-grade: the host dashboard is behind an unguessable private link instead of real auth, cover art stands in for photos, payments are represented by the hold-confirm boundary, and hold sweeping happens inside booking transactions rather than a background job. Every one of these has a clear production path, and none of them touch the core guarantee: the calendar cannot lie.
