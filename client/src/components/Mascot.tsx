import { useId } from "react";

/**
 * "Jahit", the CV Tailor monster: a round purple furball with big bulging eyes, a wide toothy grin,
 * pink horns and posable arms so it can guide the tour. Pose and gaze changes animate via CSS transitions.
 */
export type MascotPose = "idle" | "wave" | "cheer" | "point-left" | "point-right" | "point-up" | "point-down";

// Arm angles in degrees (0 = hanging down; positive swings the left arm outward, negative the right).
const ARMS: Record<MascotPose, [number, number]> = {
  idle: [18, -18],
  wave: [18, -150],
  cheer: [150, -150],
  "point-left": [92, -18],
  "point-right": [18, -92],
  "point-up": [18, -170],
  "point-down": [18, -48],
};
const GAZE: Record<MascotPose, [number, number]> = {
  idle: [0.1, 0.25],
  wave: [0.2, 0.1],
  cheer: [0, -0.3],
  "point-left": [-1, 0],
  "point-right": [1, 0],
  "point-up": [0.3, -1],
  "point-down": [0.6, 0.8],
};

const BODY = "M120 34 C178 34 206 80 208 134 C210 190 196 240 120 242 C44 240 30 190 32 134 C34 80 62 34 120 34 Z";
// Short stubby arm from the shoulder at (0, 0) down to the wrist; the paw is drawn on top.
const ARM = "M-17 -8 C-19 16 -18 32 -15 46 L15 46 C18 32 19 16 17 -8 Z";

// Deterministic pseudo-random numbers so the fur looks the same on every render.
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// Tufts of fur poking out of an ellipse (center cx/cy, radii rx/ry), as one path.
function tufts(cx: number, cy: number, rx: number, ry: number, n: number, len: number, seed: number) {
  const r = rng(seed);
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
    const tipX = px + nx * l + tx * bend;
    const tipY = py + ny * l + ty * bend;
    const f = (v: number) => v.toFixed(1);
    d += `M${f(px - tx * w - nx * 4)} ${f(py - ty * w - ny * 4)} Q${f(px - tx * w * 0.3 + nx * l * 0.6)} ${f(py - ty * w * 0.3 + ny * l * 0.6)} ${f(tipX)} ${f(tipY)} Q${f(px + tx * w * 0.5 + nx * l * 0.4)} ${f(py + ty * w * 0.5 + ny * l * 0.4)} ${f(px + tx * w - nx * 4)} ${f(py + ty * w - ny * 4)} Z `;
  }
  return d;
}

// Short light strands scattered over the body for texture.
function strands(seed: number) {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const k = 0.62 + r() * 0.3;
    const x = 120 + Math.cos(a) * 84 * k;
    const y = 140 + Math.sin(a) * 98 * k;
    const dx = Math.cos(a) * 5 + (r() - 0.5) * 3;
    const dy = Math.sin(a) * 5 + 3;
    d += `M${x.toFixed(1)} ${y.toFixed(1)} q${(dx * 0.4).toFixed(1)} ${(dy * 0.8).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)} `;
  }
  return d;
}

const BODY_TUFTS = tufts(120, 138, 84, 100, 64, 14, 7);
const BODY_TUFTS_IN = tufts(120, 138, 80, 96, 52, 10, 21);
const STRANDS = strands(5);
const ARM_TUFTS = (() => {
  const r = rng(3);
  let d = "";
  for (let y = 0; y < 42; y += 7) {
    for (const side of [-1, 1]) {
      const x = side * 17;
      const l = 6 + r() * 5;
      d += `M${x} ${y - 4} Q${x + side * l} ${y + 1} ${x + side * (l - 2)} ${y + 7} L${x} ${y + 6} Z `;
    }
  }
  return d;
})();

// Upper lip runs from (70,138) to (170,138) dipping to y=150: y = 138 + 24 t (1 - t).
const lipY = (x: number) => {
  const t = (x - 70) / 100;
  return 138 + 24 * t * (1 - t);
};

