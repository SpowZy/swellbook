import { searchListings } from "@/lib/repo/listings";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const checkIn = first(sp.from);
  const checkOut = first(sp.to);
  const budget = first(sp.budget);
  const vibes = Array.isArray(sp.vibe) ? sp.vibe : sp.vibe ? [sp.vibe] : [];
  const searching = Boolean(checkIn || budget || vibes.length);

  const results = await searchListings({
    vibes,
    budgetMaxCents: budget ? Number(budget) : undefined,
    checkIn: checkIn || undefined,
    checkOut: checkOut || undefined,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <section className="pt-10 sm:pt-14">
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Find the trip that feels like you<span className="text-coral">.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Surf camps, retreats and small lodges from independent hosts who keep every dollar you
          pay them. Zero commission, ever.
        </p>
      </section>

      <section className="mt-6">
        <SearchBar initial={{ checkIn, checkOut, budget, vibes: [...vibes] }} />
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            {searching
              ? `${results.length} ${results.length === 1 ? "stay fits" : "stays fit"} your trip`
              : `${results.length} stays from founding hosts`}
          </h2>
        </div>

        {results.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-line bg-shell p-10 text-center">
            <p className="font-display text-2xl">Nothing fits those exact filters.</p>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">
              Try widening the budget, dropping a vibe, or shifting your dates a few days. The
              ocean is not going anywhere.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => (
              <ListingCard
                key={result.listing.id}
                result={result}
                searching={searching}
                dates={checkIn && checkOut ? { from: checkIn, to: checkOut } : null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
