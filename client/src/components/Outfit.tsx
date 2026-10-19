import { Check, FileText, Glasses, GraduationCap, IdCard, Shirt } from "lucide-react";
import type { Profile } from "../api";
import type { Wear } from "./Mascot";

/**
 * Dress-up: every part of the CV material Benang receives earns it one piece of its job-hunt outfit,
 * in the order of the story's chapters. A complete material means a fully dressed Benang.
 */
export const OUTFIT: { key: Wear; label: string; hint: string; icon: typeof Shirt }[] = [
  { key: "badge", label: "Name tag", hint: "Isi nama dan email", icon: IdCard },
  { key: "tie", label: "Dasi", hint: "Ceritakan satu pengalaman", icon: Shirt },
  { key: "glasses", label: "Kacamata", hint: "Tulis 5 skill", icon: Glasses },
  { key: "cap", label: "Topi wisuda", hint: "Isi pendidikan", icon: GraduationCap },
  { key: "cv", label: "CV di tangan", hint: "Tambah satu project", icon: FileText },
];

const skillCount = (p: Profile) => p.skills.reduce((n, g) => n + g.items.split(",").filter((x) => x.trim()).length, 0);

export function wearFromProfile(p: Profile): Wear[] {
  const has: Record<Wear, boolean> = {
    badge: Boolean(p.name && p.contact.email),
    tie: p.experience.length > 0,
    glasses: skillCount(p) >= 5,
    cap: p.education.length > 0,
    cv: p.projects.length > 0,
  };
  return OUTFIT.map((o) => o.key).filter((k) => has[k]);
}

export const wearLabel = (w: Wear) => OUTFIT.find((o) => o.key === w)!.label.toLowerCase();

/** The wardrobe: which pieces Benang already wears and what unlocks the rest. */
export function Wardrobe({ wear, compact }: { wear: Wear[]; compact?: boolean }) {
  return (
    <ul className={`wardrobe${compact ? " compact" : ""}`} aria-label="Lemari Benang">
      {OUTFIT.map((o) => {
        const on = wear.includes(o.key);
        const Icon = o.icon;
        return (
          <li key={o.key} className={on ? "on" : ""} title={on ? `${o.label}: dipakai` : `${o.label}: ${o.hint}`}>
            <span className="wd-icon">{on ? <Check size={12} strokeWidth={3} /> : <Icon size={14} />}</span>
            {!compact && (
              <span className="wd-text">
                <b>{o.label}</b>
                <span>{on ? "Dipakai" : o.hint}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
