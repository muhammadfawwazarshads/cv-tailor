import { CalendarCheck, Eye, EyeOff, FileCheck2, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Brand, useAuth } from "../App";
import { api, type User } from "../api";
import { Mascot, type MascotPose } from "../components/Mascot";
import { ErrorBox, Field, Spinner, useAction } from "../components/ui";

const HEADLINE = "Satu CV untuk setiap lowongan";

export function AuthPage() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [cfg, setCfg] = useState<{ allowRegistration: boolean; hasUsers: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focus, setFocus] = useState<"name" | "email" | "password" | null>(null);
  const [mood, setMood] = useState<"sad" | "cheer" | null>(null);
  const [shake, setShake] = useState(false);
  const { busy, error, run, setError } = useAction();

  useEffect(() => {
    api("GET", "/api/auth/config").then((c) => {
      setCfg(c);
      if (!c.hasUsers) setMode("register");
    });
  }, []);

  // A failed attempt: Jahit looks sad for a moment and the card shakes.
  useEffect(() => {
    if (!error) return;
    setMood("sad");
    setShake(true);
    const t1 = setTimeout(() => setShake(false), 500);
    const t2 = setTimeout(() => setMood(null), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [error]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => api<{ user: User }>("POST", `/api/auth/${mode}`, { email, password, ...(mode === "register" ? { name } : {}) }));
    if (!r) return;
    setMood("cheer");
    await new Promise((res) => setTimeout(res, 650));
    setUser(r.user);
  }

  // Jahit reacts to the form: reads along while you type, covers its eyes for the password.
  const typed = focus === "email" ? email : focus === "name" ? name : "";
  const pose: MascotPose =
    mood === "cheer" ? "cheer" : mood === "sad" ? "sad" : busy ? "point-up" : focus === "password" && !showPw ? "shy" : focus ? "idle" : "wave";
  const look: [number, number] | undefined =
    focus === "email" || focus === "name" ? [Math.min(1, -0.8 + typed.length / 16), 0.9] : focus === "password" ? [0.2, 0.9] : undefined;

  return (
    <div className="auth">
      <div className="aurora" aria-hidden />
      <section className="auth-story">
        <div className="auth-blobs" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <Brand />
        <div className="auth-hero">
          <h1>
            {HEADLINE.split(" ").map((w, k) => (
              <span key={k} style={{ animationDelay: `${0.15 + k * 0.08}s` }}>
                {w}
              </span>
            ))}
          </h1>
          <p>Tempel deskripsi pekerjaan. CV Tailor menilai kecocokanmu, menanyakan hal yang belum jelas, lalu menulis ulang CV dari pengalamanmu sendiri.</p>
        </div>
        <div className="auth-floats" aria-hidden>
          <div className="auth-chip c1">
            <Sparkles size={14} /> Kecocokan <b>92%</b>
          </div>
          <div className="auth-chip c2">
            <FileCheck2 size={14} /> CV siap dikirim
          </div>
          <div className="auth-chip c3">
            <CalendarCheck size={14} /> Interview Kamis, 10.00
          </div>
        </div>
        <div className="auth-demo" aria-hidden>
          <div className="q">JD ini minta Kubernetes. Kamu pernah deploy ke cluster beneran?</div>
          <div className="typing">
            <i />
            <i />
            <i />
          </div>
          <div className="a">Belum, baru Docker Compose</div>
          <div className="q">Oke, Kubernetes tidak aku klaim. Docker Compose di project BUMD aku tonjolkan.</div>
        </div>
      </section>
      <section className="auth-form">
        <div className="inner">
          <div className="auth-perch">
            <Mascot size={170} pose={pose} look={look} />
          </div>
          <div className={`auth-card${shake ? " shake" : ""}`}>
            <h2>{mode === "login" ? "Masuk" : "Buat akun"}</h2>
            <p className="muted" style={{ marginBottom: 22 }}>
              {cfg && !cfg.hasUsers ? "Akun pertama otomatis menjadi admin." : mode === "login" ? "Lanjutkan lamaranmu." : "Gratis, cukup email dan password."}
            </p>
            <form className="stack" onSubmit={submit}>
              {mode === "register" && (
                <Field label="Nama">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setFocus("name")} onBlur={() => setFocus(null)} autoComplete="name" />
                </Field>
              )}
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocus("email")}
                  onBlur={() => setFocus(null)}
                  autoComplete="email"
                />
              </Field>
              <Field label="Password" hint={mode === "register" ? "Minimal 8 karakter." : undefined}>
                <div className="pw-wrap">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocus("password")}
                    onBlur={() => setFocus(null)}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    className="pw-eye"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <ErrorBox error={error} />
              <button className="btn primary block auth-submit" disabled={busy || mood === "cheer"} style={{ marginTop: 4 }}>
                {busy && <Spinner />}
                {mode === "login" ? "Masuk" : "Buat akun"}
              </button>
            </form>
            {cfg?.allowRegistration && cfg.hasUsers && (
              <p className="muted small" style={{ textAlign: "center", marginTop: 18 }}>
                {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setError(null);
                    setMode(mode === "login" ? "register" : "login");
                  }}
                >
                  {mode === "login" ? "Buat akun" : "Masuk"}
                </a>
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
