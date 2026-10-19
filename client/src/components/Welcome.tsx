import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ApplicationSummary, type Profile } from "../api";
import { APP_NAME } from "../brand";
import { Mascot, type MascotPose, type Wear } from "./Mascot";
import { wearFromProfile } from "./Outfit";

/**
 * Hello right after signing in, told as a three-beat scene on the user's own CV sheet: Benang measures
 * it with a tape, sews it with a needle, and tags it "pas", narrating in a speech bubble. The last beat
 * picks the story up where the user left it (thin material, applications measured but not sewn, ...).
 * Each beat gets room to land, Benang types before every line, and a click jumps to the last beat.
 */
type Phase = "hello" | "measure" | "sew" | "pas" | "next" | "leave";
// Beats, in seconds from the start: hello, then the tape, then the needle, then the "pas" moment.
const MEASURE_AT = 2.6;
const SEW_START = 5.4; // when the needle starts (the tape runs before it)
const SEW_DUR = 3; // s
const PAS_HOLD = 2.6; // s, the "pas" moment before Benang suggests what's next
// Running stitch just inside the sheet's edge (sheet is 230 x 290), clockwise from the top-left corner.
const STITCH = "M19 10 H211 Q220 10 220 19 V271 Q220 280 211 280 H19 Q10 280 10 271 V19 Q10 10 19 10";

type Next = { say: string; label: string; to: string };
type Story = { profile: Profile | null; next: Next };

const skillsOf = (p: Profile) => p.skills.flatMap((g) => g.items.split(",").map((x) => x.trim()).filter(Boolean));

/** Where the user's story stands, and the step Benang suggests next. */
function nextStep(p: Profile, apps: ApplicationSummary[]): Next {
  const sent = apps.filter((a) => ["applied", "interview", "offer", "rejected"].includes(a.status)).length;
  const waiting = apps.filter((a) => a.fit_score != null && a.versions === 0).length;
  const worn = wearFromProfile(p).length;
  if (!p.name || !p.experience.length)
    return { say: `Bahannya masih tipis, aku baru pakai ${worn} dari 5 setelan. Ceritain dulu ke aku, biar ada yang bisa dijahit.`, label: "Cerita ke Benang", to: "/profile" };
  if (!apps.length) return { say: "Bahanmu sudah siap. Tinggal ukur lowongan pertama.", label: "Ukur lowongan", to: "/leads" };
  if (waiting) return { say: `${waiting} lamaran sudah diukur tapi belum dijahit. Lanjut dari situ?`, label: "Lanjut menjahit", to: "/applications" };
  return { say: `${sent} lamaran sudah dikirim. Ada lowongan baru buat diukur hari ini?`, label: "Ukur lowongan baru", to: "/leads" };
}

/** What Benang says while sewing, from what is actually in the material. */
function sewLine(p: Profile | null) {
  if (!p) return "Sekarang aku jahit…";
  const exp = p.experience.length;
  const sk = skillsOf(p).length;
  if (!exp && !sk) return "Bahannya baru sedikit, tapi aku jahit yang ada dulu…";
  return `${exp ? `${exp} pengalaman` : ""}${exp && sk ? ", " : ""}${sk ? `${sk} skill` : ""}. Aku jahit jadi satu…`;
}

