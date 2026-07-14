import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingBySlug } from "@/lib/repo/listings";
import { vibeLabel } from "@/lib/vibes";
import { BookingWidget } from "@/components/BookingWidget";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";

export default async function StayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="pt-6">
        <Link href="/" className="text-sm font-medium text-ocean hover:underline">
          Back to all stays
        </Link>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-line">
        <div className="aspect-[21/9]">
          <CoverArt hue={listing.hue} />
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {listing.name}
          </h1>
          <p className="mt-1 text-lg text-ink-soft">{listing.place}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {listing.vibeTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium capitalize text-ink-soft"
              >
                {vibeLabel(tag)}
              </span>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-line bg-shell p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ocean">
              {listing.hostName ? `${listing.hostName}'s story` : "The host's story"}
            </p>
            <p className="mt-2 leading-relaxed text-ink">{listing.hostStory}</p>
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              The place
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink">{listing.story}</p>
          </section>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <BookingWidget
            listingSlug={listing.slug}
            pricePerNightCents={listing.pricePerNightCents}
            currency={listing.currency}
            capacity={listing.capacity}
            bookedRanges={listing.bookedRanges}
          />
        </div>
      </div>
    </div>
  );
}
