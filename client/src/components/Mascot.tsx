import { useId } from "react";

/**
 * "Jahit", the CV Tailor monster: a wide purple furball dressed for a job hunt (graduation cap,
 * collar and tie, a CV in hand), with one expression per pose. Arms grow from behind the body so no
 * joint ever shows; "shy" brings both paws up over the eyes (used while a password is typed).
 * Pose and gaze changes animate via CSS transitions.
 */
export type MascotPose = "idle" | "wave" | "cheer" | "point-left" | "point-right" | "point-up" | "point-down" | "shy" | "sad";
type Mood = "smile" | "happy" | "joy" | "curious" | "shy" | "sad";

// Arm angles in degrees (0 = hanging straight down; positive swings the left arm outward, negative the right).
const ARMS: Record<MascotPose, [number, number]> = {
  idle: [30, -30],
  wave: [30, -132],
  cheer: [136, -136],
  "point-left": [92, -30],
  "point-right": [30, -92],
  "point-up": [30, -148],
  "point-down": [30, -55],
  shy: [10, -10],
  sad: [14, -14],
};
const GAZE: Record<MascotPose, [number, number]> = {
  idle: [0.1, 0.25],
  wave: [0.2, 0.1],
  cheer: [0, -0.3],
  "point-left": [-1, 0],
  "point-right": [1, 0],
  "point-up": [0.3, -1],
  "point-down": [0.6, 0.8],
  shy: [0, 0],
  sad: [0, 0.8],
};
const MOOD: Record<MascotPose, Mood> = {
  idle: "smile",
  wave: "happy",
  cheer: "joy",
  "point-left": "curious",
  "point-right": "curious",
  "point-up": "curious",
  "point-down": "curious",
  shy: "shy",
  sad: "sad",
};

const BODY = "M120 66 C188 66 228 104 228 152 C228 206 190 236 120 236 C50 236 12 206 12 152 C12 104 52 66 120 66 Z";
// One smooth arm that swells into a paw, from a pivot hidden inside the body at (0, 0).
const ARM = "M-14 0 C-15 26 -17 46 -17 62 C-18 79 -9 87 0 87 C9 87 18 79 17 62 C17 46 15 26 14 0 Z";

// Deterministic pseudo-random numbers so the fur looks the same on every render.
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// Tufts of fur poking out of an ellipse (center cx/cy, radii rx/ry), as one path.
function tufts(cx: number, cy: number, rx: number, ry: number, n: number, len: number, seed: number) {
  const r = rng(seed);
  const f = (v: number) => v.toFixed(1);
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.08;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    let nx = Math.cos(a) / rx;
    let ny = Math.sin(a) / ry;
    const nl = Math.hypot(nx, ny);
    nx /= nl;
    ny /= nl;
    const tx = -ny;
    const ty = nx;
    const w = 6 + r() * 4;
    const l = len * (0.6 + r() * 0.6);
    const bend = (r() - 0.3) * 6;
    d += `M${f(px - tx * w - nx * 4)} ${f(py - ty * w - ny * 4)} Q${f(px - tx * w * 0.3 + nx * l * 0.6)} ${f(py - ty * w * 0.3 + ny * l * 0.6)} ${f(px + nx * l + tx * bend)} ${f(py + ny * l + ty * bend)} Q${f(px + tx * w * 0.5 + nx * l * 0.4)} ${f(py + ty * w * 0.5 + ny * l * 0.4)} ${f(px + tx * w - nx * 4)} ${f(py + ty * w - ny * 4)} Z `;
  }
  return d;
}

// Short light strands scattered near the edge of the body for texture.
function strands(seed: number) {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < 50; i++) {
    const a = r() * Math.PI * 2;
    const k = 0.66 + r() * 0.28;
    const x = 120 + Math.cos(a) * 104 * k;
    const y = 152 + Math.sin(a) * 80 * k;
    const dx = Math.cos(a) * 5 + (r() - 0.5) * 3;
    const dy = Math.sin(a) * 4 + 3;
    d += `M${x.toFixed(1)} ${y.toFixed(1)} q${(dx * 0.4).toFixed(1)} ${(dy * 0.8).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)} `;
  }
  return d;
}

