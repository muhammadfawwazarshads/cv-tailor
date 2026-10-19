import { ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type Profile } from "../api";
import { Mascot, type MascotPose } from "./Mascot";

/**
 * "Sesi fitting": Benang fills the CV material by chatting, one question at a time, and nudges for
 * numbers and results. Every answer is saved right away and the CV sheet beside the chat grows as the
 * story goes, its edge stitched chapter by chapter.
 */
type Step =
  | "start"
  | "name"
  | "email"
  | "phone"
  | "headline"
  | "exp-ask"
  | "exp-org"
  | "exp-role"
  | "exp-when"
  | "exp-bullet"
  | "exp-number"
  | "exp-more"
  | "exp-another"
  | "skills"
  | "edu"
  | "edu-degree"
  | "edu-end"
  | "proj-ask"
  | "proj-name"
  | "proj-what"
  | "done";

type Line = { from: "benang" | "me"; text: string; key: number };

const CHAPTERS = ["Kenalan", "Pengalaman", "Skill", "Pendidikan", "Project"];
const chapterOf = (s: Step) => (s.startsWith("exp") ? 1 : s === "skills" ? 2 : s.startsWith("edu") ? 3 : s.startsWith("proj") ? 4 : s === "done" ? 5 : 0);

const ROLE_HINTS = ["Software Engineer", "Data Analyst", "UI/UX Designer", "DevOps Engineer", "Product Manager", "Digital Marketing"];
const SKILL_HINTS = ["Excel", "SQL", "Python", "JavaScript", "Figma", "Git", "Docker", "Canva", "Google Analytics", "Jira", "Public speaking", "Komunikasi"];

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const firstName = (n: string) => n.trim().split(/\s+/)[0] || "";
const allSkills = (p: Profile) =>
  p.skills.flatMap((g) =>
    g.items
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );

/** Where to pick the story up: the first chapter that is still empty. */
function startStep(p: Profile): Step {
  if (!p.name) return "start";
  if (!p.contact.email) return "email";
  if (!p.experience.length) return "exp-org";
  if (allSkills(p).length < 5) return "skills";
  if (!p.education.length) return "edu";
  if (!p.projects.length) return "proj-ask";
  return "done";
}

const ASK_SKILLS = "Sekarang skill. Tools dan bahasa apa yang benar-benar pernah kamu pakai? Ketik lalu Enter, atau pilih di bawah.";
const ASK_PROJECT = "Satu lagi, opsional: ada project yang kamu banggakan? Project pribadi atau tugas kuliah juga boleh.";
// The question that opens each chapter when the story resumes there.
const RESUME_ASK: Partial<Record<Step, string>> = {
  email: "Kalau HR mau menghubungimu, lewat email apa?",
  "exp-org": "Ceritain pengalamanmu. Kerja, magang, organisasi, atau freelance semuanya dihitung. Di mana tempatnya?",
  skills: ASK_SKILLS,
  edu: "Terakhir sekolah atau kuliah di mana?",
  "proj-ask": ASK_PROJECT,
};

function opener(p: Profile, step: Step): string[] {
  const n = firstName(p.name);
  if (step === "start")
    return [
      "Halo! Aku Benang, yang nanti menjahit CV-mu.",
      "Sebelum mulai, aku perlu kenal kamu dulu. Ceritain pelan-pelan aja, satu pertanyaan sekali jalan.",
    ];
  if (step === "done") return [`Halo lagi, ${n}! Bahanmu sudah lengkap.`, "Mau tambah pengalaman baru, atau langsung ukur lowongan?"];
  return [`Halo lagi, ${n}! Kita lanjut dari bagian yang masih kosong ya.`, RESUME_ASK[step] ?? ""].filter(Boolean);
}

