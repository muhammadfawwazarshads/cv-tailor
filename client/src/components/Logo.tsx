/**
 * The Jahit mark, drawn on a 64-unit grid: a document with a folded corner, a running stitch cut out of
 * it, and a needle crossing its lower edge (separated by a background-colored gap). Two colors only.
 */
const BG = "#c7a6ff";
const INK = "#1d0f38";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="15" fill={BG} />
      {/* document with the top-right corner folded */}
      <path d="M20 12 H34 L44 22 V47 A3 3 0 0 1 41 50 H20 A3 3 0 0 1 17 47 V15 A3 3 0 0 1 20 12 Z" fill={INK} />
      <path d="M34 12 V19 A3 3 0 0 0 37 22 H44" fill={BG} fillOpacity="0.55" />
      {/* running stitch, cut out of the page, ending where the needle went in */}
      <path d="M21.5 33 H36" stroke={BG} strokeWidth="2.5" strokeDasharray="3.5 2.5" />
      {/* needle at 45 degrees, tip on the seam, eye outside the page; a background-colored gap keeps it apart */}
      <g transform="rotate(45 37 33)">
        <rect x="35" y="29.6" width="28.5" height="6.8" rx="3.4" fill={BG} />
        <path d="M37 33 L42 31.2 H59.7 A1.8 1.8 0 0 1 59.7 34.8 H42 Z" fill={INK} />
        <rect x="52" y="32.3" width="5.6" height="1.4" rx="0.7" fill={BG} />
      </g>
    </svg>
  );
}
