import { useEffect, useState } from "react";
import { api, formatDate } from "../../api";
import { ErrorBox, Loading, useAction } from "../../components/ui";

const TASKS: Record<string, string> = {
  extract_profile: "Impor CV",
  analyze: "Analisis JD",
  tailor: "Sesuaikan CV",
  revise: "Revisi CV",
  test: "Tes provider",
};

const STATUS: Record<string, [string, string]> = {
  success: ["Sukses", "fit"],
  error: ["Gagal", "bad"],
  invalid_output: ["Balasan rusak", "gap"],
};

export function UsagePage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<{ summary: any[]; recent: any[] } | null>(null);
  const act = useAction();

  useEffect(() => {
    act.run(async () => setData(await api("GET", `/api/admin/usage?days=${days}`)));
  }, [days]);

  const fmt = (n: number) => n.toLocaleString("id-ID");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pemakaian AI</h1>
          <p>Setiap percobaan ke provider tercatat, termasuk yang gagal lalu dialihkan ke provider berikutnya.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: "auto", background: "var(--surface)" }} aria-label="Rentang waktu">
          <option value={1}>24 jam</option>
          <option value={7}>7 hari</option>
          <option value={30}>30 hari</option>
          <option value={90}>90 hari</option>
        </select>
      </div>
      <ErrorBox error={act.error} />
      {!data ? (
        <Loading />
      ) : (
        <div className="stack">
          <div className="stats">
            {[
              ["Panggilan", data.summary.reduce((n, x) => n + x.calls, 0)],
              ["Sukses", data.summary.reduce((n, x) => n + x.ok, 0)],
              ["Gagal dan dialihkan", data.summary.reduce((n, x) => n + x.errors + x.invalid, 0)],
              ["Token", data.summary.reduce((n, x) => n + x.input_tokens + x.output_tokens, 0)],
            ].map(([k, v]) => (
              <div className="stat-card" key={k as string}>
                <div className="k">{k}</div>
                <div className="v">{fmt(v as number)}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>Ringkasan per provider</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Model</th>
                    <th className="num">Panggilan</th>
                    <th className="num">Sukses</th>
                    <th className="num">Error</th>
                    <th className="num">Tidak valid</th>
                    <th className="num">Token masuk</th>
                    <th className="num">Token keluar</th>
                    <th className="num">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.map((s, i) => (
                    <tr key={i}>
                      <td>
                        <b>{s.provider_name}</b>
                      </td>
                      <td>
                        <code>{s.model}</code>
                      </td>
                      <td className="num">{fmt(s.calls)}</td>
                      <td className="num">{fmt(s.ok)}</td>
                      <td className="num">{fmt(s.errors)}</td>
                      <td className="num">{fmt(s.invalid)}</td>
                      <td className="num">{fmt(s.input_tokens)}</td>
                      <td className="num">{fmt(s.output_tokens)}</td>
                      <td className="num">{s.avg_latency_ms != null ? `${(s.avg_latency_ms / 1000).toFixed(1)} dtk` : "-"}</td>
                    </tr>
                  ))}
                  {!data.summary.length && (
                    <tr>
                      <td colSpan={9} className="muted">
                        Belum ada pemakaian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>200 panggilan terakhir</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Pengguna</th>
                    <th>Tugas</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th className="num">Durasi</th>
                    <th className="num">Token</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => {
                    const [label, tone] = STATUS[r.status] ?? [r.status, ""];
                    return (
                      <tr key={r.id}>
                        <td className="small">{formatDate(r.created_at)}</td>
                        <td className="small">{r.email ?? "-"}</td>
                        <td>{TASKS[r.task] ?? r.task}</td>
                        <td>
                          {r.provider_name}
                          <div className="small muted">{r.model}</div>
                        </td>
                        <td>
                          <span className={`chip ${tone}`}>{label}</span>
                          {r.error && (
                            <div className="small" style={{ color: "var(--danger)", maxWidth: 360, wordBreak: "break-word" }}>
                              {r.error}
                            </div>
                          )}
                        </td>
                        <td className="num">{(r.latency_ms / 1000).toFixed(1)} dtk</td>
                        <td className="num small">
                          {fmt(r.input_tokens)} / {fmt(r.output_tokens)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
