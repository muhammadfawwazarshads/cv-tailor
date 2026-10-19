import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, formatDate, STANDALONE, type Provider } from "../../api";
import { ErrorBox, Field, Loading, Modal, Spinner, Switch, useAction } from "../../components/ui";

type Stat = { provider_id: string; calls: number; ok: number; avg_latency_ms: number | null; last_used: string | null };

const TYPE_INFO: Record<string, { label: string; model: string; baseUrl?: string; apiVersion?: string; key: boolean; note?: string }> = {
  anthropic: { label: "Anthropic (Claude)", model: "mis. claude-sonnet-5-5", key: true },
  openai: { label: "OpenAI", model: "nama model dari dashboard OpenAI", key: true },
  gemini: { label: "Google Gemini", model: "nama model dari Google AI Studio", key: true },
  "azure-openai": {
    label: "Azure OpenAI / AI Foundry",
    model: "nama deployment",
    baseUrl: "https://<resource>.openai.azure.com",
    apiVersion: "2024-10-21, atau v1 untuk endpoint v1",
    key: true,
    note: "Model diisi nama deployment, bukan nama model.",
  },
  "openai-compatible": {
    label: "OpenAI-compatible",
    model: "nama model di server tersebut",
    baseUrl: "mis. https://openrouter.ai/api/v1 atau http://localhost:11434/v1",
    key: false,
    note: "Untuk OpenRouter, Ollama, LM Studio, Groq, dan sejenisnya. API key opsional.",
  },
  mock: { label: "Mock (demo, tanpa AI)", model: "mock (isi 'fail' untuk simulasi gagal)", key: false, note: "Hanya untuk demo dan tes." },
};

type Form = { id?: string; name: string; type: string; model: string; baseUrl: string; apiVersion: string; apiKey: string; clearKey: boolean; priority: number; enabled: boolean; hasKey: boolean; masked: string };

