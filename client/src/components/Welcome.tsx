import { useEffect, useState } from "react";
import { Mascot, type MascotPose } from "./Mascot";

/**
 * Short hello right after signing in: Jahit rises in and waves, the greeting fades up, and a stitch
 * sews itself across as the progress line before the app is revealed. Click anywhere to skip.
 */
export function Welcome({ name, onDone }: { name: string; onDone: () => void }) {
  const [pose, setPose] = useState<MascotPose>("wave");
  const [leaving, setLeaving] = useState(false);
  const first = (name || "").trim().split(/\s+/)[0];
  const greeting = first ? `Halo, ${first}.` : "Halo.";
  const hour = new Date().getHours();
  const sub = hour < 11 ? "Pagi yang pas buat kirim lamaran." : hour < 15 ? "Siang ini, satu CV lagi yuk." : hour < 19 ? "Sore yang pas buat rapikan CV." : "Malam yang tenang buat siapkan lamaran.";

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setPose("idle"), 1600);
    const t2 = setTimeout(() => setLeaving(true), reduced ? 1200 : 2400);
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
      <div className="welcome-body">
        <div className="welcome-mascot">
          <Mascot size={150} pose={pose} />
        </div>
        <h1>{greeting}</h1>
        <p>{sub}</p>
        <div className="welcome-stitch" aria-hidden>
          <i />
        </div>
      </div>
    </div>
  );
}
