import { useId } from "react";

/** The CV Tailor mark: Jahit's head (horns, eyes, grin) under a graduation cap, simplified to read at 24px. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <defs>
        <radialGradient id={`lg-${id}`} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#dca6ff" />
          <stop offset="0.55" stopColor="#a35fec" />
          <stop offset="1" stopColor="#6c2bc4" />
        </radialGradient>
      </defs>
      <path d="M13 30 C6 24 5 15 9 9 C11 16 15 21 21 24 Z" fill="#ff9ccf" />
      <path d="M51 30 C58 24 59 15 55 9 C53 16 49 21 43 24 Z" fill="#ff9ccf" />
      <ellipse cx="32" cy="38" rx="25" ry="21" fill={`url(#lg-${id})`} />
      <ellipse cx="23.5" cy="36" rx="7.5" ry="8" fill="#fff" />
      <ellipse cx="40.5" cy="36" rx="7.5" ry="8" fill="#fff" />
      <circle cx="24.5" cy="37.5" r="4.6" fill="#0a0716" />
      <circle cx="41.5" cy="37.5" r="4.6" fill="#0a0716" />
      <circle cx="26" cy="35.5" r="1.6" fill="#fff" />
      <circle cx="43" cy="35.5" r="1.6" fill="#fff" />
      <path d="M25 48 Q32 54 39 48" stroke="#3b1170" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M29.5 50.4 h2.2 v2.4 h-2.2 Z M32.3 50.4 h2.2 v2.4 h-2.2 Z" fill="#fff" />
      <path d="M12 16 L32 8 L52 16 L32 24 Z" fill="#1d1a3c" stroke="#6b64b0" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M22 19.5 L42 19.5 L42 25 Q32 29 22 25 Z" fill="#1d1a3c" />
      <path d="M32 16 L49 17.5 L49 26" stroke="#f3c372" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="49" cy="27.5" r="2.2" fill="#f3c372" />
    </svg>
  );
}