function Arm({ x, angle, wave, u }: { x: number; angle: number; wave: boolean; u: (n: string) => string }) {
  return (
    <g transform={`translate(${x} 156)`}>
      <g className="mascot-arm" style={{ transform: `rotate(${angle}deg)` }}>
        <g className={wave ? "mascot-wave" : undefined}>
          <path d={ARM_TUFTS} fill="#9a55e6" />
          <path d={ARM} fill={`url(#${u("fur")})`} filter={`url(#${u("fuzz")})`} />
          {/* mitten paw with three plump fingers */}
          <ellipse cx="0" cy="52" rx="21" ry="17" fill={`url(#${u("paw")})`} />
          {[-12, 0, 12].map((fx) => (
            <g key={fx}>
              <ellipse cx={fx} cy={fx === 0 ? 66 : 63} rx="8" ry="8.5" fill={`url(#${u("paw")})`} stroke="#6c2bc4" strokeOpacity="0.45" strokeWidth="1.4" />
              <ellipse cx={fx - 2} cy={fx === 0 ? 63 : 60} rx="3" ry="2.2" fill="#fff" opacity="0.4" />
            </g>
          ))}
        </g>
      </g>
    </g>
  );
}

function Eye({ cx, cy, gx, gy, u }: { cx: number; cy: number; gx: number; gy: number; u: (n: string) => string }) {
  const clip = u(`eye${cx}`);
  return (
    <g className="mascot-eye" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      {/* furry rim the eyeball sits in */}
      <ellipse cx={cx} cy={cy + 2} rx="32.5" ry="34.5" fill={`url(#${u("socket")})`} />
      <ellipse cx={cx} cy={cy} rx="29" ry="31" fill={`url(#${u("sclera")})`} />
      <clipPath id={clip}>
        <ellipse cx={cx} cy={cy} rx="29" ry="31" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g className="mascot-gaze" style={{ transform: `translate(${gx * 8}px, ${gy * 8}px)` }}>
          <circle cx={cx} cy={cy + 3} r="16" fill={`url(#${u("iris")})`} />
          <circle cx={cx} cy={cy + 3} r="16" fill="none" stroke="#0f3f8f" strokeWidth="1.6" />
          <circle cx={cx} cy={cy + 3} r="9.5" fill="#05060c" />
          <circle cx={cx + 5} cy={cy - 2} r="4.6" fill="#fff" />
          <circle cx={cx - 5} cy={cy + 8} r="1.8" fill="#fff" opacity="0.85" />
        </g>
        {/* soft shading so the eyeball reads round */}
        <ellipse cx={cx} cy={cy - 34} rx="34" ry="12" fill="#4b1a8a" opacity="0.18" />
        <path d={`M${cx - 20} ${cy - 12} Q${cx - 16} ${cy - 24} ${cx - 5} ${cy - 27}`} stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
      </g>
    </g>
  );
}