export function BahanStory({
  profile,
  onChange,
  onImport,
  onEdit,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onImport: () => void;
  onEdit: () => void;
}) {
  const [p, setP] = useState(profile);
  // latest profile for callbacks that fire after a delay (Benang's typing)
  const latest = useRef(profile);
  const [step, setStep] = useState<Step>(() => startStep(profile));
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [input2, setInput2] = useState("");
  const [skillDraft, setSkillDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<MascotPose>("wave");
  const counter = useRef(0);
  const timers = useRef<number[]>([]);
  const logEnd = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  // the experience being told right now
  const cur = useRef<{ i: number; bullet: number }>({ i: -1, bullet: -1 });

  useEffect(() => {
    say(opener(profile, step), step);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lines, typing]);

  useEffect(() => {
    if (!typing) field.current?.focus({ preventScroll: true });
  }, [typing, step]);

  function push(from: Line["from"], text: string) {
    setLines((l) => [...l, { from, text, key: counter.current++ }]);
  }

  /** Benang "types" each line, then the next question opens. */
  function say(texts: string[], next: Step, pose: MascotPose = "idle") {
    setTyping(true);
    let delay = 0;
    texts.forEach((t, k) => {
      delay += k === 0 ? 450 : Math.min(1400, 300 + t.length * 14);
      timers.current.push(window.setTimeout(() => push("benang", t), delay));
    });
    timers.current.push(
      window.setTimeout(() => {
        setTyping(false);
        setStep(next);
        setMood(pose);
        setInput(prefill(next));
        setInput2("");
      }, delay + 150),
    );
  }

  function prefill(s: Step) {
    const q = latest.current;
    if (s === "name") return q.name;
    if (s === "email") return q.contact.email;
    if (s === "headline") return q.headline;
    if (s === "exp-number") return q.experience[cur.current.i]?.bullets[cur.current.bullet] ?? "";
    return "";
  }

  async function commit(next: Profile) {
    latest.current = next;
    setP(next);
    try {
      const r = await api<{ profile: Profile }>("PUT", "/api/profile", { profile: next });
      onChange(r.profile);
      setError(null);
    } catch (e: any) {
      setError(`Gagal menyimpan: ${e?.message ?? e}`);
    }
  }

  const setExp = (patch: Partial<Profile["experience"][number]>) =>
    commit({ ...p, experience: p.experience.map((e, j) => (j === cur.current.i ? { ...e, ...patch } : e)) });

  function answer(e?: FormEvent) {
    e?.preventDefault();
    const v = input.trim();
    const exp = p.experience[cur.current.i];
    switch (step) {
      case "name":
        if (!v) return;
        push("me", v);
        commit({ ...p, name: v });
        return say([`Senang kenal, ${firstName(v)}!`, "Kalau HR mau menghubungimu, lewat email apa?"], "email");
      case "email":
        if (!/^\S+@\S+\.\S+$/.test(v)) return setError("Emailnya kayaknya belum lengkap.");
        setError(null);
        push("me", v);
        commit({ ...p, contact: { ...p.contact, email: v } });
        return say(["Sip. Nomor HP-nya? Boleh dilewati kalau belum mau."], "phone");
      case "phone":
        push("me", v || "Lewati dulu");
        if (v) commit({ ...p, contact: { ...p.contact, phone: v } });
        return say(["Sekarang yang penting: kamu lagi incar posisi apa?"], "headline");
      case "headline":
        if (!v) return;
        push("me", v);
        commit({ ...p, headline: v });
        return say(
          [
            `${v}, noted. Benang akan menyesuaikan judul ini per lowongan.`,
            "Sekarang ceritain pengalamanmu. Kerja, magang, organisasi, atau freelance, semuanya dihitung.",
            "Di mana tempatnya?",
          ],
          "exp-org",
          "point-right",
        );
      case "exp-org": {
        if (!v) return;
        push("me", v);
        const e2 = { id: uid("exp"), section: "Work Experience", organization: v, role: "", location: "", start: "", end: "", bullets: [] };
        cur.current = { i: p.experience.length, bullet: -1 };
        commit({ ...p, experience: [...p.experience, e2] });
        return say([`${v}. Di sana kamu jadi apa?`], "exp-role");
      }
      case "exp-role":
        if (!v) return;
        push("me", v);
        setExp({ role: v });
        return say(["Dari kapan sampai kapan? Kira-kira aja."], "exp-when");
      case "exp-when":
        if (!v) return;
        push("me", `${v} sampai ${input2.trim() || "sekarang"}`);
        setExp({ start: v, end: input2.trim() || "Sekarang" });
        return say([`Oke. Apa yang kamu kerjakan di ${exp?.organization || "sana"}? Satu hal dulu, yang paling kamu banggakan.`], "exp-bullet", "point-right");
      case "exp-bullet": {
        if (!v) return;
        push("me", v);
        const bullets = [...(exp?.bullets ?? []), v];
        cur.current.bullet = bullets.length - 1;
        setExp({ bullets });
        if (!/\d/.test(v))
          return say(
            [
              "Bagus! Ada angkanya nggak? Misal berapa user, berapa persen lebih cepat, berapa orang di tim.",
              "Angka bikin HR berhenti scroll. Ubah kalimatnya di bawah, atau lewati kalau memang tidak ada.",
            ],
            "exp-number",
            "point-down",
          );
        return say(["Ada angkanya, mantap. Itu yang dicari HR.", "Ada lagi yang kamu kerjakan di sana?"], "exp-more", "cheer");
      }
      case "exp-number": {
        const old = exp?.bullets[cur.current.bullet] ?? "";
        const changed = v && v !== old;
        push("me", changed ? v : "Tidak ada angkanya");
        if (changed) setExp({ bullets: (exp?.bullets ?? []).map((b, k) => (k === cur.current.bullet ? v : b)) });
        return say(
          [changed && /\d/.test(v) ? "Nah, jauh lebih kuat!" : "Gapapa, yang jujur lebih penting.", "Ada lagi yang kamu kerjakan di sana?"],
          "exp-more",
          changed ? "cheer" : "idle",
        );
      }
      default:
        return;
    }
  }

  function choose(label: string, next: Step, lines2: string[], pose: MascotPose = "idle") {
    push("me", label);
    say(lines2, next, pose);
  }

  function skipTo(label: string, next: Step, lines2: string[]) {
    push("me", label);
    say(lines2, next);
  }

  function finishSkills() {
    const have = allSkills(p);
    const add = skillDraft.filter((s) => !have.some((h) => h.toLowerCase() === s.toLowerCase()));
    push("me", add.length ? add.join(", ") : "Itu dulu");
    if (add.length) {
      const groups = [...p.skills];
      const gi = groups.findIndex((g) => g.category === "Skills" || g.category === "");
      if (gi >= 0) groups[gi] = { ...groups[gi], items: [groups[gi].items, ...add].filter(Boolean).join(", ") };
      else groups.push({ category: "Skills", items: add.join(", ") });
      commit({ ...p, skills: groups });
    }
    setSkillDraft([]);
    say([add.length ? `${add.length} skill masuk bahan.` : "Oke.", "Terakhir sekolah atau kuliah di mana?"], "edu");
  }

  function eduAnswer(e: FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (step === "edu") {
      if (!v) return;
      push("me", v);
      commit({ ...p, education: [...p.education, { id: uid("edu"), institution: v, location: "", degree: "", start: "", end: "", bullets: [] }] });
      return say(["Jurusan atau gelarnya apa?"], "edu-degree");
    }
    const last = p.education.length - 1;
    const setEdu = (patch: Partial<Profile["education"][number]>) =>
      commit({ ...p, education: p.education.map((x, j) => (j === last ? { ...x, ...patch } : x)) });
    if (step === "edu-degree") {
      if (!v) return;
      push("me", v);
      setEdu({ degree: v });
      return say(["Lulus tahun berapa? Kalau masih kuliah, tulis perkiraannya."], "edu-end");
    }
    if (step === "edu-end") {
      push("me", v || "Lewati");
      if (v) setEdu({ end: v });
      return say([ASK_PROJECT], "proj-ask");
    }
  }

  function projAnswer(e: FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    push("me", v);
    if (step === "proj-name") {
      commit({ ...p, projects: [...p.projects, { id: uid("proj"), name: v, role: "", tech: input2.trim(), link: "", bullets: [] }] });
      return say(["Keren. Ceritain satu kalimat: project itu ngapain dan hasilnya apa?"], "proj-what");
    }
    const last = p.projects.length - 1;
    commit({ ...p, projects: p.projects.map((x, j) => (j === last ? { ...x, bullets: [...x.bullets, v] } : x)) });
    return say(finale(), "done", "cheer");
  }

  const finale = () => [
    `Bahanmu sudah cukup buat dijahit, ${firstName(p.name)}!`,
    "Tiap kali ada lowongan, aku pilih bagian yang paling pas dari sini. Nggak ada yang ditambah-tambah.",
  ];

  const chapter = chapterOf(step);

  return (
    <div className="story">
      <div className="story-chat">
        <ol className="story-chapters" aria-label="Bab cerita">
          {CHAPTERS.map((c, k) => (
            <li key={c} className={k < chapter ? "done" : k === chapter ? "now" : ""}>
              {c}
            </li>
          ))}
        </ol>
        <div className="story-log" aria-live="polite">
          {lines.map((l) => (
            <div key={l.key} className={`story-line ${l.from}`}>
              {l.text}
            </div>
          ))}
          {typing && (
            <div className="story-line benang typing" aria-label="Benang sedang mengetik">
              <i />
              <i />
              <i />
            </div>
          )}
          <div ref={logEnd} />
        </div>

        <div className="story-input">
          <div className="story-avatar">
            <Mascot size={64} pose={mood} />
          </div>
          <div className="story-reply">
            {error && <div className="story-error">{error}</div>}
            {!typing && reply()}
          </div>
        </div>
      </div>
      <StorySheet profile={p} chapter={chapter} />
    </div>
  );

  // Called as a function (not a component) so the input is not remounted on every keystroke.
  function reply() {
    const send = (
      <button className="send" type="submit" aria-label="Kirim">
        <ArrowUp size={16} />
      </button>
    );
    switch (step) {
      case "start":
        return (
          <div className="story-choices">
            <button className="btn primary sm" onClick={() => choose("Cerita dari awal", "name", ["Oke! Siapa nama lengkapmu?"])}>
              Cerita dari awal
            </button>
            <button className="btn sm" onClick={onImport}>
              Aku punya CV lama, baca aja
            </button>
          </div>
        );
      case "name":
      case "email":
      case "phone":
      case "headline":
      case "exp-org":
      case "exp-role":
        return (
          <form className="story-form" onSubmit={answer}>
            {step === "headline" && (
              <div className="story-hints">
                {ROLE_HINTS.map((r) => (
                  <button type="button" key={r} onClick={() => setInput(r)}>
                    {r}
                  </button>
                ))}
              </div>
            )}
            <div className="story-field">
              <input
                ref={field}
                type={step === "email" ? "email" : step === "phone" ? "tel" : "text"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  {
                    name: "Nama lengkap",
                    email: "nama@email.com",
                    phone: "08xx (opsional)",
                    headline: "Posisi yang kamu incar",
                    "exp-org": "PT Nusantara Digital, BEM Fakultas, freelance…",
                    "exp-role": "Backend Intern, Ketua divisi, …",
                  }[step]
                }
                autoComplete={step === "name" ? "name" : step === "email" ? "email" : step === "phone" ? "tel" : "off"}
              />
              {send}
            </div>
            {step === "phone" && (
              <button
                type="button"
                className="story-skip"
                onClick={() => skipTo("Lewati dulu", "headline", ["Sekarang yang penting: kamu lagi incar posisi apa?"])}
              >
                Lewati
              </button>
            )}
          </form>
        );
      case "exp-when":
        return (
          <form className="story-form" onSubmit={answer}>
            <div className="story-field two">
              <input ref={field} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mulai, mis. Jan 2023" />
              <input type="text" value={input2} onChange={(e) => setInput2(e.target.value)} placeholder="Selesai (kosong = sekarang)" />
              {send}
            </div>
          </form>
        );
      case "exp-bullet":
      case "exp-number":
      case "proj-what":
        return (
          <form className="story-form" onSubmit={step === "proj-what" ? projAnswer : answer}>
            <div className="story-field">
              <textarea
                ref={field}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  step === "proj-what"
                    ? "Aplikasi absensi untuk 3 kelas, dipakai 90 mahasiswa"
                    : "Membangun pipeline CI/CD yang memangkas waktu deploy dari 40 menit jadi 8 menit"
                }
              />
              {send}
            </div>
            {step === "exp-number" && (
              <button type="button" className="story-skip" onClick={() => answer()}>
                Tidak ada angkanya
              </button>
            )}
          </form>
        );
      case "exp-more":
        return (
          <div className="story-choices">
            <button
              className="btn primary sm"
              onClick={() => choose("Tambah poin lagi", "exp-bullet", ["Apa lagi yang kamu kerjakan di sana?"], "point-right")}
            >
              Tambah poin lagi
            </button>
            <button className="btn sm" onClick={() => choose("Cukup untuk di sini", "exp-another", ["Ada pengalaman lain yang mau diceritain?"])}>
              Cukup untuk di sini
            </button>
          </div>
        );
      case "exp-another":
        return (
          <div className="story-choices">
            <button className="btn primary sm" onClick={() => choose("Ada, tambah lagi", "exp-org", ["Di mana tempatnya?"], "point-right")}>
              Ada, tambah lagi
            </button>
            <button className="btn sm" onClick={() => choose("Lanjut ke skill", "skills", [ASK_SKILLS])}>
              Lanjut ke skill
            </button>
          </div>
        );
      case "skills": {
        const have = allSkills(p);
        const add = (s: string) => {
          const t = s.trim();
          if (t && !skillDraft.some((x) => x.toLowerCase() === t.toLowerCase())) setSkillDraft([...skillDraft, t]);
        };
        return (
          <div className="story-form">
            <div className="story-chips">
              {have.map((s) => (
                <span key={`h-${s}`} className="chip">
                  {s}
                </span>
              ))}
              {skillDraft.map((s) => (
                <button key={s} type="button" className="chip new" onClick={() => setSkillDraft(skillDraft.filter((x) => x !== s))} aria-label={`Hapus ${s}`}>
                  {s} <X size={11} />
                </button>
              ))}
            </div>
            <div className="story-hints">
              {SKILL_HINTS.filter((s) => ![...have, ...skillDraft].some((h) => h.toLowerCase() === s.toLowerCase())).map((s) => (
                <button type="button" key={s} onClick={() => add(s)}>
                  + {s}
                </button>
              ))}
            </div>
            <form
              className="story-field"
              onSubmit={(e) => {
                e.preventDefault();
                input.split(",").forEach(add);
                setInput("");
              }}
            >
              <input ref={field} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ketik skill, Enter untuk menambah" />
              <button className="btn primary sm" type="button" onClick={finishSkills}>
                Selesai
              </button>
            </form>
          </div>
        );
      }
      case "edu":
      case "edu-degree":
      case "edu-end":
        return (
          <form className="story-form" onSubmit={eduAnswer}>
            <div className="story-field">
              <input
                ref={field}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={{ edu: "Universitas, politeknik, atau SMK", "edu-degree": "S1 Teknik Informatika", "edu-end": "2024" }[step]}
              />
              {send}
            </div>
            {step === "edu" && (
              <button type="button" className="story-skip" onClick={() => skipTo("Lewati pendidikan", "proj-ask", ["Oke.", ASK_PROJECT])}>
                Lewati
              </button>
            )}
            {step === "edu-end" && (
              <button type="button" className="story-skip" onClick={() => skipTo("Lewati", "proj-ask", [ASK_PROJECT])}>
                Lewati
              </button>
            )}
          </form>
        );
      case "proj-ask":
        return (
          <div className="story-choices">
            <button
              className="btn primary sm"
              onClick={() => choose("Ada", "proj-name", ["Apa nama project-nya? Tulis juga tech-nya kalau ada."], "point-right")}
            >
              Ada
            </button>
            <button className="btn sm" onClick={() => choose("Lewati", "done", finale(), "cheer")}>
              Lewati
            </button>
          </div>
        );
      case "proj-name":
        return (
          <form className="story-form" onSubmit={projAnswer}>
            <div className="story-field two">
              <input ref={field} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nama project" />
              <input type="text" value={input2} onChange={(e) => setInput2(e.target.value)} placeholder="Tech (opsional)" />
              {send}
            </div>
          </form>
        );
      case "done":
        return (
          <div className="story-choices">
            <Link className="btn primary sm" to="/leads">
              Ukur lowongan pertama
            </Link>
            <button className="btn sm" onClick={() => choose("Tambah pengalaman", "exp-org", ["Siap. Di mana tempatnya?"], "point-right")}>
              Tambah pengalaman
            </button>
            <button className="btn ghost sm" onClick={onEdit}>
              Lihat semua detail
            </button>
          </div>
        );
      default:
        return null;
    }
  }
}

