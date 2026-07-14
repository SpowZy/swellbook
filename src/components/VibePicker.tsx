"use client";

import { VIBES, vibeLabel } from "@/lib/vibes";

export function VibePicker({
  selected,
  onToggle,
  size = "md",
}: {
  selected: string[];
  onToggle: (vibe: string) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div className="flex flex-wrap gap-1.5">
      {VIBES.map((vibe) => {
        const active = selected.includes(vibe);
        return (
          <button
            key={vibe}
            type="button"
            onClick={() => onToggle(vibe)}
            aria-pressed={active}
            className={`rounded-full border font-medium capitalize transition-colors ${pad} ${
              active
                ? "border-ocean bg-ocean text-white"
                : "border-line bg-shell text-ink-soft hover:border-ocean hover:text-ocean"
            }`}
          >
            {vibeLabel(vibe)}
          </button>
        );
      })}
    </div>
  );
}
