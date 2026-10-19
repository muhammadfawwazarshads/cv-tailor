import { Eraser, ImageUp, PenLine, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, formatDate, type PersonalData } from "../api";
import { BenangSays } from "../components/BenangSays";
import { ErrorBox, Loading, useAction } from "../components/ui";

/** "Data diri" tab of Form HR: what Benang remembers for company forms (answers, signature, photo). */
export function PersonalTab() {
  const [data, setData] = useState<PersonalData | null>(null);
  const [items, setItems] = useState<{ label: string; value: string }[]>([]);
  const [dirty, setDirty] = useState(false);
  const load = useAction();
  const save = useAction();

  useEffect(() => {
    load.run(async () => {
      const r = await api<PersonalData>("GET", "/api/personal");
      setData(r);
      setItems(r.personal.items);
    });
  }, []);

  async function put(patch: Partial<{ signature: string | null; photo: string | null; items: { label: string; value: string }[] }>) {
    const body: Record<string, unknown> = {};
    if ("signature" in patch) body.signature = patch.signature;
    if ("photo" in patch) body.photo = patch.photo;
    if (patch.items) body.personal = { items: patch.items.filter((i) => i.label.trim() || i.value.trim()) };
    const r = await save.run(() => api<PersonalData>("PUT", "/api/personal", body));
    if (r) {
      setData(r);
      if (patch.items) {
        setItems(r.personal.items);
        setDirty(false);
      }
    }
    return r;
  }

  if (!data) return load.error ? <ErrorBox error={load.error} /> : <Loading />;

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <BenangSays pose={!data.signature || !data.photo || !items.length ? "point-down" : "cheer"}>
          {!data.signature ? (
            <>
              <b>Tanda tangannya belum ada.</b>
              <p>Gambar sekali di bawah, Benang menempelnya di setiap form. Tidak perlu cetak, tanda tangan, lalu scan lagi.</p>
            </>
          ) : !data.photo ? (
            <>
              <b>Tinggal pas foto.</b>
              <p>Banyak form HR punya kotak foto 3x4. Unggah sekali, Benang memasangnya sendiri.</p>
            </>
          ) : !items.length ? (
            <>
              <b>Belum ada jawaban yang Benang ingat.</b>
              <p>Isi satu form di tab Isi form. NIK, alamat, dan kontak darurat yang kamu jawab tersimpan di sini untuk form berikutnya.</p>
            </>
          ) : (
            <>
              <b>Data dirimu lengkap.</b>
              <p>{items.length} jawaban, tanda tangan, dan pas foto siap. Form berikutnya hampir terisi sendiri.</p>
            </>
          )}
        </BenangSays>
      </div>
      <ErrorBox error={save.error} />
      <div className="grid-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <SignatureCard value={data.signature} onSave={(signature) => put({ signature })} busy={save.busy} />
        <PhotoCard value={data.photo} onSave={(photo) => put({ photo })} busy={save.busy} />
      </div>

      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>Jawaban tersimpan</h2>
            <p>{items.length ? `${items.length} jawaban. Form berikutnya tidak akan menanyakannya lagi.` : "Belum ada. Jawabanmu saat mengisi form akan muncul di sini."}</p>
          </div>
          <button
            className="btn sm"
            onClick={() => {
              setItems([...items, { label: "", value: "" }]);
              setDirty(true);
            }}
          >
            <Plus size={15} /> Tambah
          </button>
        </div>
        {items.length > 0 && (
          <div className="kv">
            {items.map((it, i) => (
              <div className="kv-row" key={i}>
                <input
                  type="text"
                  aria-label="Label"
                  placeholder="Misalnya: Golongan darah"
                  value={it.label}
                  onChange={(e) => {
                    setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)));
                    setDirty(true);
                  }}
                />
                <textarea
                  aria-label={`Isi ${it.label}`}
                  rows={1}
                  value={it.value}
                  onChange={(e) => {
                    setItems(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)));
                    setDirty(true);
                  }}
                />
                <button
                  className="icon-btn"
                  aria-label={`Hapus ${it.label}`}
                  onClick={() => {
                    setItems(items.filter((_, j) => j !== i));
                    setDirty(true);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {dirty && (
          <div>
            <button className="btn primary" disabled={save.busy} onClick={() => put({ items })}>
              <Save size={16} /> Simpan jawaban
            </button>
          </div>
        )}
        {data.updatedAt && <div className="small muted">Terakhir diubah {formatDate(data.updatedAt)}</div>}
      </div>
    </>
  );
}

/* ---------------- Signature ---------------- */

/** Crops transparent margins so the signature sits tight in the form. */
function trimmed(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1 + pad * 2;
  out.height = maxY - minY + 1 + pad * 2;
  out.getContext("2d")!.drawImage(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, maxX - minX + 1, maxY - minY + 1);
  return out.toDataURL("image/png");
}

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar tidak bisa dibaca. Pakai PNG atau JPG."));
    img.src = url;
  });
}

