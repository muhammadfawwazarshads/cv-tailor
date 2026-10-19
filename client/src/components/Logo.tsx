import { useId } from "react";

/**
 * The Jahit mark: a soft document with a folded corner. Inside, one line of text and one continuous
 * thread that weaves like a running stitch and ends in a needle. All strokes share one width and round
 * caps, the body carries a gentle lilac gradient with a warm glow at the bottom.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const body = `lb-${id}`;
  const glow = `lg-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9b6dff" />
          <stop offset="1" stopColor="#7c4dff" />
        </linearGradient>
        <radialGradient id={glow} cx="0.3" cy="1" r="0.75">
          <stop offset="0" stopColor="#ffb3dc" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffb3dc" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* page, its top-right corner folded */}
      <path d="M21 3 H37 L55 21 V51 A10 10 0 0 1 45 61 H21 A10 10 0 0 1 11 51 V13 A10 10 0 0 1 21 3 Z" fill={`url(#${body})`} />
      <path d="M21 3 H37 L55 21 V51 A10 10 0 0 1 45 61 H21 A10 10 0 0 1 11 51 V13 A10 10 0 0 1 21 3 Z" fill={`url(#${glow})`} />
      <path d="M37 3 V15 A6 6 0 0 0 43 21 H55 Z" fill="#cdb6ff" />
      {/* a line of text, then the thread weaving through the page and out through the needle */}
      <path d="M21 34 H39" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" fill="none" />
      <path d="M21 46 C24.5 41 27.5 41 30 46 S35.5 51 39 46 L42.5 42.5" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* the needle: tapered, its eye where the thread comes out */}
      <g transform="rotate(-45 42.5 42.5)">
        <path d="M40.3 42.5 A2.2 2.2 0 0 1 42.5 40.3 H50 L56 42.5 L50 44.7 H42.5 A2.2 2.2 0 0 1 40.3 42.5 Z" fill="#fff" />
        <rect x="41.6" y="41.75" width="4.6" height="1.5" rx="0.75" fill="#8a5cff" />
      </g>
    </svg>
  );
}