const BODY_TUFTS = tufts(120, 152, 104, 80, 72, 14, 7);
const BODY_TUFTS_IN = tufts(120, 152, 100, 76, 60, 10, 21);
const STRANDS = strands(5);
const ARM_TUFTS = (() => {
  const r = rng(3);
  let d = "";
  for (let y = 4; y < 60; y += 7) {
    for (const side of [-1, 1]) {
      const x = side * 14;
      const l = 5 + r() * 4;
      d += `M${x} ${y - 4} Q${x + side * l} ${y + 1} ${x + side * (l - 2)} ${y + 7} L${x} ${y + 6} Z `;
    }
  }
  return d;
})();

function Arm({ x, angle, wave, hidden, holding, u }: { x: number; angle: number; wave: boolean; hidden: boolean; holding: boolean; u: (n: string) => string }) {
  return (
    <g transform={`translate(${x} 150)`}>
      <g className="mascot-arm" style={{ transform: `rotate(${angle}deg)`, opacity: hidden ? 0 : 1 }}>
        <g className={wave ? "mascot-wave" : undefined}>
          {holding && (
            // A CV held upright, so counter-rotate it against the arm.
            <g className="mascot-cv" transform={`translate(0 76) rotate(${-angle - 8})`}>
              <rect x="-15" y="-40" width="30" height="38" rx="3" fill="#fbfaff" stroke="#c9c2e8" strokeWidth="1" />
              <rect x="-10" y="-34" width="10" height="10" rx="2" fill="#c7a6ff" />
              <g stroke="#b9b2d6" strokeWidth="2" strokeLinecap="round">
                <path d="M3 -32 h7" />
                <path d="M3 -27 h5" />
                <path d="M-10 -19 h20" />
                <path d="M-10 -14 h16" />
                <path d="M-10 -9 h18" />
              </g>
            </g>
          )}
          <path d={ARM_TUFTS} fill="#9a55e6" />
          <path d={ARM} fill={`url(#${u("paw")})`} filter={`url(#${u("fuzz")})`} />
          <g stroke="#6c2bc4" strokeOpacity="0.5" strokeWidth="1.8" strokeLinecap="round" fill="none">
            <path d="M-5 76 q-0.5 5 -1 9" />
            <path d="M5 76 q0.5 5 1 9" />
          </g>
          <ellipse cx="-5" cy="68" rx="5" ry="3" fill="#fff" opacity="0.3" />
        </g>
      </g>
    </g>
  );
}

function Eye({ cx, cy, gx, gy, mood, u }: { cx: number; cy: number; gx: number; gy: number; mood: Mood; u: (n: string) => string }) {
  // Joy squeezes the eyes shut into happy arcs.
  if (mood === "joy") {
    return <path d={`M${cx - 16} ${cy + 4} Q${cx} ${cy - 16} ${cx + 16} ${cy + 4}`} stroke="#2a0b55" strokeWidth="6" strokeLinecap="round" fill="none" />;
  }
  const clip = u(`eye${cx}`);
  // A relaxed upper lid hides the top of the eye so it never reads as a stare; sad droops it.
  const lid = mood === "curious" ? cy - 30 : mood === "sad" ? cy - 12 : cy - 22;
  const tilt = mood === "sad" ? (cx < 120 ? -8 : 8) : 0;
  return (
    <g className="mascot-eye" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <ellipse cx={cx} cy={cy + 3} rx="25" ry="26" fill="#5a1fae" opacity="0.35" />
      <ellipse cx={cx} cy={cy} rx="23" ry="25" fill={`url(#${u("sclera")})`} />
      <clipPath id={clip}>
        <ellipse cx={cx} cy={cy} rx="23" ry="25" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g className="mascot-gaze" style={{ transform: `translate(${gx * 5}px, ${gy * 5}px)` }}>
          <g className="mascot-look">
            <circle cx={cx} cy={cy + 3} r="17" fill={`url(#${u("iris")})`} />
            <circle cx={cx} cy={cy + 3} r="12.5" fill="#0a0716" />
            <circle cx={cx + 5.5} cy={cy - 3} r="5.8" fill="#fff" />
            <circle cx={cx - 5} cy={cy + 9} r="2.8" fill="#fff" opacity="0.9" />
          </g>
        </g>
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform .3s" }}>
          <path d={`M${cx - 30} ${lid - 24} H${cx + 30} V${lid} Q${cx} ${lid + 9} ${cx - 30} ${lid} Z`} fill={`url(#${u("fur")})`} />
          <path d={`M${cx - 30} ${lid} Q${cx} ${lid + 9} ${cx + 30} ${lid}`} stroke="#5a1fae" strokeWidth="2.2" fill="none" />
        </g>
      </g>
    </g>
  );
}

