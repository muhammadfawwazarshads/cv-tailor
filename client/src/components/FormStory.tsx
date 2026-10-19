import { ArrowUp, Check, Download, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormPlan, FormQuestion, FormSlot } from "../api";
import { Mascot, type MascotPose } from "./Mascot";
import { Spinner } from "./ui";

/**
 * Filling a company form as a conversation: Benang reports what it already filled from Bahan CV and
 * its notebook, asks the rest one question at a time (noting each answer in the notebook so the next
 * form needs less), then hands over the finished .docx. Beside the chat the form sheet fills up live.
 */
type Analysis = { slots: FormSlot[]; plan: FormPlan };
type Answer = string | string[];
type Line = { from: "benang" | "me"; text: string; key: number };

const shown = (a: Answer | undefined) => (Array.isArray(a) ? a.join(", ") : (a ?? "")).trim();

export function FormStory({
  analysis,
  fileName,
  answers,
  setAnswer,
  remember,
  setRemember,
  hasSignature,
  busy,
  done,
  onDownload,
  onNotebook,
}: {
  analysis: Analysis;
  fileName: string;
  answers: Record<string, Answer>;
  setAnswer: (id: string, v: Answer) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  hasSignature: boolean;
  busy: boolean;
  done: string | null;
  onDownload: () => void;
  onNotebook: () => void;
}) {
  const qs = analysis.plan.questions;
  const autoCount = analysis.plan.values.filter((v) => v.value.trim()).length + analysis.plan.checks.length + analysis.plan.replacements.length;
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  // index of the question being asked; qs.length means all asked and the form is ready
  const [at, setAt] = useState(-1);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pose, setPose] = useState<MascotPose>("idle");
  const counter = useRef(0);
  const timers = useRef<number[]>([]);
  const logEnd = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const push = (from: Line["from"], t: string) => setLines((l) => [...l, { from, text: t, key: counter.current++ }]);

  function say(texts: string[], next: number, p: MascotPose = "idle") {
    setTyping(true);
    let delay = 0;
    texts.forEach((t, k) => {
      delay += k === 0 ? 450 : Math.min(1300, 300 + t.length * 13);
      timers.current.push(window.setTimeout(() => push("benang", t), delay));
    });
    timers.current.push(
      window.setTimeout(() => {
        setTyping(false);
        setAt(next);
        setPose(p);
        setText("");
        setPicked([]);
      }, delay + 150),
    );
  }

  const ask = (i: number): string[] => (i < qs.length ? [qs[i].question, ...(qs[i].why ? [qs[i].why] : [])] : wrapUp());

  function wrapUp() {
    return [
      hasSignature ? "Tanda tanganmu aku tempel juga di kolomnya." : "Satu hal: tanda tanganmu belum ada di buku catatanku, jadi kolomnya aku biarkan kosong.",
      "Form-nya siap. Unduh, lalu periksa sekali lagi di Word sebelum dikirim.",
    ];
  }

  useEffect(() => {
    const intro = [
      `Aku sudah baca ${fileName}.`,
      autoCount
        ? `${autoCount} isian sudah aku isi dari Bahan CV dan buku catatanku.`
        : "Belum ada yang bisa aku isi sendiri, bukunya masih kosong. Tenang, setelah form ini aku jadi ingat.",
      qs.length ? `Tinggal ${qs.length} yang belum aku tahu. Aku tanya satu-satu ya.` : "Tidak ada yang perlu aku tanyakan.",
    ];
    say([...intro, ...ask(0)], 0, qs.length ? "point-right" : "cheer");
    return () => timers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lines, typing]);

  useEffect(() => {
    if (!typing) field.current?.focus({ preventScroll: true });
  }, [typing, at]);

  function reply(v: Answer | null) {
    const q = qs[at];
    const value = v == null ? "" : v;
    push("me", shown(value) || "Kosongkan saja");
    setAnswer(q.id, value);
    const noted = remember && q.saveAs && shown(value) ? [`Aku catat di buku: ${q.saveAs}. Form berikutnya tidak aku tanya lagi.`] : [];
    const next = at + 1;
    say([...noted, ...ask(next)], next, next >= qs.length ? "cheer" : "point-right");
  }

  const q = at >= 0 && at < qs.length ? qs[at] : null;

  return (
    <div className="story">
      <div className="story-chat">
        <div className="story-chapters">
          <span className="form-progress">
            {Math.min(Math.max(at, 0), qs.length)} dari {qs.length} pertanyaan
          </span>
          <label className="form-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <NotebookPen size={13} /> Catat jawaban di buku
          </label>
        </div>
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
            <Mascot size={64} pose={pose} />
          </div>
          <div className="story-reply">
            {!typing && q && q.options.length > 0 && (
              <div className="story-form">
                <div className="story-choices">
                  {q.options.map((o) => {
                    const on = picked.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        className={`btn sm${on ? " primary" : ""}`}
                        onClick={() => (q.multi ? setPicked(on ? picked.filter((x) => x !== o) : [...picked, o]) : reply(o))}
                      >
                        {on && <Check size={13} />} {o}
                      </button>
                    );
                  })}
                </div>
                <div className="story-choices">
                  {q.multi && (
                    <button type="button" className="btn primary sm" disabled={!picked.length} onClick={() => reply(picked)}>
                      Lanjut
                    </button>
                  )}
                  <button type="button" className="story-skip" onClick={() => reply(null)}>
                    Kosongkan
                  </button>
                </div>
              </div>
            )}
            {!typing && q && q.options.length === 0 && (
              <form
                className="story-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) reply(text.trim());
                }}
              >
                <div className="story-field">
                  <textarea
                    ref={field}
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Jawabanmu"
                  />
                  <button className="send" type="submit" aria-label="Kirim">
                    <ArrowUp size={16} />
                  </button>
                </div>
                <button type="button" className="story-skip" onClick={() => reply(null)}>
                  Kosongkan
                </button>
              </form>
            )}
            {!typing && at >= qs.length && (
              <div className="story-choices">
                {busy ? (
                  <span className="row small muted" style={{ gap: 8 }}>
                    <Spinner /> Benang lagi menulis ke form…
                  </span>
                ) : (
                  <button className="btn primary sm" onClick={onDownload}>
                    <Download size={15} /> {done ? "Unduh lagi" : "Isi & unduh .docx"}
                  </button>
                )}
                {!hasSignature && (
                  <button className="btn sm" onClick={onNotebook}>
                    Simpan tanda tangan di buku
                  </button>
                )}
              </div>
            )}
            {done && <div className="story-done">{done}</div>}
          </div>
        </div>
      </div>
      <FormSheet analysis={analysis} answers={answers} current={q?.id ?? null} fileName={fileName} hasSignature={hasSignature} />
    </div>
  );
}

