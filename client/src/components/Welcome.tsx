import { useEffect, useState } from "react";
import { Mascot, type MascotPose } from "./Mascot";
import { Confetti } from "./TourDemos";

/**
 * Full-screen hello right after signing in: a light burst, Jahit pops in and cheers, the greeting
 * rises letter by letter, then everything lifts away to reveal the app. Click anywhere to skip.
 */
export function Welcome({ name, onDone }: { name: string; onDone: () => void }) {
  const [pose, setPose] = useState<MascotPose>("cheer");
  const [leaving, setLeaving] = useState(false);
  const first = (name || "").trim().split(/\s+/)[0];
  const greeting = first ? `Halo, ${first}!` : "Halo!";
  const hour = new Date().getHours();
  const sub = hour < 11 ? "Pagi yang pas buat kirim lamaran." : hour < 15 ? "Siang ini, satu CV lagi yuk." : hour < 19 ? "Sore yang pas buat rapikan CV." : "Malam yang tenang buat siapkan lamaran.";

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setPose("wave"), 1300);
    const t2 = setTimeout(() => setLeaving(true), reduced ? 1200 : 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  return (
    <div className={`welcome${leaving ? " leaving" : ""}`} role="status" aria-live="polite" onClick={() => setLeaving(true)}>
      <div className="welcome-burst" aria-hidden />
      <div className="welcome-rings" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <Confetti />
      <div className="welcome-body">
        <div className="welcome-mascot">
          <Mascot size={220} pose={pose} />
        </div>
        <h1 aria-label={greeting}>
          {[...greeting].map((ch, k) => (
            <span key={k} aria-hidden style={{ animationDelay: `${0.45 + k * 0.045}s` }}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </h1>
        <p>{sub}</p>
        <div className="welcome-bar" aria-hidden>
          <i />
        </div>
      </div>
    </div>
  );
}
