import Link from "next/link";
import { notFound } from "next/navigation";
import { getHostDashboard } from "@/lib/repo/listings";
import { money, shortDate } from "@/lib/format";
import { BlockDatesForm, CancelBlockButton } from "@/components/BlockControls";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-moss-mist text-moss",
  hold: "bg-amber-mist text-amber-warm",
  blocked: "bg-sand text-ink-soft",
};

export default async function DashboardPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const dashboard = await getHostDashboard(key);
  if (!dashboard) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
      <section className="pt-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-ocean">Host dashboard</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Welcome back, {dashboard.hostName}.
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          This page lives at a private link. In production it becomes a real account with
          email sign-in.
        </p>
      </section>

      {dashboard.listings.map((listing) => {
        const guestBookings = listing.reservations.filter((r) => r.status !== "blocked");
        const blocks = listing.reservations.filter((r) => r.status === "blocked");
        return (
          <section
            key={listing.id}
            className="mt-8 overflow-hidden rounded-2xl border border-line bg-shell"
          >
            <div className="flex items-center gap-4 border-b border-line p-4">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                <CoverArt hue={listing.hue} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl font-semibold">{listing.name}</h2>
                <p className="text-sm text-ink-soft">
                  {listing.place} · {money(listing.pricePerNightCents, listing.currency)} / night
                </p>
              </div>
              <Link
                href={`/stay/${listing.slug}`}
                className="ml-auto shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-ocean hover:text-ocean"
              >
                View listing
              </Link>
            </div>

            <div className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Upcoming stays
              </h3>
              {guestBookings.length === 0 ? (
                <p className="mt-2 rounded-lg bg-canvas px-3 py-3 text-sm text-ink-soft">
                  No upcoming stays yet. Your listing is live; when a traveler books, it appears
                  here instantly.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {guestBookings.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[r.status] ?? "bg-sand"}`}
                      >
                        {r.status}
                      </span>
                      <span className="font-medium">
                        {shortDate(r.checkIn)} to {shortDate(r.checkOut)}
                      </span>
                      {r.guestName && <span className="text-ink-soft">· {r.guestName}</span>}
                      {r.totalCents !== null && (
                        <span className="ml-auto font-semibold">
                          {money(r.totalCents, listing.currency)}
                        </span>
                      )}
                      <span className="font-mono text-xs text-ink-soft">{r.ref}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Blocked dates
              </h3>
              {blocks.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {blocks.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 text-sm">
                      <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-soft">
                        {shortDate(r.checkIn)} to {shortDate(r.checkOut)}
                      </span>
                      <CancelBlockButton dashboardKey={key} reservationId={r.id} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <BlockDatesForm dashboardKey={key} listingId={listing.id} />
                <p className="mt-2 text-xs text-ink-soft">
                  Blocks go through the same engine as bookings, so you can never block dates a
                  guest already holds.
                </p>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
