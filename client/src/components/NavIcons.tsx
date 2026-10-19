import type { ReactNode } from "react";

/**
 * Sidebar icons drawn to match the Jahit mark: filled two-tone shapes on a 24-unit grid with the logo's
 * corner radius. `.b` is the soft base shape, `.d` the detail on top; CSS colors them (grey at rest,
 * lilac and white when active, like the logo).
 */
function Icon({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg className="nav-ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {children}
    </svg>
  );
}

type P = { size?: number };

/** Lowongan: a magnifier with a little ruler in the lens (measuring the job). */
export const IcLowongan = ({ size }: P) => (
  <Icon size={size}>
    <circle className="b" cx="10.5" cy="10.5" r="7.5" />
    <rect className="d" x="15.2" y="17.6" width="7.2" height="3.4" rx="1.7" transform="rotate(45 18.8 19.3)" />
    <rect className="d" x="6" y="8.4" width="9" height="2" rx="1" />
    {[7, 10.5, 14].map((x) => (
      <rect key={x} className="d" x={x - 0.7} y="9.4" width="1.4" height={x === 10.5 ? 4.2 : 3} rx="0.7" />
    ))}
  </Icon>
);

/** Lamaran: a briefcase. */
export const IcLamaran = ({ size }: P) => (
  <Icon size={size}>
    <rect className="b" x="2.5" y="6.5" width="19" height="14" rx="3.5" />
    <path className="d" d="M8.5 6.5 V5 A2 2 0 0 1 10.5 3 H13.5 A2 2 0 0 1 15.5 5 V6.5 H13.5 V5 H10.5 V6.5 Z" />
    <rect className="d" x="2.5" y="11.5" width="19" height="2" />
    <rect className="d" x="10" y="10.5" width="4" height="4.5" rx="1.2" />
  </Icon>
);

/** Form HR: the logo's folded document with filled-in lines and a tick. */
export const IcForm = ({ size }: P) => (
  <Icon size={size}>
    <path className="b" d="M7 2 H14 L20 8 V19 A3 3 0 0 1 17 22 H7 A3 3 0 0 1 4 19 V5 A3 3 0 0 1 7 2 Z" />
    <path className="d" d="M14 2 V6 A2 2 0 0 0 16 8 H20 Z" />
    <rect className="d" x="7.5" y="11" width="9" height="2" rx="1" />
    <path className="d" d="M7.6 16.6 L9.2 18.2 L12.6 14.8" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

/** Bahan CV: a spool of thread, the material everything is sewn from. */
export const IcBahan = ({ size }: P) => (
  <Icon size={size}>
    <rect className="b" x="6" y="5" width="12" height="14" rx="2" />
    <rect className="d" x="4" y="2.5" width="16" height="3.5" rx="1.75" />
    <rect className="d" x="4" y="18" width="16" height="3.5" rx="1.75" />
    <path className="d" d="M8.5 9 L15.5 12 M8.5 12 L15.5 15" fill="none" strokeWidth="1.8" strokeLinecap="round" />
  </Icon>
);

/** Provider AI: a chip. */
export const IcProvider = ({ size }: P) => (
  <Icon size={size}>
    <rect className="b" x="4.5" y="4.5" width="15" height="15" rx="3.5" />
    <rect className="d" x="9" y="9" width="6" height="6" rx="1.5" />
    {[9, 12, 15].map((v) => (
      <g key={v} className="d">
        <rect x={v - 0.8} y="1.5" width="1.6" height="3" rx="0.8" />
        <rect x={v - 0.8} y="19.5" width="1.6" height="3" rx="0.8" />
        <rect x="1.5" y={v - 0.8} width="3" height="1.6" rx="0.8" />
        <rect x="19.5" y={v - 0.8} width="3" height="1.6" rx="0.8" />
      </g>
    ))}
  </Icon>
);

/** Pemakaian AI: bars on a card. */
export const IcUsage = ({ size }: P) => (
  <Icon size={size}>
    <rect className="b" x="2.5" y="2.5" width="19" height="19" rx="4.5" />
    <rect className="d" x="6.5" y="12" width="2.6" height="6" rx="1.3" />
    <rect className="d" x="10.7" y="6.5" width="2.6" height="11.5" rx="1.3" />
    <rect className="d" x="14.9" y="9.5" width="2.6" height="8.5" rx="1.3" />
  </Icon>
);

/** Pengguna: two people, the one in front drawn solid. */
export const IcUsers = ({ size }: P) => (
  <Icon size={size}>
    <circle className="b" cx="16" cy="7.5" r="3.5" />
    <path className="b" d="M11 20 A5 5 0 0 1 21.5 19.5 V20.5 H11 Z" />
    <circle className="d" cx="9" cy="8" r="4" />
    <path className="d" d="M2.5 20 A6.5 6.5 0 0 1 15.5 20 V21 H2.5 Z" />
  </Icon>
);

/** Tur aplikasi: a question in a bubble. */
export const IcTour = ({ size }: P) => (
  <Icon size={size}>
    <circle className="b" cx="12" cy="12" r="9.5" />
    <path className="d" d="M9.4 9.4 A2.7 2.7 0 1 1 13.2 11.9 C12.4 12.3 12 12.9 12 13.8" fill="none" strokeWidth="2.2" strokeLinecap="round" />
    <circle className="d" cx="12" cy="17.2" r="1.35" />
  </Icon>
);

/** Ciutkan / Lebarkan: a panel with its side bar and a chevron pointing where it goes. */
export const IcPanel = ({ size, open }: P & { open: boolean }) => (
  <Icon size={size}>
    <rect className="b" x="2.5" y="3.5" width="19" height="17" rx="4" />
    <rect className="d" x="2.5" y="3.5" width="6.5" height="17" rx="3" />
    <path className="d" d={open ? "M15.5 9 L12.5 12 L15.5 15" : "M13 9 L16 12 L13 15"} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

/** Keluar: a door with an arrow out. */
export const IcLogout = ({ size }: P) => (
  <Icon size={size}>
    <path className="b" d="M6 3 H13 A2 2 0 0 1 15 5 V19 A2 2 0 0 1 13 21 H6 A3 3 0 0 1 3 18 V6 A3 3 0 0 1 6 3 Z" />
    <path className="d" d="M10 12 H20.5 M17.5 8.5 L21 12 L17.5 15.5" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);