function Mouth({ mood, u }: { mood: Mood; u: (n: string) => string }) {
  const lip = "#5a1fae";
  if (mood === "smile" || mood === "shy") {
    return (
      <g>
        <path
          d="M112.5 157.6 h7 v6 a2.5 2.5 0 0 1 -2.5 2.5 h-2 a2.5 2.5 0 0 1 -2.5 -2.5 Z M120.5 157.6 h7 v6 a2.5 2.5 0 0 1 -2.5 2.5 h-2 a2.5 2.5 0 0 1 -2.5 -2.5 Z"
          fill="#fffaf0"
        />
        <path d="M100 150 Q120 168 140 150" stroke={lip} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </g>
    );
  }
  if (mood === "sad") {
    return <path d="M104 162 Q120 150 136 162" stroke={lip} strokeWidth="4.5" strokeLinecap="round" fill="none" />;
  }
  if (mood === "curious") {
    return (
      <g>
        <ellipse cx="120" cy="160" rx="9" ry="10.5" fill={`url(#${u("mouth")})`} stroke={lip} strokeWidth="3" />
        <ellipse cx="120" cy="165" rx="5.5" ry="3.5" fill="#ff7aa2" />
      </g>
    );
  }
  const big = mood === "joy";
  const d = big ? "M94 146 Q120 152 146 146 Q144 184 120 186 Q96 184 94 146 Z" : "M98 148 Q120 153 142 148 Q140 176 120 178 Q100 176 98 148 Z";
  const clip = u("mouthclip");
  return (
    <g>
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={`url(#${u("mouth")})`} />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx="120" cy={big ? 186 : 178} rx="20" ry="11" fill="#ff7aa2" />
        <rect x="109" y="146" width="10" height="11" rx="3" fill="#fffaf0" />
        <rect x="121" y="146" width="10" height="11" rx="3" fill="#fffaf0" />
      </g>
      <path d={d} fill="none" stroke={lip} strokeWidth="3.5" strokeLinejoin="round" />
    </g>
  );
}

function Brows({ mood }: { mood: Mood }) {
  const up = mood === "curious" || mood === "joy" ? -6 : 0;
  const sad = mood === "sad";
  return (
    <g className="mascot-brows" stroke="#5a1fae" strokeWidth="4.5" strokeLinecap="round" fill="none" style={{ transform: `translateY(${up}px)` }}>
      <path d={sad ? "M74 70 Q86 70 96 62" : "M74 70 Q84 64 96 68"} />
      <path d={sad ? "M144 62 Q154 70 166 70" : "M144 68 Q156 64 166 70"} />
    </g>
  );
}

/** Paws that come up over the eyes for the "shy" pose. */
function CoverPaws({ show, u }: { show: boolean; u: (n: string) => string }) {
  return (
    <g className="mascot-cover" style={{ transform: `translateY(${show ? 0 : 90}px)`, opacity: show ? 1 : 0 }}>
      {[88, 152].map((cx) => (
        // Mitten paw tilted toward the middle of the face, with three plump fingers on top.
        <g key={cx} transform={`rotate(${cx < 120 ? 12 : -12} ${cx} 110)`}>
          {[-14, 0, 14].map((d) => (
            <ellipse key={d} cx={cx + d} cy={d === 0 ? 84 : 88} rx="9.5" ry="11" fill={`url(#${u("toe")})`} stroke="#7a32c8" strokeOpacity="0.55" strokeWidth="1.6" />
          ))}
          <ellipse cx={cx} cy={110} rx="27" ry="23" fill={`url(#${u("toe")})`} stroke="#7a32c8" strokeOpacity="0.55" strokeWidth="1.6" />
          <ellipse cx={cx - 8} cy={100} rx="8" ry="4.5" fill="#fff" opacity="0.35" />
        </g>
      ))}
    </g>
  );
}

