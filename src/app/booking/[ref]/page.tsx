import Link from "next/link";
import { notFound } from "next/navigation";
import { getReservationByRef } from "@/lib/repo/bookings";
import { longDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const booking = await getReservationByRef(ref);
  if (!booking) notFound();

  const confirmed = booking.status === "confirmed";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-12 sm:px-6">
      <div className="rounded-3xl border border-line bg-shell p-8">
        {confirmed ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-moss-mist text-2xl text-moss">
              ✓
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold">You are going.</h1>
          </>
        ) : booking.status === "hold" ? (
          <h1 className="font-display text-3xl font-semibold">Almost there.</h1>
        ) : (
          <h1 className="font-display text-3xl font-semibold">This booking is {booking.status}.</h1>
        )}

        <div className="mt-6 space-y-2 border-t border-line pt-5 text-[15px]">
          <p>
            <span className="text-ink-soft">Stay:</span>{" "}
            <span className="font-semibold">{booking.listingName}</span>, {booking.place}
          </p>
          <p>
            <span className="text-ink-soft">Dates:</span> {longDate(booking.checkIn)} to{" "}
            {longDate(booking.checkOut)}
          </p>
          {booking.totalCents !== null && (
            <p>
              <span className="text-ink-soft">Total:</span>{" "}
              <span className="font-semibold">{money(booking.totalCents, booking.currency)}</span>
              <span className="text-ink-soft"> paid directly to your host, zero commission</span>
            </p>
          )}
          <p>
            <span className="text-ink-soft">Reference:</span>{" "}
            <span className="font-mono font-semibold">{booking.ref}</span>
          </p>
          {booking.guestName && (
            <p>
              <span className="text-ink-soft">Guest:</span> {booking.guestName}
            </p>
          )}
        </div>

        {confirmed ? (
          <p className="mt-5 rounded-xl bg-ocean-mist p-4 text-sm leading-relaxed text-ocean-deep">
            Your host now has your name and email and will reach out directly. On Swellbook the
            relationship is yours and theirs, not ours.
          </p>
        ) : booking.status === "hold" ? (
          <p className="mt-5 rounded-xl bg-amber-mist p-4 text-sm leading-relaxed text-amber-warm">
            These dates are held but not confirmed yet. Go back to the listing to confirm before
            the hold expires.
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Link
            href={`/stay/${booking.listingSlug}`}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ocean hover:text-ocean"
          >
            View the listing
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ocean hover:text-ocean"
          >
            Explore more stays
          </Link>
        </div>
      </div>
    </div>
  );
}
