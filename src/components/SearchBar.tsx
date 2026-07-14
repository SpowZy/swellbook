"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VibePicker } from "./VibePicker";

const BUDGETS = [
  { label: "Any budget", value: "" },
  { label: "Up to $75 a night", value: "7500" },
  { label: "Up to $100 a night", value: "10000" },
  { label: "Up to $150 a night", value: "15000" },
  { label: "Up to $250 a night", value: "25000" },
];

export type SearchState = {
  checkIn: string;
  checkOut: string;
  budget: string;
  vibes: string[];
};

export function SearchBar({ initial }: { initial: SearchState }) {
  const router = useRouter();
  const [state, setState] = useState<SearchState>(initial);
  const today = new Date().toISOString().slice(0, 10);
  const hasFilters = Boolean(
    state.checkIn || state.checkOut || state.budget || state.vibes.length
  );

  function submit(next: SearchState) {
    const params = new URLSearchParams();
    if (next.checkIn && next.checkOut) {
      params.set("from", next.checkIn);
      params.set("to", next.checkOut);
    }
    if (next.budget) params.set("budget", next.budget);
    for (const vibe of next.vibes) params.append("vibe", vibe);
    router.push(params.size ? `/?${params.toString()}` : "/");
  }

  return (
    <form
      className="rounded-2xl border border-line bg-shell p-4 shadow-sm sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(state);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Check in
          </span>
          <input
            type="date"
            min={today}
            value={state.checkIn}
            onChange={(e) => setState((s) => ({ ...s, checkIn: e.target.value }))}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-ocean"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Check out
          </span>
          <input
            type="date"
            min={state.checkIn || today}
            value={state.checkOut}
            onChange={(e) => setState((s) => ({ ...s, checkOut: e.target.value }))}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-ocean"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Budget
          </span>
          <select
            value={state.budget}
            onChange={(e) => setState((s) => ({ ...s, budget: e.target.value }))}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-ocean"
          >
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-[38px] rounded-lg bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-deep"
          >
            Search
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                const cleared = { checkIn: "", checkOut: "", budget: "", vibes: [] };
                setState(cleared);
                submit(cleared);
              }}
              className="h-[38px] rounded-lg border border-line px-3 text-sm text-ink-soft hover:border-ink-soft"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="mt-3">
        <VibePicker
          size="sm"
          selected={state.vibes}
          onToggle={(vibe) =>
            setState((s) => ({
              ...s,
              vibes: s.vibes.includes(vibe) ? s.vibes.filter((v) => v !== vibe) : [...s.vibes, vibe],
            }))
          }
        />
      </div>
    </form>
  );
}