export function Welcome({ name, onDone }: { name: string; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("hello");
  const [story, setStory] = useState<Story | null>(null);
  // starts undressed; the pieces the user has earned pop on once the profile loads
  const [wear, setWear] = useState<Wear[]>([]);
  const [goTo, setGoTo] = useState<string | null>(null);
  const sheet = useRef<SVGSVGElement>(null);
  const timers = useRef<number[]>([]);
  const navigate = useNavigate();
  const first = (name || "").trim().split(/\s+/)[0];

  useEffect(() => {
    Promise.all([api<{ profile: Profile }>("GET", "/api/profile"), api<{ applications: ApplicationSummary[] }>("GET", "/api/applications")])
      .then(([p, a]) => {
        setWear(wearFromProfile(p.profile));
        setStory({ profile: p.profile, next: nextStep(p.profile, a.applications) });
      })
      .catch(() => setStory({ profile: null, next: { say: "Kita mulai dari mana hari ini?", label: "Ukur lowongan", to: "/leads" } }));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) skip();
    else
      timers.current = [
        window.setTimeout(() => setPhase("measure"), MEASURE_AT * 1000),
        window.setTimeout(() => setPhase("sew"), SEW_START * 1000),
        window.setTimeout(() => setPhase("pas"), (SEW_START + SEW_DUR) * 1000),
        window.setTimeout(() => setPhase("next"), (SEW_START + SEW_DUR + PAS_HOLD) * 1000),
      ];
    const esc = (e: KeyboardEvent) => e.key === "Escape" && leave(null);
    window.addEventListener("keydown", esc);
    return () => {
      timers.current.forEach(clearTimeout);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  /** Jump straight to the last beat: finish the stitch and show the suggestion. */
  function skip() {
    timers.current.forEach(clearTimeout);
    sheet.current?.setCurrentTime?.(SEW_START + SEW_DUR + 1);
    setPhase("next");
  }

  function leave(to: string | null) {
    setGoTo(to);
    setPhase("leave");
  }

  useEffect(() => {
    if (phase !== "leave") return;
    if (goTo) navigate(goTo);
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const p = story?.profile ?? null;
  const pose: MascotPose = phase === "hello" ? "wave" : phase === "measure" ? "point-left" : phase === "sew" ? "idle" : phase === "pas" ? "cheer" : "wave";
  const said =
    phase === "hello"
      ? `Halo, ${first || "kamu"}! Selamat datang di ${APP_NAME}.`
      : phase === "measure"
        ? "Sebelum mulai, aku ukur bahanmu dulu ya…"
      : phase === "sew"
        ? sewLine(p)
        : phase === "pas"
          ? "Pas! Ini CV-mu, dijahit dari bahanmu sendiri."
          : (story?.next.say ?? "Kita mulai dari mana hari ini?");
  const skills = p ? skillsOf(p) : [];

  return (
    <div
      className={`welcome phase-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Selamat datang di ${APP_NAME}`}
      onClick={(e) => phase !== "next" && phase !== "leave" && !(e.target as HTMLElement).closest("button") && skip()}
    >
      <div className="welcome-scene">
        <div className="wl-sheet" aria-hidden>
          <div className="wl-tape" />
          <div className="wl-head">
            <span className="wl-avatar">{(p?.name || name || "?").trim().slice(0, 1).toUpperCase()}</span>
            <div>
              <b>{p?.name || name || "CV kamu"}</b>
              <span>{p?.headline || "Posisi incaran"}</span>
            </div>
          </div>
          <div className="wl-title">Pengalaman</div>
          {p?.experience.length ? (
            p.experience.slice(0, 2).map((e) => (
              <div key={e.id} className="wl-item">
                <b>{[e.role, e.organization].filter(Boolean).join(" · ")}</b>
                <i />
                <i className="short" />
              </div>
            ))
          ) : (
            <div className="wl-item ghost">
              <i />
              <i className="short" />
            </div>
          )}
          <div className="wl-title">Skill</div>
          {skills.length ? (
            <div className="wl-skills">
              {skills.slice(0, 6).map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          ) : (
            <div className="wl-item ghost">
              <i />
            </div>
          )}
          <svg ref={sheet} className="wl-stitch" viewBox="0 0 230 290" aria-hidden>
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
            {/* Benang's thread, revealed behind the needle */}
            <path d={STITCH} mask="url(#wl-sewn)" fill="none" stroke="#c7a6ff" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="6 5" opacity="0">
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
          </svg>
          <span className="wl-tag">pas ✓</span>
        </div>

        <div className="wl-side">
          <Says text={said} />
          <div className="wl-benang">
            <Mascot size={128} pose={pose} wear={wear} />
          </div>
          <div className={`wl-actions${phase === "next" && story ? " in" : ""}`}>
            {story && (
              <>
                <button className="btn primary" onClick={() => leave(story.next.to)} autoFocus>
                  {story.next.label}
                </button>
                <button className="btn ghost" onClick={() => leave(null)}>
                  Nanti saja
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {phase !== "next" && phase !== "leave" && <p className="wl-skip">Klik di mana saja untuk lewati</p>}
    </div>
  );
}

/** Benang's bubble: a moment of typing dots before every new line, so each beat can land. */
function Says({ text }: { text: string }) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    setShown(null);
    const t = setTimeout(() => setShown(text), 550);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="wl-says" aria-live="polite">
      {shown ?? (
        <span className="wl-typing" aria-label="Benang sedang mengetik">
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}
