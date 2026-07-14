"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CoverArt } from "./CoverArt";
import { VibePicker } from "./VibePicker";

type Draft = {
  name: string;
  place: string;
  country: string;
  capacity: string;
  price: string;
  hostName: string;
  hostStory: string;
  story: string;
  vibes: string[];
  hue: number;
};

const EMPTY: Draft = {
  name: "",
  place: "",
  country: "",
  capacity: "8",
  price: "",
  hostName: "",
  hostStory: "",
  story: "",
  vibes: [],
  hue: 190,
};

const STEPS = ["Your place", "Your story", "The vibe", "Go live"] as const;

export function HostWizard() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ slug: string; dashboardKey: string; seconds: number } | null>(null);
  const startedAt = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  // The "live in X seconds" clock starts when the host opens the wizard.
  useEffect(() => {
    if (startedAt.current === null) startedAt.current = Date.now();
  }, []);

  function patch(partial: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!draft.name.trim() || !draft.place.trim() || !draft.country.trim()) {
        setError("Give your place a name, a location and a country.");
        return;
      }
      if (!Number(draft.price) || Number(draft.price) <= 0) {
        setError("Set a nightly price in dollars.");
        return;
      }
    }
    if (step === 1) {
      if (!draft.hostName.trim() || !draft.hostStory.trim() || !draft.story.trim()) {
        setError("Travelers book people, not rooms. Tell them who you are and what the place is like.");
        return;
      }
    }
    if (step === 2 && draft.vibes.length === 0) {
      setError("Pick at least one vibe so the right travelers find you.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function publish() {
    setError(null);
    setPublishing(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: draft.hostName,
          hostStory: draft.hostStory,
          name: draft.name,
          place: draft.place,
          country: draft.country,
          capacity: Number(draft.capacity),
          pricePerNightCents: Math.round(Number(draft.price) * 100),
          vibeTags: draft.vibes,
          story: draft.story,
          hue: draft.hue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not publish. Try again.");
        setPublishing(false);
        return;
      }
      setPublished({
        slug: data.slug,
        dashboardKey: data.dashboardKey,
        seconds: Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000),
      });
    } catch {
      setError("Network hiccup. Your draft is still here, try publishing again.");
      setPublishing(false);
    }
  }

  if (published) {
    const mins = Math.floor(published.seconds / 60);
    const secs = published.seconds % 60;
    return (
      <div className="rounded-3xl border border-line bg-shell p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-moss-mist text-2xl text-moss">
          ✓
        </div>
        <h2 className="mt-4 font-display text-3xl font-semibold">
          {draft.name} is live and bookable.
        </h2>
        <p className="mt-2 text-ink-soft">
          From first click to live listing in{" "}
          <span className="font-semibold text-ink">
            {mins > 0 ? `${mins} min ${secs} sec` : `${secs} seconds`}
          </span>
          . No forms mailed to support, no waiting for approval.
        </p>
        <div className="mt-6 space-y-3">
          <Link
            href={`/stay/${published.slug}`}
            className="block rounded-lg bg-coral px-5 py-2.5 text-center font-semibold text-white hover:bg-coral-deep"
          >
            See your live listing
          </Link>
          <Link
            href={`/host/dashboard/${published.dashboardKey}`}
            className="block rounded-lg border border-line px-5 py-2.5 text-center font-medium hover:border-ocean hover:text-ocean"
          >
            Open your dashboard
          </Link>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${window.location.origin}/host/dashboard/${published.dashboardKey}`
              );
              setCopied(true);
            }}
            className="w-full rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft hover:border-ocean hover:text-ocean"
          >
            {copied ? "Copied. Keep it somewhere safe." : "Copy your private dashboard link"}
          </button>
          <p className="text-xs text-ink-soft">
            That private link is your key in this demo. In production this becomes a real account
            with email sign-in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-shell p-6 sm:p-8">
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i < step
                  ? "bg-moss text-white"
                  : i === step
                    ? "bg-ink text-canvas"
                    : "bg-sand text-ink-soft"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={`text-sm ${i === step ? "font-semibold" : "text-ink-soft"} hidden sm:inline`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-line sm:w-8" />}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Name of your place">
              <input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Cloudbreak Garden Lodge"
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Where is it? (town, region)">
                <input
                  value={draft.place}
                  onChange={(e) => patch({ place: e.target.value })}
                  placeholder="Santa Teresa, Puntarenas"
                  className="input"
                />
              </Field>
              <Field label="Country">
                <input
                  value={draft.country}
                  onChange={(e) => patch({ country: e.target.value })}
                  placeholder="Costa Rica"
                  className="input"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price per night (USD)">
                <input
                  type="number"
                  min={1}
                  value={draft.price}
                  onChange={(e) => patch({ price: e.target.value })}
                  placeholder="95"
                  className="input"
                />
              </Field>
              <Field label="Max guests">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={draft.capacity}
                  onChange={(e) => patch({ capacity: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Your first name">
              <input
                value={draft.hostName}
                onChange={(e) => patch({ hostName: e.target.value })}
                placeholder="Valeria"
                className="input"
              />
            </Field>
            <Field label="Your story (travelers book people, not rooms)">
              <textarea
                value={draft.hostStory}
                onChange={(e) => patch({ hostStory: e.target.value })}
                rows={3}
                placeholder="I ran wellness programs at a big resort until I decided small was better…"
                className="input resize-none"
              />
            </Field>
            <Field label="What is staying with you actually like?">
              <textarea
                value={draft.story}
                onChange={(e) => patch({ story: e.target.value })}
                rows={4}
                placeholder="The day is built around two tides and one long lunch…"
                className="input resize-none"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Field label="Pick the vibes that fit (travelers filter by these)">
              <VibePicker
                selected={draft.vibes}
                onToggle={(vibe) =>
                  patch({
                    vibes: draft.vibes.includes(vibe)
                      ? draft.vibes.filter((v) => v !== vibe)
                      : [...draft.vibes, vibe],
                  })
                }
              />
            </Field>
            <Field label="Pick your cover light (photos come later)">
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="aspect-[21/9]">
                  <CoverArt hue={draft.hue} />
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                value={draft.hue}
                onChange={(e) => patch({ hue: Number(e.target.value) })}
                className="mt-3 w-full accent-ocean"
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="aspect-[21/9]">
                <CoverArt hue={draft.hue} />
              </div>
            </div>
            <h3 className="mt-4 font-display text-2xl font-semibold">{draft.name}</h3>
            <p className="text-ink-soft">
              {draft.place} · ${draft.price} a night · up to {draft.capacity} guests
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink">{draft.story}</p>
            <p className="mt-3 rounded-xl bg-ocean-mist p-3 text-sm text-ocean-deep">
              Zero commission: what travelers pay is yours. Swellbook charges hosts a flat
              membership instead, and the guest relationship belongs to you.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-warm/30 bg-amber-mist px-3 py-2 text-sm text-amber-warm">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-ink-soft disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-canvas hover:bg-ocean-deep"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="rounded-lg bg-coral px-5 py-2 text-sm font-semibold text-white hover:bg-coral-deep disabled:opacity-60"
          >
            {publishing ? "Publishing…" : "Publish and go live"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
