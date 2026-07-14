"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BlockDatesForm({
  dashboardKey,
  listingId,
}: {
  dashboardKey: string;
  listingId: string;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function block() {
    setMessage(null);
    if (!from || !to) {
      setMessage("Pick both dates.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardKey, listingId, from, to }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not block those dates.");
      } else {
        setFrom("");
        setTo("");
        router.refresh();
      }
    } catch {
      setMessage("Network hiccup, try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Block from
          </span>
          <input
            type="date"
            min={today}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input w-auto"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Until
          </span>
          <input
            type="date"
            min={from || today}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input w-auto"
          />
        </label>
        <button
          onClick={block}
          disabled={busy}
          className="h-[38px] rounded-lg border border-line px-4 text-sm font-medium hover:border-ocean hover:text-ocean disabled:opacity-50"
        >
          {busy ? "Blocking…" : "Block these dates"}
        </button>
      </div>
      {message && (
        <p className="mt-2 rounded-lg border border-amber-warm/30 bg-amber-mist px-3 py-2 text-sm text-amber-warm">
          {message}
        </p>
      )}
    </div>
  );
}

export function CancelBlockButton({
  dashboardKey,
  reservationId,
}: {
  dashboardKey: string;
  reservationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/api/blocks/${reservationId}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dashboardKey }),
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="text-xs font-medium text-ink-soft hover:text-coral disabled:opacity-50"
    >
      {busy ? "Removing…" : "Remove block"}
    </button>
  );
}
