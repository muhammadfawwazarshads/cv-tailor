import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ApplicationSummary, type Profile } from "../api";
import { APP_NAME } from "../brand";
import { Mascot, type MascotPose } from "./Mascot";

/**
 * Hello right after signing in, told through the name: a needle pulls Benang's thread around a CV
 * sheet with the user's name on it, stitching it "to fit", then Benang picks the story up where the
 * user left it (thin material, applications measured but not sewn, ...) and offers that next step.
 */
const SEW_START = 0.5; // s
const SEW_DUR = 1.9; // s
// Running stitch just inside the sheet's edge, clockwise from the top-left corner.
const STITCH = "M58 22 H182 Q190 22 190 30 V202 Q190 210 182 210 H58 Q50 210 50 202 V30 Q50 22 58 22";

type Next = { say: string; label: string; to: string };

/** Where the user's story stands, and the step Benang suggests next. */
function nextStep(p: Profile, apps: ApplicationSummary[]): Next {
  const sent = apps.filter((a) => ["applied", "interview", "offer", "rejected"].includes(a.status)).length;
  const waiting = apps.filter((a) => a.fit_score != null && a.versions === 0).length;
  if (!p.name || !p.experience.length) return { say: "Bahan CV-mu masih tipis. Ceritain dulu ke aku, biar ada yang bisa dijahit.", label: "Cerita ke Benang", to: "/profile" };
  if (!apps.length) return { say: "Bahanmu sudah siap. Tinggal ukur lowongan pertama.", label: "Ukur lowongan", to: "/leads" };
  if (waiting) return { say: `${waiting} lamaran sudah diukur tapi belum dijahit. Lanjut dari situ?`, label: "Lanjut menjahit", to: "/applications" };
  return { say: `${sent} lamaran sudah dikirim. Ada lowongan baru buat diukur hari ini?`, label: "Ukur lowongan baru", to: "/leads" };
}

export function Welcome({ name, onDone }: { name: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"sew" | "done" | "leave">("sew");
  const [next, setNext] = useState<Next | null>(null);
  const [goTo, setGoTo] = useState<string | null>(null);
  const navigate = useNavigate();
  const full = (name || "").trim();
  const first = full.split(/\s+/)[0];

  useEffect(() => {
    Promise.all([api<{ profile: Profile }>("GET", "/api/profile"), api<{ applications: ApplicationSummary[] }>("GET", "/api/applications")])
      .then(([p, a]) => setNext(nextStep(p.profile, a.applications)))
      .catch(() => setNext({ say: "Kita mulai dari mana hari ini?", label: "Ukur lowongan", to: "/leads" }));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("done"), reduced ? 0 : (SEW_START + SEW_DUR) * 1000);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && leave(null);
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  function leave(to: string | null) {
    setGoTo(to);
    setPhase("leave");
  }

  useEffect(() => {
    if (phase !== "leave") return;
    if (goTo) navigate(goTo);
    const t = setTimeout(onDone, 650);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const pose: MascotPose = phase === "sew" ? "point-left" : "cheer";

  return (
    <div className={`welcome phase-${phase}`} role="dialog" aria-modal="true" aria-label="Selamat datang">
      <div className="welcome-body">
        <div className="welcome-stage">
          <svg className="welcome-sheet" viewBox="0 0 240 232" aria-hidden>
            <defs>
              <linearGradient id="wl-needle" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8b90a6" />
                <stop offset="0.6" stopColor="#f4f5fa" />
                <stop offset="1" stopColor="#c9cddc" />
              </linearGradient>
              <mask id="wl-sewn" maskUnits="userSpaceOnUse">
                <path d={STITCH} pathLength={1} stroke="#fff" strokeWidth="8" fill="none" strokeDasharray="1 3" strokeDashoffset="1">
                  <animate attributeName="stroke-dashoffset" from="1" to="0" begin={`${SEW_START}s`} dur={`${SEW_DUR}s`} fill="freeze" calcMode="spline" keySplines="0.45 0 0.55 1" keyTimes="0;1" />
                </path>
              </mask>
            </defs>

            {/* the CV sheet */}
            <rect className="welcome-paper" x="40" y="12" width="160" height="208" rx="10" />
            <circle cx="70" cy="50" r="12" fill="rgba(199, 166, 255, 0.25)" />
            <text x="90" y="47" className="welcome-name">
              {full || "CV kamu"}
            </text>
            <rect x="90" y="53" width="56" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.12)" />
            {[78, 90, 102, 124, 136, 148, 170, 182, 194].map((y, k) => (
              <rect key={y} x="58" y={y} width={[124, 104, 116, 124, 96, 112, 124, 88, 108][k]} height="5" rx="2.5" fill={k % 3 === 0 ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.07)"} />
            ))}

            {/* Benang's thread, revealed behind the needle */}
            <path d={STITCH} mask="url(#wl-sewn)" fill="none" stroke="#c7a6ff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="7 5" opacity="0">
              <animate attributeName="opacity" values="0;1" begin={`${SEW_START}s`} dur="0.05s" fill="freeze" />
            </path>

            {/* the needle rides the stitch line, pointing where it goes */}
            <g opacity="0">
              <animate attributeName="opacity" values="0;1" begin={`${SEW_START}s`} dur="0.12s" fill="freeze" />
              <animate attributeName="opacity" values="1;0" begin={`${SEW_START + SEW_DUR}s`} dur="0.25s" fill="freeze" />
              <animateMotion path={STITCH} begin={`${SEW_START}s`} dur={`${SEW_DUR}s`} rotate="auto" fill="freeze" calcMode="spline" keySplines="0.45 0 0.55 1" keyTimes="0;1" keyPoints="0;1" />
              <path d="M-22 -1.8 L5 -0.7 L10 0 L5 0.7 L-22 1.8 Q-24 0 -22 -1.8 Z" fill="url(#wl-needle)" stroke="#5b6075" strokeWidth="0.4" />
              <ellipse cx="-18.5" cy="0" rx="2.4" ry="0.8" fill="#0a0d16" />
            </g>

            {/* a small "pas" tag sewn on once the stitch closes */}
            <g className="welcome-tag">
              <rect x="146" y="196" width="46" height="20" rx="10" fill="#c7a6ff" />
              <text x="169" y="210" textAnchor="middle" className="welcome-tag-text">
                pas ✓
              </text>
            </g>
          </svg>
          <div className="welcome-mascot">
            <Mascot size={140} pose={pose} />
          </div>
        </div>
        <h1>{first ? `Halo, ${first}.` : "Halo."}</h1>
        <p>Aku Benang. Di {APP_NAME}, CV-mu dijahit ulang biar pas untuk tiap lowongan.</p>
        <div className={`welcome-next${phase !== "sew" && next ? " in" : ""}`}>
          {next && (
            <>
              <div className="welcome-says">{next.say}</div>
              <div className="welcome-actions">
                <button className="btn primary" onClick={() => leave(next.to)} autoFocus>
                  {next.label}
                </button>
                <button className="btn ghost" onClick={() => leave(null)}>
                  Nanti saja
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
