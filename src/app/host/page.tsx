import Link from "next/link";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getDemoDashboardLink(): Promise<string | null> {
  // The seed gives every demo host a stable dashboard key; Mariana is the tour guide.
  const { rows } = await getPool().query(
    "SELECT dashboard_key FROM hosts WHERE name = 'Mariana' ORDER BY id LIMIT 1"
  );
  return rows.length ? `/host/dashboard/${rows[0].dashboard_key}` : null;
}

export default async function HostLandingPage() {
  const demoDashboard = await getDemoDashboardLink();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <section className="pt-12 sm:pt-16">
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Your place, your story, your guests<span className="text-coral">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft">
          The big booking sites take 15 to 25% of every stay and keep your guest&apos;s contact
          for themselves. Swellbook charges a flat membership, sends travelers who want what you
          actually offer, and the relationship stays yours.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/host/new"
            className="rounded-lg bg-coral px-6 py-3 font-semibold text-white hover:bg-coral-deep"
          >
            List your place, live in minutes
          </Link>
          {demoDashboard && (
            <Link
              href={demoDashboard}
              className="rounded-lg border border-line px-6 py-3 font-medium text-ink hover:border-ocean hover:text-ocean"
            >
              Peek at a host dashboard (demo host: Mariana)
            </Link>
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-5 sm:grid-cols-3">
        {[
          {
            title: "Zero commission",
            body: "A flat, transparent membership instead of a cut of every booking. A full season of bookings costs you the same as a quiet one.",
          },
          {
            title: "Story-led discovery",
            body: "Travelers find you by vibe, dates and budget, and read your story before your price. No burying you under thousands of generic listings.",
          },
          {
            title: "A calendar that cannot double-book",
            body: "Holds, confirmations and your own blocked dates all go through one engine. Two guests can never end up with the same nights, even if they click at the same instant.",
          },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-line bg-shell p-6">
            <h2 className="font-display text-xl font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