/** The CV taking shape beside the chat; its edge gets stitched one chapter at a time. */
function StorySheet({ profile: p, chapter }: { profile: Profile; chapter: number }) {
  const skills = allSkills(p);
  return (
    <aside className="story-sheet" aria-label="CV yang sedang dijahit">
      <div className="story-paper">
        {/* the seam runs clockwise around the sheet, one stretch per finished chapter */}
        {["top", "right", "bottom", "left"].map((side, k) => {
          const f = Math.max(0, Math.min(1, (chapter / CHAPTERS.length) * 4 - k));
          return <i key={side} className={`seam ${side}`} style={{ ["--f" as string]: f }} aria-hidden />;
        })}
        <div className={`sp-name${p.name ? "" : " ghost"}`}>{p.name || "Namamu"}</div>
        <div className={`sp-head${p.headline ? "" : " ghost"}`}>{p.headline || "Posisi incaran"}</div>
        <div className="sp-contact">{[p.contact.email, p.contact.phone].filter(Boolean).join(" · ") || "email · telepon"}</div>
        <div className="sp-title">Pengalaman</div>
        {p.experience.length ? (
          p.experience.map((e) => (
            <div key={e.id} className="sp-item">
              <b>{[e.role, e.organization].filter(Boolean).join(" · ") || "…"}</b>
              {(e.start || e.end) && <span className="sp-when">{[e.start, e.end].filter(Boolean).join(" – ")}</span>}
              {e.bullets.map((b, k) => (
                <div key={k} className="sp-bullet">
                  {b}
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="sp-ghost-lines">
            <i />
            <i />
          </div>
        )}
        <div className="sp-title">Skill</div>
        {skills.length ? (
          <div className="sp-skills">{skills.join(" · ")}</div>
        ) : (
          <div className="sp-ghost-lines">
            <i />
          </div>
        )}
        <div className="sp-title">Pendidikan</div>
        {p.education.length ? (
          p.education.map((e) => (
            <div key={e.id} className="sp-item">
              <b>{[e.degree, e.institution].filter(Boolean).join(" · ") || "…"}</b>
              {e.end && <span className="sp-when">{e.end}</span>}
            </div>
          ))
        ) : (
          <div className="sp-ghost-lines">
            <i />
          </div>
        )}
        {p.projects.length > 0 && (
          <>
            <div className="sp-title">Project</div>
            {p.projects.map((x) => (
              <div key={x.id} className="sp-item">
                <b>{[x.name, x.tech].filter(Boolean).join(" · ")}</b>
                {x.bullets.map((b, k) => (
                  <div key={k} className="sp-bullet">
                    {b}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
      <p className="story-sheet-cap">
        {chapter >= CHAPTERS.length ? "Bahan siap dijahit." : `Bab ${chapter + 1} dari ${CHAPTERS.length}: ${CHAPTERS[chapter]}`}
      </p>
    </aside>
  );
}
