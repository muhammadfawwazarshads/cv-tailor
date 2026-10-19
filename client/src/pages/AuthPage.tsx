import { useEffect, useState, type FormEvent } from "react";
import { Brand, useAuth } from "../App";
import { api, type User } from "../api";
import { ErrorBox, Field, Spinner, useAction } from "../components/ui";

export function AuthPage() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [cfg, setCfg] = useState<{ allowRegistration: boolean; hasUsers: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { busy, error, run, setError } = useAction();

  useEffect(() => {
    api("GET", "/api/auth/config").then((c) => {
      setCfg(c);
      if (!c.hasUsers) setMode("register");
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => api<{ user: User }>("POST", `/api/auth/${mode}`, { email, password, ...(mode === "register" ? { name } : {}) }));
    if (r) setUser(r.user);
  }

  return (
    <div className="auth">
      <div className="aurora" aria-hidden />
      <section className="auth-story">
        <Brand />
        <div>
          <h1>Satu CV untuk setiap lowongan</h1>
          <p>Tempel deskripsi pekerjaan. CV Tailor menilai kecocokanmu, menanyakan hal yang belum jelas, lalu menulis ulang CV dari pengalamanmu sendiri.</p>
        </div>
        <div className="auth-demo" aria-hidden>
          <div className="q">JD ini minta Kubernetes. Kamu pernah deploy ke cluster beneran?</div>
          <div className="a">Belum, baru Docker Compose</div>
          <div className="q">Oke, Kubernetes tidak aku klaim. Docker Compose di project BUMD aku tonjolkan.</div>
        </div>
      </section>
      <section className="auth-form">
        <div className="inner">
          <h2>{mode === "login" ? "Masuk" : "Buat akun"}</h2>
          <p className="muted" style={{ marginBottom: 22 }}>
            {cfg && !cfg.hasUsers ? "Akun pertama otomatis menjadi admin." : mode === "login" ? "Lanjutkan lamaranmu." : "Gratis, cukup email dan password."}
          </p>
          <form className="stack" onSubmit={submit}>
            {mode === "register" && (
              <Field label="Nama">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Password" hint={mode === "register" ? "Minimal 8 karakter." : undefined}>
              <input
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </Field>
            <ErrorBox error={error} />
            <button className="btn primary block" disabled={busy} style={{ marginTop: 4 }}>
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
      </section>
    </div>
  );
}