function SignatureCard({ value, onSave, busy }: { value: string | null; onSave: (v: string | null) => Promise<unknown>; busy: boolean }) {
  const [editing, setEditing] = useState(!value);
  const [empty, setEmpty] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#10142a";
  }, [editing]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };

  function clear() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  }

  async function upload(file: File) {
    const img = await readImage(file);
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const scale = Math.min(c.width / img.width, c.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    // Photo of a signature on paper: make the paper transparent.
    const data = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const lum = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
      if (lum > 170) data.data[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    setEmpty(false);
  }

  async function save() {
    const url = trimmed(canvas.current!);
    if (url && (await onSave(url))) setEditing(false);
  }

  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Tanda tangan</h2>
          <p>Ditempel di kolom tanda tangan saat form diisi.</p>
        </div>
        {value && !editing && (
          <button className="btn sm" onClick={() => setEditing(true)}>
            <PenLine size={15} /> Ganti
          </button>
        )}
      </div>
      {value && !editing ? (
        <div className="sig-preview">
          <img src={value} alt="Tanda tangan tersimpan" />
        </div>
      ) : (
        <>
          <canvas
            ref={canvas}
            className="sig-pad"
            width={720}
            height={240}
            aria-label="Area tanda tangan"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drawing.current = true;
              const ctx = e.currentTarget.getContext("2d")!;
              const p = pos(e);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = e.currentTarget.getContext("2d")!;
              const p = pos(e);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              setEmpty(false);
            }}
            onPointerUp={() => (drawing.current = false)}
            onPointerLeave={() => (drawing.current = false)}
          />
          <div className="small muted">Tanda tangan dengan mouse atau jari, atau unggah foto tanda tangan di kertas putih (latar putihnya dihapus otomatis).</div>
          <div className="row">
            <label className="btn sm">
              <ImageUp size={15} /> Unggah gambar
              <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            <button className="btn sm ghost" onClick={clear}>
              <Eraser size={15} /> Bersihkan
            </button>
            {value && (
              <button className="btn sm ghost" onClick={() => setEditing(false)}>
                <X size={15} /> Batal
              </button>
            )}
            <button className="btn sm primary" style={{ marginLeft: "auto" }} disabled={empty || busy} onClick={save}>
              <Save size={15} /> Simpan
            </button>
          </div>
        </>
      )}
      {value && !editing && (
        <div>
          <button className="btn sm ghost danger" onClick={() => onSave(null)}>
            <Trash2 size={15} /> Hapus tanda tangan
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Photo ---------------- */

function PhotoCard({ value, onSave, busy }: { value: string | null; onSave: (v: string | null) => Promise<unknown>; busy: boolean }) {
  async function upload(file: File) {
    const img = await readImage(file);
    const max = 700;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    await onSave(c.toDataURL("image/jpeg", 0.86));
  }
  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Pas foto</h2>
          <p>Untuk form yang punya kotak foto. Rasio 3x4 paling pas.</p>
        </div>
      </div>
      {value && (
        <div className="photo-preview">
          <img src={value} alt="Pas foto tersimpan" />
        </div>
      )}
      <div className="row">
        <label className="btn sm">
          <ImageUp size={15} /> {value ? "Ganti foto" : "Unggah foto"}
          <input type="file" accept="image/png,image/jpeg" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {value && (
          <button className="btn sm ghost danger" onClick={() => onSave(null)}>
            <Trash2 size={15} /> Hapus
          </button>
        )}
      </div>
    </div>
  );
}