/** The company form filling up: auto-filled rows solid, answered rows stitched in, pending rows chalk. */
function FormSheet({
  analysis,
  answers,
  current,
  fileName,
  hasSignature,
}: {
  analysis: Analysis;
  answers: Record<string, Answer>;
  current: string | null;
  fileName: string;
  hasSignature: boolean;
}) {
  const label = new Map(analysis.slots.map((s) => [s.id, s.label]));
  const auto = analysis.plan.values
    .filter((v) => v.value.trim())
    .map((v) => ({
      key: v.id,
      label: label.get(v.id) ?? v.id,
      value: v.value === "[[SIGNATURE]]" ? (hasSignature ? "Tanda tangan" : "") : v.value === "[[PHOTO]]" ? "Pas foto" : v.value,
    }));
  const asked = analysis.plan.questions.map((q: FormQuestion) => ({ key: q.id, label: q.saveAs || q.question, value: shown(answers[q.id]) }));
  const rows = [...asked, ...auto];
  const filled = auto.filter((r) => r.value).length + asked.filter((r) => r.value).length;
  const max = 16;
  return (
    <aside className="story-sheet" aria-label="Form yang sedang diisi">
      <div className="story-paper form-paper">
        <div className="fp-file">{fileName}</div>
        {rows.slice(0, max).map((r) => (
          <div key={r.key} className={`fp-row${r.value ? " filled" : ""}${r.key === current ? " now" : ""}${asked.some((a) => a.key === r.key) ? " asked" : ""}`}>
            <span>{r.label}</span>
            <b>{r.value || (r.key === current ? "Benang sedang bertanya…" : "")}</b>
          </div>
        ))}
        {rows.length > max && <div className="fp-more">+{rows.length - max} isian lain</div>}
      </div>
      <p className="story-sheet-cap">
        {filled} dari {rows.length} isian terisi
      </p>
    </aside>
  );
}