const blank = (priority: number): Form => ({ name: "", type: "anthropic", model: "", baseUrl: "", apiVersion: "", apiKey: "", clearKey: false, priority, enabled: true, hasKey: false, masked: "" });

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [mockEnabled, setMockEnabled] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [tests, setTests] = useState<Record<string, { busy?: boolean; ok?: boolean; text?: string }>>({});
  const act = useAction();

  async function refresh() {
    const r = await api("GET", "/api/admin/providers");
    setProviders(r.providers);
    setStats(r.stats);
    setMockEnabled(r.mockEnabled);
  }
  useEffect(() => {
    act.run(refresh);
  }, []);

  async function reorder(i: number, d: number) {
    if (!providers) return;
    const next = [...providers];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setProviders(next);
    await act.run(async () => {
      await api("POST", "/api/admin/providers/reorder", { ids: next.map((p) => p.id) });
      await refresh();
    });
  }

  async function toggle(p: Provider) {
    await act.run(async () => {
      await api("PUT", `/api/admin/providers/${p.id}`, {
        name: p.name,
        type: p.type,
        model: p.model,
        baseUrl: p.base_url,
        apiVersion: p.api_version,
        priority: p.priority,
        enabled: !p.enabled,
      });
      await refresh();
    });
  }

  async function test(p: Provider) {
    setTests((t) => ({ ...t, [p.id]: { busy: true } }));
    try {
      const r = await api("POST", `/api/admin/providers/${p.id}/test`);
      setTests((t) => ({ ...t, [p.id]: r.ok ? { ok: true, text: `Terhubung dalam ${r.latencyMs} ms` } : { ok: false, text: r.error } }));
    } catch (e: any) {
      setTests((t) => ({ ...t, [p.id]: { ok: false, text: e.message } }));
    }
  }

  async function remove(p: Provider) {
    if (!confirm(`Hapus provider "${p.name}"?`)) return;
    await act.run(async () => {
      await api("DELETE", `/api/admin/providers/${p.id}`);
      await refresh();
    });
  }

  const nextPriority = providers?.length ? Math.max(...providers.map((p) => p.priority)) + 10 : 10;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Provider AI</h1>
          <p>Provider dicoba berurutan dari nomor 1. Kalau satu gagal, lambat, kena batas pemakaian, atau balasannya rusak, permintaan otomatis pindah ke berikutnya. API key disimpan terenkripsi.</p>
        </div>
        <button className="btn primary" onClick={() => setForm(blank(nextPriority))}>
          <Plus size={16} /> Tambah provider
        </button>
      </div>
      {STANDALONE && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <span>
            Versi ini memanggil AI langsung dari browser dan menyimpan API key di browser ini saja. Claude, OpenAI, dan Gemini bisa dipanggil
            dari browser. Azure dan sebagian endpoint lain mungkin menolak panggilan dari browser (CORS); pakai versi server untuk itu. Untuk
            mencoba tanpa API key, tambahkan provider tipe Mock.
          </span>
        </div>
      )}
      <ErrorBox error={act.error} />
      {providers === null ? (
        <Loading />
      ) : providers.length === 0 ? (
        <div className="card empty">
          <h2>Belum ada provider</h2>
          <p>Tambahkan minimal satu provider supaya pengguna bisa memakai fitur AI.</p>
          <button className="btn primary" onClick={() => setForm(blank(10))}>
            <Plus size={16} /> Tambah provider
          </button>
        </div>
      ) : (
        <div className="card flush">
          {providers.map((p, i) => {
            const s = stats.find((x) => x.provider_id === p.id);
            const t = tests[p.id];
            return (
              <div key={p.id} className={`prov${p.enabled ? "" : " off"}`}>
                <div className="rank" title={i === 0 ? "Dicoba pertama" : `Cadangan ke-${i}`}>
                  {i + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="name">{p.name}</div>
                  <div className="small muted">
                    {TYPE_INFO[p.type]?.label ?? p.type}
                    {p.api_key_masked && <>, key <code>{p.api_key_masked}</code></>}
                  </div>
                  {t && (
                    <div className="test" style={{ color: t.busy ? "var(--muted)" : t.ok ? "var(--lime-ink)" : "var(--rose)" }}>
                      {t.busy ? "Menguji koneksi" : t.text}
                    </div>
                  )}
                  {p.type === "mock" && !mockEnabled && <div className="test" style={{ color: "var(--amber)" }}>Dilewati karena ENABLE_MOCK_LLM mati</div>}
                </div>
                <div className="model" style={{ minWidth: 0 }}>
                  <code>{p.model || "-"}</code>
                  {p.base_url && <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.base_url}</div>}
                </div>
                <div className="stat small">
                  {s ? (
                    <>
                      <b>
                        {s.ok}/{s.calls}
                      </b>{" "}
                      sukses, 7 hari
                      {s.avg_latency_ms != null && <div className="muted">rata-rata {(s.avg_latency_ms / 1000).toFixed(1)} detik</div>}
                    </>
                  ) : (
                    <span className="muted">Belum dipakai</span>
                  )}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => reorder(i, -1)} aria-label="Naikkan prioritas" disabled={i === 0}>
                    <ArrowUp size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => reorder(i, 1)} aria-label="Turunkan prioritas" disabled={i === providers.length - 1}>
                    <ArrowDown size={16} />
                  </button>
                  <button className="btn sm" onClick={() => test(p)} disabled={t?.busy}>
                    Tes
                  </button>
                  <button
                    className="btn sm"
                    onClick={() =>
                      setForm({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        model: p.model,
                        baseUrl: p.base_url,
                        apiVersion: p.api_version,
                        apiKey: "",
                        clearKey: false,
                        priority: p.priority,
                        enabled: p.enabled,
                        hasKey: p.has_key,
                        masked: p.api_key_masked,
                      })
                    }
                  >
                    Edit
                  </button>
                  <button className="btn sm danger" onClick={() => remove(p)}>
                    Hapus
                  </button>
                  <Switch checked={p.enabled} onChange={() => toggle(p)} label={`Aktifkan ${p.name}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && (
        <ProviderForm
          initial={form}
          mockEnabled={mockEnabled}
          onClose={() => setForm(null)}
          onSaved={async () => {
            setForm(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function ProviderForm({ initial, mockEnabled, onClose, onSaved }: { initial: Form; mockEnabled: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const act = useAction();
  const info = TYPE_INFO[f.type];
  const set = (patch: Partial<Form>) => setF({ ...f, ...patch });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      name: f.name,
      type: f.type,
      model: f.model,
      baseUrl: f.baseUrl,
      apiVersion: f.apiVersion,
      apiKey: f.apiKey || undefined,
      clearKey: f.clearKey || undefined,
      priority: f.priority,
      enabled: f.enabled,
    };
    const r = await act.run(() => (f.id ? api("PUT", `/api/admin/providers/${f.id}`, body) : api("POST", "/api/admin/providers", body)));
    if (r) onSaved();
  }

  const showBase = f.type === "azure-openai" || f.type === "openai-compatible" || f.type === "anthropic" || f.type === "openai" || f.type === "gemini";

  return (
    <Modal title={f.id ? "Edit provider" : "Tambah provider"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="grid-2">
          <Field label="Tipe">
            <select value={f.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(TYPE_INFO)
                .filter(([k]) => k !== "mock" || mockEnabled || f.type === "mock")
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Nama tampilan">
            <input type="text" required value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={info?.label} />
          </Field>
        </div>
        {info?.note && <div className="alert info">{info.note}</div>}
        <Field label={f.type === "azure-openai" ? "Nama deployment" : "Model"}>
          <input type="text" value={f.model} onChange={(e) => set({ model: e.target.value })} placeholder={info?.model} required={f.type !== "mock"} />
        </Field>
        {showBase && (
          <Field
            label={f.type === "azure-openai" || f.type === "openai-compatible" ? "Base URL / endpoint" : "Base URL (opsional)"}
            hint={f.type === "azure-openai" || f.type === "openai-compatible" ? undefined : "Kosongkan untuk endpoint resmi. Isi kalau pakai gateway/proxy."}
          >
            <input type="text" value={f.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder={info?.baseUrl ?? ""} />
          </Field>
        )}
        {f.type === "azure-openai" && (
          <Field label="API version">
            <input type="text" value={f.apiVersion} onChange={(e) => set({ apiVersion: e.target.value })} placeholder={info.apiVersion} />
          </Field>
        )}
        {f.type !== "mock" && (
          <Field
            label={`API key${info?.key ? "" : " (opsional)"}`}
            hint={f.hasKey ? `Tersimpan: ${f.masked}. Kosongkan untuk tetap memakai key ini.` : undefined}
          >
            <input type="password" value={f.apiKey} onChange={(e) => set({ apiKey: e.target.value, clearKey: false })} autoComplete="off" />
          </Field>
        )}
        {f.hasKey && !info?.key && (
          <label className="check">
            <input type="checkbox" checked={f.clearKey} onChange={(e) => set({ clearKey: e.target.checked, apiKey: "" })} />
            Hapus API key yang tersimpan
          </label>
        )}
        <div className="grid-2">
          <Field label="Prioritas" hint="Angka kecil dicoba lebih dulu.">
            <input type="number" value={f.priority} onChange={(e) => set({ priority: Number(e.target.value) })} />
          </Field>
          <Field label="Status">
            <span className="row" style={{ height: 42 }}>
              <Switch checked={f.enabled} onChange={(v) => set({ enabled: v })} label="Aktif" />
              {f.enabled ? "Aktif" : "Nonaktif"}
            </span>
          </Field>
        </div>
        <ErrorBox error={act.error} />
        <div className="row">
          <button className="btn primary" disabled={act.busy}>
            {act.busy && <Spinner />}
            Simpan
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Batal
          </button>
        </div>
      </form>
    </Modal>
  );
}