export function Mascot({
  size = 160,
  pose = "idle",
  look,
  className,
}: {
  size?: number;
  pose?: MascotPose;
  /** Override the gaze, each axis from -1 to 1 (e.g. follow a caret). */
  look?: [number, number];
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const u = (n: string) => `${n}-${uid}`;
  const [la, ra] = ARMS[pose];
  const [gx, gy] = look || GAZE[pose];
  const mood = MOOD[pose];
  const shy = pose === "shy";

  return (
    <svg
      className={`mascot pose-${pose} ${className || ""}`}
      width={size}
      height={size * (262 / 300)}
      viewBox="-30 -4 300 262"
      role="img"
      aria-label="Jahit, maskot CV Tailor"
    >
      <defs>
        <radialGradient id={u("fur")} cx="0.4" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#dca6ff" />
          <stop offset="0.45" stopColor="#b06cf2" />
          <stop offset="1" stopColor="#6c2bc4" />
        </radialGradient>
        <radialGradient id={u("furU")} gradientUnits="userSpaceOnUse" cx="100" cy="100" r="200">
          <stop offset="0" stopColor="#d49cff" />
          <stop offset="0.45" stopColor="#a35fec" />
          <stop offset="1" stopColor="#5a1fae" />
        </radialGradient>
        <radialGradient id={u("paw")} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#dfb0ff" />
          <stop offset="1" stopColor="#9d58e8" />
        </radialGradient>
        <radialGradient id={u("toe")} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f0c6ff" />
          <stop offset="1" stopColor="#c27ff0" />
        </radialGradient>
        <linearGradient id={u("horn")} x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0" stopColor="#e568b4" />
          <stop offset="1" stopColor="#ffc6e6" />
        </linearGradient>
        <radialGradient id={u("iris")} cx="0.45" cy="0.7" r="0.7">
          <stop offset="0" stopColor="#9ff1ff" />
          <stop offset="0.55" stopColor="#2ab6f0" />
          <stop offset="1" stopColor="#1564c4" />
        </radialGradient>
        <radialGradient id={u("sclera")} cx="0.42" cy="0.36" r="0.7">
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d3f0" />
        </radialGradient>
        <linearGradient id={u("mouth")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f0a2e" />
          <stop offset="1" stopColor="#7d1747" />
        </linearGradient>
        <linearGradient id={u("tie")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#2f55d4" />
        </linearGradient>
        <linearGradient id={u("cap")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3566" />
          <stop offset="1" stopColor="#1b1838" />
        </linearGradient>
        <radialGradient id={u("rim")} cx="0.5" cy="0.4" r="0.62">
          <stop offset="0.62" stopColor="#1a0640" stopOpacity="0" />
          <stop offset="1" stopColor="#1a0640" stopOpacity="0.45" />
        </radialGradient>
        <clipPath id={u("bodyclip")}>
          <path d={BODY} />
        </clipPath>
        {/* Fuzzy edge: displace the silhouette with fine noise */}
        <filter id={u("fuzz")} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Fur grain: stretched noise turned into faint strands */}
        <filter id={u("grain")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.45" numOctaves="1" seed="9" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.75" />
        </filter>
      </defs>

      <ellipse cx="120" cy="250" rx="100" ry="9" fill="#05030f" opacity="0.4" />

      <g className="mascot-bob">
        <g className="mascot-breathe">
          {/* arms sit behind the body, so only the paws and forearms show */}
          <Arm x={50} angle={la} wave={false} hidden={shy} holding={la <= 30 && !shy} u={u} />
          <Arm x={190} angle={ra} wave={pose === "wave"} hidden={shy} holding={false} u={u} />

          {/* pink horns */}
          {[1, -1].map((s) => (
            <g key={s} transform={s === -1 ? "translate(240 0) scale(-1 1)" : undefined}>
              <g transform="translate(-28 34)">
                <path d="M80 66 C62 54 54 32 64 8 C68 6 71 8 71 11 C71 30 86 44 102 52 Z" fill={`url(#${u("horn")})`} />
                <g stroke="#c94f98" strokeWidth="2" strokeLinecap="round" opacity="0.35" fill="none">
                  <path d="M63 26 q5 3 9 0" />
                  <path d="M65 38 q6 3 11 0" />
                  <path d="M71 50 q6 2 11 -1" />
                </g>
              </g>
            </g>
          ))}

          {/* feet with little claws */}
          {[80, 160].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="232" rx="30" ry="15" fill={`url(#${u("fur")})`} filter={`url(#${u("fuzz")})`} />
              {[-14, 0, 14].map((d) => (
                <g key={d}>
                  <ellipse cx={x + d} cy="242" rx="7" ry="5.5" fill={`url(#${u("toe")})`} />
                  <path d={`M${x + d - 2.5} 246 L${x + d} 252 L${x + d + 2.5} 246 Z`} fill="#fff4e0" />
                </g>
              ))}
            </g>
          ))}

          {/* furry body: two rings of tufts under a fuzzy fill */}
          <path d={BODY_TUFTS} fill={`url(#${u("furU")})`} />
          <path d={BODY_TUFTS_IN} fill={`url(#${u("furU")})`} />
          <g filter={`url(#${u("fuzz")})`}>
            <path d={BODY} fill={`url(#${u("fur")})`} />
            <path d={BODY} fill={`url(#${u("rim")})`} />
          </g>
          <g clipPath={`url(#${u("bodyclip")})`}>
            <rect x="12" y="66" width="216" height="170" filter={`url(#${u("grain")})`} opacity="0.16" />
          </g>
          <path d={STRANDS} stroke="#f0d4ff" strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <ellipse cx="92" cy="96" rx="52" ry="20" fill="#fff" opacity="0.12" />

          {/* collar and tie: dressed for the interview */}
          <g>
            <path d="M96 200 L120 210 L108 222 Z" fill="#fbfaff" />
            <path d="M144 200 L120 210 L132 222 Z" fill="#fbfaff" />
            <path d="M114 208 L126 208 L124 216 L116 216 Z" fill="#2f55d4" />
            <path d="M116 216 L124 216 L129 234 L120 242 L111 234 Z" fill={`url(#${u("tie")})`} />
            <path d="M115 224 L127 219 M113 231 L128 225" stroke="#a9c2ff" strokeWidth="1.6" opacity="0.6" />
          </g>

          <g className="mascot-face" transform="translate(0 26)">
            <ellipse cx="62" cy="146" rx="10" ry="6" fill="#ff7ab6" opacity={shy ? 0.75 : 0.4} />
            <ellipse cx="178" cy="146" rx="10" ry="6" fill="#ff7ab6" opacity={shy ? 0.75 : 0.4} />
            <Brows mood={mood} />
            <Eye cx={88} cy={104} gx={gx} gy={gy} mood={mood} u={u} />
            <Eye cx={152} cy={104} gx={gx} gy={gy} mood={mood} u={u} />
            <Mouth mood={mood} u={u} />
            <CoverPaws show={shy} u={u} />
          </g>

          {/* graduation cap with a swinging tassel */}
          <g className="mascot-cap">
            <path d="M90 58 L150 58 L150 76 Q120 90 90 76 Z" fill={`url(#${u("cap")})`} />
            <path d="M62 56 L120 34 L178 56 L120 78 Z" fill={`url(#${u("cap")})`} />
            <path d="M62 56 L120 34 L178 56" stroke="#5b5694" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
            <circle cx="120" cy="56" r="3.5" fill="#f3c372" />
            <g className="mascot-tassel">
              <path d="M120 56 Q150 58 170 60 L170 84" stroke="#f3c372" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M165 82 h10 l2 14 h-14 Z" fill="#f3c372" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
