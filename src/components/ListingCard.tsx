import Link from "next/link";
import type { SearchResult } from "@/lib/repo/listings";
import { money } from "@/lib/format";
import { vibeLabel } from "@/lib/vibes";
import { Cover } from "./Cover";

export function ListingCard({
  result,
  searching,
  dates,
}: {
  result: SearchResult;
  searching: boolean;
  dates?: { from: string; to: string } | null;
}) {
  const { listing, matchedVibes, withinBudget } = result;
  const matchNotes = [
    ...matchedVibes.map(vibeLabel),
    ...(withinBudget ? ["in budget"] : []),
  ];
  // Carry the searched dates onto the listing page so the booking widget
  // is already filled in when the traveler lands on it.
  const href = dates
    ? `/stay/${listing.slug}?from=${dates.from}&to=${dates.to}`
    : `/stay/${listing.slug}`;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-line bg-shell shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Cover
          coverUrl={listing.coverUrl}
          hue={listing.hue}
          alt={`${listing.name}, ${listing.place}`}
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {searching && matchNotes.length > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-moss-mist/95 px-2.5 py-1 text-xs font-semibold text-moss">
            Great match: {matchNotes.join(", ")}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-snug text-ink">
            {listing.name}
          </h3>
          <p className="whitespace-nowrap text-sm text-ink">
            <span className="font-semibold">{money(listing.pricePerNightCents, listing.currency)}</span>
            <span className="text-ink-soft"> / night</span>
          </p>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">{listing.place}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">{listing.story}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {listing.vibeTags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-sand px-2 py-0.5 text-xs font-medium capitalize text-ink-soft"
            >
              {vibeLabel(tag)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
