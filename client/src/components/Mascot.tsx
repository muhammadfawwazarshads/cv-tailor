import { useId } from "react";

// Fluffy outline: a wobbly circle whose rim is cut into soft tufts.
function furPath(cx: number, cy: number, r: number, tufts: number, depth: number) {
  const pts: string[] = [];
  for (let i = 0; i < tufts; i++) {
    const a0 = (i / tufts) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / tufts) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / tufts) * Math.PI * 2 - Math.PI / 2;
    const wob = 1 + 0.035 * Math.sin(i * 2.3);
    const rIn = (r - depth) * wob;
    const rOut = (r + depth * 0.6) * wob;
    const p = (a: number, rr: number) => `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr * 0.94).toFixed(1)}`;
    if (i === 0) pts.push(`M ${p(a0, rIn)}`);
    // tuft tip leans a little clockwise so the fur looks brushed
    pts.push(`Q ${p(a1 - 0.05, rOut)} ${p(a2, rIn)}`);
  }
  return pts.join(" ") + " Z";
}

const BODY = furPath(100, 110, 70, 26, 7);

/** "Jahit", the CV Tailor monster: iridescent fur, two tiny fangs, a tape-measure scarf. */
export function Mascot({ size = 160, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const fur = `fur-${id}`;
  const shade = `shade-${id}`;
  const shine = `shine-${id}`;
  return (
    <svg className={`mascot ${className || ""}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Jahit, maskot CV Tailor">
      <defs>
        <linearGradient id={fur} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#8ec5ff" />
          <stop offset="0.38" stopColor="#c7a6ff" />
          <stop offset="0.7" stopColor="#ff9ecf" />
          <stop offset="1" stopColor="#ffd9a0" />
        </linearGradient>
        <radialGradient id={shade} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0.6" stopColor="#100c28" stopOpacity="0" />
          <stop offset="1" stopColor="#100c28" stopOpacity="0.45" />
        </radialGradient>
        <radialGradient id={shine} cx="0.32" cy="0.22" r="0.35">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="mascot-bob">
        {/* horns */}
        <path d="M62 62 C56 50 58 38 66 32 Q68 31 68 34 C68 42 72 50 80 56 Z" fill="#e9e4ff" />
        <path d="M138 62 C144 50 142 38 134 32 Q132 31 132 34 C132 42 128 50 120 56 Z" fill="#e9e4ff" />

        {/* feet */}
        <ellipse cx="74" cy="172" rx="15" ry="9" fill="#c7a6ff" />
        <ellipse cx="126" cy="172" rx="15" ry="9" fill="#ffb3c4" />

        {/* body */}
        <path d={BODY} fill={`url(#${fur})`} />
        <path d={BODY} fill={`url(#${shade})`} />
        <path d={BODY} fill={`url(#${shine})`} />
        <path d={BODY} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />

        {/* fur strokes */}
        <g stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M94 62 q4 -6 9 -7" />
          <path d="M48 120 q-6 4 -8 10" />
          <path d="M152 120 q6 4 8 10" />
        </g>

        {/* eyes */}
        <g className="mascot-eyes">
          <ellipse cx="78" cy="102" rx="15" ry="17" fill="#0d1019" />
          <ellipse cx="122" cy="102" rx="15" ry="17" fill="#0d1019" />
          <circle cx="83" cy="95" r="5.5" fill="#fff" />
          <circle cx="127" cy="95" r="5.5" fill="#fff" />
          <circle cx="74" cy="108" r="2.2" fill="#fff" opacity="0.8" />
          <circle cx="118" cy="108" r="2.2" fill="#fff" opacity="0.8" />
        </g>

        {/* cheeks */}
        <ellipse cx="60" cy="126" rx="9" ry="5" fill="#ff6e87" opacity="0.45" />
        <ellipse cx="140" cy="126" rx="9" ry="5" fill="#ff6e87" opacity="0.45" />

        {/* mouth with two little fangs */}
        <path d="M86 128 Q100 144 114 128 Q100 134 86 128 Z" fill="#0d1019" />
        <path d="M91 130.5 L94 139 L97 132 Z" fill="#fff" />
        <path d="M103 132 L106 139 L109 130.5 Z" fill="#fff" />

        {/* tape-measure scarf: the tailor's touch */}
        <path d="M46 150 Q100 168 154 150 L156 160 Q100 178 44 160 Z" fill="#f3c372" />
        <g stroke="#7a5418" strokeWidth="1.4" strokeLinecap="round">
          {[56, 66, 76, 86, 96, 106, 116, 126, 136, 146].map((x, i) => {
            const y = 150 + 18 * (1 - ((x - 100) / 56) ** 2) * 0.55;
            return <line key={x} x1={x} y1={y} x2={x} y2={y + (i % 2 ? 3 : 5)} />;
          })}
        </g>
        <path d="M138 161 L146 182 L155 179 L149 158 Z" fill="#f3c372" />
      </g>
    </svg>
  );
}
