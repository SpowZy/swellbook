"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { money, shortDate } from "@/lib/format";

type BookedRange = { checkIn: string; checkOut: string; kind: "guest" | "blocked" };

type HeldReservation = {
  ref: string;
  totalCents: number;
  expiresAt: string | null;
  checkIn: string;
  checkOut: string;
};

type Phase =
  | { name: "idle" }
  | { name: "holding" }
  | { name: "held"; reservation: HeldReservation }
  | { name: "confirming"; reservation: HeldReservation }
  | { name: "expired" };

function nights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
}

export function BookingWidget({
  listingSlug,
  pricePerNightCents,
  currency,
  capacity,
  bookedRanges,
}: {
  listingSlug: string;
  pricePerNightCents: number;
  currency: string;
  capacity: number;
  bookedRanges: BookedRange[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // One idempotency key per booking attempt: a retry after a network blip
  // reuses it and gets the same reservation back instead of a duplicate.
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
  }, [checkIn, checkOut, guestEmail]);

  useEffect(() => {
    if (phase.name !== "held" || !phase.reservation.expiresAt) return;
    const expiry = Date.parse(phase.reservation.expiresAt);
    const tick = () => {
      const left = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setPhase({ name: "expired" });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const stayNights = nights(checkIn, checkOut);
  const estimate = stayNights > 0 ? stayNights * pricePerNightCents : 0;

  async function placeHold() {
    setError(null);
    if (!checkIn || !checkOut || stayNights < 1) {
      setError("Pick a check-in and a later check-out date.");
      return;
    }
    if (!guestName.trim() || !guestEmail.trim()) {
      setError("Add your name and email so the host knows who is coming.");
      return;
    }
    setPhase({ name: "holding" });
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({ listingSlug, checkIn, checkOut, guestName, guestEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase({ name: "idle" });
        setError(data.error ?? "Something went wrong. It is safe to try again.");
        router.refresh();
        return;
      }
      setPhase({ name: "held", reservation: data.reservation });
    } catch {
      setPhase({ name: "idle" });
      setError("Network hiccup. Trying again is safe: the same request can never book twice.");
    }
  }

  async function confirm(reservation: HeldReservation) {
    setPhase({ name: "confirming", reservation });
    try {
      const res = await fetch(`/api/bookings/${reservation.ref}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 410) {
          setPhase({ name: "expired" });
        } else {
          setPhase({ name: "held", reservation });
          setError(data.error ?? "Could not confirm. It is safe to try again.");
        }
        return;
      }
      router.push(`/booking/${reservation.ref}`);
    } catch {
      setPhase({ name: "held", reservation });
      setError("Network hiccup while confirming. Try again, nothing is lost.");
    }
  }

  const upcoming = bookedRanges.slice(0, 5);

  return (
    <div className="rounded-2xl border border-line bg-shell p-5 shadow-sm">
      <p className="text-lg">
        <span className="font-semibold">{money(pricePerNightCents, currency)}</span>
        <span className="text-ink-soft"> / night · up to {capacity} guests</span>
      </p>

      {phase.name === "held" || phase.name === "confirming" ? (
        <div className="mt-4 rounded-xl border border-ocean/30 bg-ocean-mist p-4">
          <p className="font-semibold text-ocean-deep">
            Dates held: {shortDate(phase.reservation.checkIn)} to {shortDate(phase.reservation.checkOut)}
          </p>
          <p className="mt-1 text-sm text-ink">
            Total {money(phase.reservation.totalCents, currency)}. We are holding these dates for
            you{secondsLeft !== null && (
              <>
                {" "}
                for another{" "}
                <span className="font-mono font-semibold">
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                </span>
              </>
            )}
            . In production, payment happens here.
          </p>
          <button
            onClick={() => confirm(phase.reservation)}
            disabled={phase.name === "confirming"}
            className="mt-3 w-full rounded-lg bg-coral py-2.5 font-semibold text-white transition-colors hover:bg-coral-deep disabled:opacity-60"
          >
            {phase.name === "confirming" ? "Confirming…" : "Confirm booking"}
          </button>
        </div>
      ) : phase.name === "expired" ? (
        <div className="mt-4 rounded-xl border border-amber-warm/30 bg-amber-mist p-4 text-sm">
          <p className="font-semibold text-amber-warm">Your hold expired.</p>
          <p className="mt-1 text-ink-soft">
            The dates went back on the market for other travelers. Pick them again if they are
            still free.
          </p>
          <button
            onClick={() => {
              setPhase({ name: "idle" });
              router.refresh();
            }}
            className="mt-2 font-semibold text-ocean hover:underline"
          >
            Pick dates again
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Check in
              </span>
              <input
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm outline-none focus:border-ocean"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Check out
              </span>
              <input
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm outline-none focus:border-ocean"
              />
            </label>
          </div>
          <input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-ocean"
          />
          <input
            placeholder="Email"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-ocean"
          />
          {stayNights > 0 && (
            <p className="text-sm text-ink-soft">
              {stayNights} night{stayNights > 1 ? "s" : ""} ·{" "}
              <span className="font-semibold text-ink">{money(estimate, currency)}</span> total
            </p>
          )}
          <button
            onClick={placeHold}
            disabled={phase.name === "holding"}
            className="w-full rounded-lg bg-coral py-2.5 font-semibold text-white transition-colors hover:bg-coral-deep disabled:opacity-60"
          >
            {phase.name === "holding" ? "Holding your dates…" : "Hold these dates"}
          </button>
          <p className="text-xs text-ink-soft">
            Free to hold for 15 minutes. No account needed in this demo.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-amber-warm/30 bg-amber-mist px-3 py-2 text-sm text-amber-warm">
          {error}
        </p>
      )}

      {upcoming.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Already taken
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {upcoming.map((r) => (
              <span
                key={`${r.checkIn}-${r.checkOut}`}
                className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-soft"
              >
                {shortDate(r.checkIn)} to {shortDate(r.checkOut)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