export function Mascot({ size = 160, pose = "idle", className }: { size?: number; pose?: MascotPose; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const u = (n: string) => `${n}-${uid}`;
  const [la, ra] = ARMS[pose];
  const [gx, gy] = GAZE[pose];
  const drop = pose === "cheer" ? 10 : 0;
  const MOUTH = `M70 138 Q120 162 170 138 Q${164} ${186 + drop} 120 ${190 + drop} Q76 ${186 + drop} 70 138 Z`;

  return (
    <svg className={`mascot pose-${pose} ${className || ""}`} width={size} height={size * (290 / 308)} viewBox="-34 -6 308 290" role="img" aria-label="Jahit, maskot CV Tailor">
      <defs>
        <radialGradient id={u("fur")} cx="0.4" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#dca6ff" />
          <stop offset="0.45" stopColor="#b06cf2" />
          <stop offset="1" stopColor="#6c2bc4" />
        </radialGradient>
        <radialGradient id={u("furU")} gradientUnits="userSpaceOnUse" cx="100" cy="80" r="190">
          <stop offset="0" stopColor="#d49cff" />
          <stop offset="0.45" stopColor="#a35fec" />
          <stop offset="1" stopColor="#5a1fae" />
        </radialGradient>
        <radialGradient id={u("paw")} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#dfb0ff" />
          <stop offset="1" stopColor="#9d58e8" />
        </radialGradient>
        <radialGradient id={u("socket")} cx="0.5" cy="0.6" r="0.55">
          <stop offset="0.8" stopColor="#7a32c8" />
          <stop offset="1" stopColor="#7a32c8" stopOpacity="0" />
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
        <radialGradient id={u("rim")} cx="0.5" cy="0.38" r="0.62">
          <stop offset="0.62" stopColor="#1a0640" stopOpacity="0" />
          <stop offset="1" stopColor="#1a0640" stopOpacity="0.45" />
        </radialGradient>
        <clipPath id={u("bodyclip")}>
          <path d={BODY} />
        </clipPath>
        <clipPath id={u("mouthclip")}>
          <path d={MOUTH} />
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

      <ellipse cx="120" cy="256" rx="82" ry="9" fill="#05030f" opacity="0.4" />

      <g className="mascot-bob">
        {/* pink horns */}
        {[1, -1].map((s) => (
          <g key={s} transform={s === -1 ? "translate(240 0) scale(-1 1)" : undefined}>
            <path d="M80 66 C62 54 54 32 64 8 C68 6 71 8 71 11 C71 30 86 44 102 52 Z" fill={`url(#${u("horn")})`} />
            <g stroke="#c94f98" strokeWidth="2" strokeLinecap="round" opacity="0.35" fill="none">
              <path d="M63 26 q5 3 9 0" />
              <path d="M65 38 q6 3 11 0" />
              <path d="M71 50 q6 2 11 -1" />
            </g>
          </g>
        ))}

        {/* feet with little claws */}
        {[86, 154].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="238" rx="30" ry="16" fill={`url(#${u("fur")})`} filter={`url(#${u("fuzz")})`} />
            {[-14, 0, 14].map((d) => (
              <g key={d}>
                <ellipse cx={x + d} cy="248" rx="7" ry="5.5" fill={`url(#${u("toe")})`} />
                <path d={`M${x + d - 2.5} 252 L${x + d} 258 L${x + d + 2.5} 252 Z`} fill="#fff4e0" />
              </g>
            ))}
          </g>
        ))}

        {/* furry body: two rings of tufts, the body, then the tuft on top */}
        <path d={BODY_TUFTS} fill={`url(#${u("furU")})`} />
        <path d={BODY_TUFTS_IN} fill={`url(#${u("furU")})`} />
        <g filter={`url(#${u("fuzz")})`}>
          <path d={BODY} fill={`url(#${u("fur")})`} />
          <path d={BODY} fill={`url(#${u("rim")})`} />
          <path d="M98 44 Q96 14 112 28 Q116 4 126 26 Q140 8 140 32 Q152 22 146 46 Z" fill="#c78af7" />
        </g>
        <g clipPath={`url(#${u("bodyclip")})`}>
          <rect x="32" y="34" width="176" height="208" filter={`url(#${u("grain")})`} opacity="0.16" />
        </g>
        <path d={STRANDS} stroke="#f0d4ff" strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <ellipse cx="96" cy="70" rx="44" ry="22" fill="#fff" opacity="0.12" />

        {/* big bulging eyes that almost touch */}
        <Eye cx={92} cy={96} gx={gx} gy={gy} u={u} />
        <Eye cx={148} cy={96} gx={gx} gy={gy} u={u} />

        {/* wide grin full of chunky teeth */}
        <path d={MOUTH} fill={`url(#${u("mouth")})`} />
        <g clipPath={`url(#${u("mouthclip")})`}>
          <ellipse cx="120" cy={192 + drop} rx="30" ry="13" fill="#ff6f9a" />
          {[80, 95, 111, 129, 145, 160].map((x) => (
            <rect key={x} x={x - 7} y={lipY(x) - 4} width="14" height="17" rx="4" fill="#fffaf0" />
          ))}
          {[98, 113, 127, 142].map((x) => (
            <rect key={x} x={x - 6.5} y={176 + drop} width="13" height="16" rx="4" fill="#f4ecdf" />
          ))}
        </g>
        <path d={MOUTH} fill="none" stroke="#7a2fc0" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M64 134 q4 2 6 4" stroke="#7a2fc0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M176 134 q-4 2 -6 4" stroke="#7a2fc0" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* arms last so they read in front of the body */}
        <Arm x={54} angle={la} wave={false} u={u} />
        <Arm x={186} angle={ra} wave={pose === "wave"} u={u} />
      </g>
    </svg>
  );
}
