/**
 * The Jahit mark: a CV sheet with a running stitch around its edge and a needle pulling the thread
 * through its corner, i.e. a CV being tailored. Same picture as the welcome scene; reads down to 20px.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="16" fill="#c7a6ff" />
      {/* the CV sheet */}
      <rect x="14" y="9" width="32" height="44" rx="4" fill="#fbf8f2" />
      <circle cx="21.5" cy="17.5" r="3.2" fill="#1d0f38" />
      <rect x="27" y="15" width="13" height="3" rx="1.5" fill="#1d0f38" />
      <rect x="27" y="20" width="9" height="2.2" rx="1.1" fill="#8d84a8" />
      <rect x="19" y="27" width="21" height="2.4" rx="1.2" fill="#8d84a8" />
      <rect x="19" y="32" width="16" height="2.4" rx="1.2" fill="#8d84a8" />
      {/* running stitch along the left and bottom edge, sewn up to the needle */}
      <path d="M17.5 13 V48.5 H36" stroke="#6c2bc4" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="3.2 2.8" fill="none" />
      {/* the needle, going in at the bottom-right corner, with its thread */}
      <path d="M38 47 C42 44 46 47 50 45" stroke="#6c2bc4" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M33.5 51.5 L52 33 C53.2 31.8 55.2 33.8 54 35 L35.5 53.5 Z" fill="#1d0f38" />
      <ellipse cx="51.6" cy="35.4" rx="1.9" ry="0.85" transform="rotate(-45 51.6 35.4)" fill="#c7a6ff" />
    </svg>
  );
}
