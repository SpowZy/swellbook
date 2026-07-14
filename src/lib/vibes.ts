export const VIBES = [
  "surf",
  "yoga",
  "kite",
  "wellness",
  "boat-trip",
  "slow-living",
  "adventure",
  "food",
  "community",
  "outdoors",
] as const;

export type Vibe = (typeof VIBES)[number];

export function vibeLabel(tag: string): string {
  return tag.replace(/-/g, " ");
}
