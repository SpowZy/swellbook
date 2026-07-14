/**
 * Generative cover art keyed on the listing's hue, so the catalog stays
 * self-contained: no image hosting, no broken photos, and every listing
 * still gets its own light. Hosts would upload real photos in production.
 */
export function CoverArt({ hue, className = "" }: { hue: number; className?: string }) {
  const sky = `hsl(${hue} 60% 78%)`;
  const horizon = `hsl(${(hue + 24) % 360} 52% 58%)`;
  const deep = `hsl(${(hue + 38) % 360} 48% 42%)`;
  const id = `g-${hue}`;
  return (
    <svg
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky} />
          <stop offset="62%" stopColor={horizon} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${id})`} />
      <circle cx="316" cy="64" r="34" fill="#faf7f1" opacity="0.55" />
      <path
        d="M0 170 C 60 150, 110 190, 170 172 S 290 150, 400 176 L 400 260 L 0 260 Z"
        fill="#faf7f1"
        opacity="0.16"
      />
      <path
        d="M0 198 C 70 182, 130 214, 200 198 S 330 180, 400 202 L 400 260 L 0 260 Z"
        fill="#faf7f1"
        opacity="0.24"
      />
      <path
        d="M0 228 C 80 214, 150 240, 230 226 S 350 212, 400 228 L 400 260 L 0 260 Z"
        fill="#faf7f1"
        opacity="0.4"
      />
    </svg>
  );
}
