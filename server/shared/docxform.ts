/**
 * Reads a company's .docx form, finds the places that need an answer ("slots"), and writes answers back.
 * Runs on the server and in the browser (single-file build), so it only uses jszip and xmldom.
 *
 * Slot kinds:
 *  - cell:   an empty table cell next to (or under) a label cell
 *  - after:  a paragraph that ends with "Label :" and nothing after it
 *  - blank:  a run of underscores or dots ("_____", ".....") inside a paragraph
 *  - check:  a checkbox character (☐) followed by its option text
 *  - choice: a dropdown content control (Word "Choose an item.")
 *  - sign:   a "Signature / Tanda tangan" line; the signature image goes on a new line under it
 *  - photo:  a "Pass photo / Pas foto" box; the photo replaces the label
 * Text that no slot covers ("IDR  / Month", "DATE: 2025/10/01") can be changed with find-and-replace.
 * A value of "[[SIGNATURE]]" or "[[PHOTO]]" inserts the stored image instead of text.
 */
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const W14_NS = "http://schemas.microsoft.com/office/word/2010/wordml";
const MAX_SLOTS = 400;
const BOXES = /[☐□☒☑]/;
const BLANK = /_{4,}|\.{5,}|…{2,}/;
const PREFIX = /^(\+\d{1,4}|IDR|Rp\.?|USD|\$)$/i;

export type SlotKind = "cell" | "after" | "blank" | "check" | "choice" | "sign" | "photo";
export type FormSlot = { id: string; kind: SlotKind; label: string; options?: string[] };
export type ParsedForm = { outline: string; slots: FormSlot[] };
export type FormFill = { values: Record<string, string>; checks: string[]; replacements?: { find: string; replace: string }[] };
export type FormImages = { signature?: Uint8Array | null; photo?: Uint8Array | null };

type El = Element;
type Internal = FormSlot & { node: El; textNode?: El; index?: number; match?: string; labelCell?: El | null };

const kids = (n: Node | null | undefined): El[] => {
  const out: El[] = [];
  for (let c = n?.firstChild ?? null; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c as El);
  return out;
};
const child = (n: El, name: string) => kids(n).find((c) => c.nodeName === name) ?? null;
const attr = (n: El | null, name: string) => n?.getAttribute(name) ?? null;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const isTrivial = (s: string) => !s.replace(/[\s:：_.\-–]/g, "");

function textOf(n: Node): string {
  let s = "";
  const walk = (x: Node) => {
    for (let c = x.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const e = c as El;
      if (e.nodeName === "w:t") s += e.textContent ?? "";
      else if (e.nodeName === "w:tab" || e.nodeName === "w:br") s += " ";
      else if (e.nodeName === "w:sdtPr" || e.nodeName === "w:rPr" || e.nodeName === "w:pPr") continue;
      else walk(e);
    }
  };
  walk(n);
  return s;
}

function dropdownOptions(sdt: El): string[] | null {
  const pr = child(sdt, "w:sdtPr");
  if (!pr) return null;
  const list = child(pr, "w:dropDownList") ?? child(pr, "w:comboBox");
  if (!list) return null;
  return kids(list)
    .filter((k) => k.nodeName === "w:listItem")
    .map((k) => attr(k, "w:displayText") || attr(k, "w:value") || "")
    .filter((v) => v && !/choose an item/i.test(v));
}

class Scanner {
  slots: Internal[] = [];
  lastCellLabel = "";
  lines: string[] = [];
  private n = 0;

  private add(slot: Omit<Internal, "id">): string | null {
    if (this.slots.length >= MAX_SLOTS) return null;
    const id = `S${++this.n}`;
    this.slots.push({ ...slot, id } as Internal);
    return id;
  }

  /** Body-level walk: paragraphs, tables, and block content controls. */
  block(container: Node, out: string[]) {
    for (const el of kids(container)) {
      if (el.nodeName === "w:p") out.push(this.paragraph(el));
      else if (el.nodeName === "w:tbl") this.table(el, out);
      else if (el.nodeName === "w:sdt") {
        const content = child(el, "w:sdtContent");
        if (content) this.block(content, out);
      } else if (el.nodeName === "w:customXml" || el.nodeName === "w:smartTag") this.block(el, out);
    }
  }

  /** Returns the paragraph's text with slot markers, registering checkbox, dropdown, blank and colon slots. */
  paragraph(p: El): string {
    let line = "";
    let marked = false;
    const checks: { id: string; start: number }[] = [];
    const walk = (x: El) => {
      for (const e of kids(x)) {
        if (e.nodeName === "w:sdt") {
          const opts = dropdownOptions(e);
          if (opts) {
            const id = this.add({ kind: "choice", label: "", options: opts, node: e });
            if (id) {
              line += `⟦${id}: ${opts.join(" / ")}⟧`;
              marked = true;
              continue;
            }
          }
          const content = child(e, "w:sdtContent");
          if (content) walk(content);
        } else if (e.nodeName === "w:t") {
          const t = e.textContent ?? "";
          for (let i = 0; i < t.length; i++) {
            if (BOXES.test(t[i])) {
              const id = this.add({ kind: "check", label: "", node: p, textNode: e, index: i });
              if (id) {
                checks.push({ id, start: line.length });
                line += `⟦${id}⟧`;
                marked = true;
              }
            }
            line += t[i];
          }
        } else if (e.nodeName === "w:tab" || e.nodeName === "w:br") line += " ";
        else if (e.nodeName === "w:sym") {
          // Wingdings checkbox symbols (F0A8 empty, F0FE ticked)
          const ch = (attr(e, "w:char") ?? "").toUpperCase();
          if (["F0A8", "F06F", "F071", "F0FE"].includes(ch)) {
            const id = this.add({ kind: "check", label: "", node: p, textNode: e, index: -1 });
            if (id) {
              checks.push({ id, start: line.length });
              line += `⟦${id}⟧☐`;
              marked = true;
            }
          }
        } else if (!["w:pPr", "w:rPr", "w:sdtPr", "w:instrText", "w:fldChar"].includes(e.nodeName)) walk(e);
      }
    };
    walk(p);

    // Checkbox labels: the text after each box up to the next box.
    checks.forEach((c, i) => {
      const end = checks[i + 1]?.start ?? line.length;
      const slot = this.slots.find((s) => s.id === c.id)!;
      slot.label = clean(line.slice(c.start, end).replace(/⟦[^⟧]*⟧/g, "").replace(BOXES, "")).slice(0, 80);
    });
    for (const sl of this.slots) {
      if (sl.kind === "choice" && sl.node.parentNode && !sl.label && line.includes(`⟦${sl.id}:`)) {
        sl.label = clean(line.slice(0, line.indexOf(`⟦${sl.id}:`)).replace(/⟦[^⟧]*⟧/g, "")).replace(/[:：]\s*$/, "").slice(-80);
      }
    }

    if (!marked) {
      // Blanks inside a single text node: "Name: ________"
      for (const t of Array.from(p.getElementsByTagName("w:t")) as El[]) {
        const m = (t.textContent ?? "").match(BLANK);
        if (m) {
          const before = clean(line.slice(0, line.indexOf(m[0]))).replace(/[:：]\s*$/, "");
          const id = this.add({ kind: "blank", label: before.slice(-80) || "(isian)", node: p, textNode: t, match: m[0] });
          if (id) {
            line = line.replace(m[0], `⟦${id}⟧`);
            marked = true;
          }
          break;
        }
      }
    }
    if (!marked) {
      const m = line.match(/^\s*([^:：]{2,80})[:：]\s*$/);
      if (m) {
        const id = this.add({ kind: "after", label: clean(m[1]), node: p });
        if (id) {
          line = `${line.trimEnd()} ⟦${id}⟧`;
          marked = true;
        }
      }
    }
    const short = clean(line);
    if (!marked && short.length <= 60) {
      const kind = /signature|tanda\s*tangan|\bttd\b/i.test(short) ? "sign" : /pas(s)?\s*(photo|foto)|^(photo|foto)$/i.test(short) ? "photo" : null;
      if (kind) {
        const id = this.add({ kind, label: short, node: p });
        if (id) line = `${line.trimEnd()} ⟦${id}⟧`;
      }
    }
    return line.trim();
  }

  table(tbl: El, out: string[]) {
    const rows = kids(tbl).filter((r) => r.nodeName === "w:tr");
    let header: { col: number; span: number; text: string }[] = [];
    rows.forEach((tr, ri) => {
      const cells: { tc: El; col: number; span: number; text: string; lines: string[]; added: Internal[] }[] = [];
      let col = 0;
      const collect = (container: El) => {
        for (const c of kids(container)) {
          if (c.nodeName === "w:tc") {
            const span = Number(attr(child(child(c, "w:tcPr") ?? c, "w:gridSpan"), "w:val") ?? 1) || 1;
            const lines: string[] = [];
            const first = this.slots.length;
            this.block(c, lines);
            cells.push({ tc: c, col, span, text: clean(lines.join(" ")), lines, added: this.slots.slice(first) });
            col += span;
          } else if (c.nodeName === "w:sdt") {
            const content = child(c, "w:sdtContent");
            if (content) collect(content);
          }
        }
      };
      collect(tr);
      // A row of two or more labels, with empty cells only before them, is a column header row.
      const trivial = cells.map((c) => isTrivial(c.text) && !c.text.includes("⟦"));
      const firstLabel = trivial.indexOf(false);
      const isHeader =
        trivial.filter((t) => !t).length >= 2 && trivial.slice(firstLabel).every((t) => !t) && !cells.some((c) => PREFIX.test(c.text) || /[:：]$/.test(c.text));
      if (isHeader) {
        const merged = header.filter((h) => !cells.some((c) => !isTrivial(c.text) && c.col < h.col + h.span && h.col < c.col + c.span));
        header = [...merged, ...cells.filter((c) => !isTrivial(c.text)).map((c) => ({ col: c.col, span: c.span, text: c.text }))];
        out.push(`| ${cells.map((c) => c.lines.filter(Boolean).join(" / ")).join(" | ")} |`);
        return;
      }
      // Dropdowns inside a value cell take their label from the cell before it.
      cells.forEach((c, ci) => {
        for (const sl of c.added) {
          if (sl.kind === "choice" && !sl.label) {
            const prev = cells.slice(0, ci).reverse().find((x) => !isTrivial(x.text.replace(/⟦[^⟧]*⟧/g, "")));
            if (prev) sl.label = clean(prev.text.replace(/⟦[^⟧]*⟧/g, "")).replace(/[:：]\s*$/, "").slice(0, 120);
          }
        }
      });

      const emptyCells = cells.filter((c) => isTrivial(c.text) && !c.lines.some((l) => l.includes("⟦"))).length;
      const parts = cells.map((c, ci) => {
        const vMerge = child(child(c.tc, "w:tcPr") ?? c.tc, "w:vMerge");
        const continued = vMerge && attr(vMerge, "w:val") !== "restart";
        if (!continued && isTrivial(c.text) && !c.text.includes("⟦") && !c.lines.some((l) => l.includes("⟦"))) {
          let labelCell: El | null = null;
          let label = "";
          for (let k = ci - 1; k >= 0; k--) {
            if (!isTrivial(cells[k].text)) {
              label = cells[k].text.replace(/⟦[^⟧]*⟧/g, "").replace(/[:：]\s*$/, "");
              labelCell = cells[k].tc;
              break;
            }
          }
          const head = header.length && (emptyCells > 1 || !label) ? header.find((h) => h.col <= c.col && c.col < h.col + h.span && !isTrivial(h.text)) : undefined;
          if (head && head.text !== label) label = label ? `${clean(label)} / ${head.text}` : head.text;
          if (!label && this.lastCellLabel) label = `${this.lastCellLabel.replace(/ \(lanjutan\)$/, "")} (lanjutan)`;
          if (label) {
            this.lastCellLabel = clean(label);
            const id = this.add({ kind: "cell", label: clean(label).slice(0, 120), node: c.tc, labelCell });
            if (id) return `⟦${id}⟧`;
          }
        }
        // A value cell that only holds a prefix such as "+62" or "IDR": the answer goes after it.
        if (PREFIX.test(c.text) && ci > 0) {
          const prev = cells.slice(0, ci).reverse().find((x) => !isTrivial(x.text));
          const p = child(c.tc, "w:p");
          if (prev && p) {
            const id = this.add({ kind: "after", label: `${clean(prev.text.replace(/⟦[^⟧]*⟧/g, ""))} (setelah "${c.text}")`.slice(0, 120), node: p });
            if (id) return `${c.text} ⟦${id}⟧`;
          }
        }
        return c.lines.filter(Boolean).join(" / ");
      });
      // "Name :" followed by an empty value cell: answer goes into the cell, not after the colon.
      parts.forEach((part, ci) => {
        if (!/^⟦S\d+⟧$/.test(part)) return;
        for (let k = 0; k < ci; k++) {
          for (const sl of cells[k].added.filter((x) => x.kind === "after")) {
            this.slots = this.slots.filter((x) => x !== sl);
            parts[k] = parts[k].replace(` ⟦${sl.id}⟧`, "");
          }
        }
      });
      out.push(`| ${parts.join(" | ")} |`);
    });
  }
}

async function open(data: Uint8Array | ArrayBuffer) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("File bukan .docx yang valid. Kalau formnya .doc atau PDF, simpan ulang sebagai .docx di Word atau Google Docs.");
  }
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("File bukan dokumen Word (.docx).");
  const doc = new DOMParser().parseFromString(await file.async("string"), "text/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  if (!body) throw new Error("Isi dokumen tidak terbaca.");
  const scanner = new Scanner();
  scanner.block(body, scanner.lines);
  return { zip, doc, scanner };
}

export async function parseForm(data: Uint8Array | ArrayBuffer): Promise<ParsedForm> {
  const { scanner } = await open(data);
  const outline = scanner.lines.filter((l) => l && l !== "|  |").join("\n");
  return { outline, slots: scanner.slots.map(({ id, kind, label, options }) => ({ id, kind, label, ...(options ? { options } : {}) })) };
}

/* ---------------- Writing ---------------- */

function imageSize(bytes: Uint8Array): { w: number; h: number; ext: "png" | "jpeg" } {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: v.getUint32(16), h: v.getUint32(20), ext: "png" };
  }
  // JPEG: find a SOFn marker
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8], ext: "jpeg" };
    }
    i += 2 + len;
  }
  return { w: 300, h: 100, ext: "jpeg" };
}

class Writer {
  private rid = 0;
  private picId = 9000;
  constructor(
    private zip: JSZip,
    private doc: Document,
    private rels: Document,
    private types: Document,
  ) {}

  run(text: string, rPr: El | null): El {
    const r = this.doc.createElementNS(W_NS, "w:r");
    if (rPr) r.appendChild(rPr.cloneNode(true));
    text.split("\n").forEach((line, i) => {
      if (i) r.appendChild(this.doc.createElementNS(W_NS, "w:br"));
      const t = this.doc.createElementNS(W_NS, "w:t");
      t.setAttribute("xml:space", "preserve");
      t.appendChild(this.doc.createTextNode(line));
      r.appendChild(t);
    });
    return r;
  }

  image(bytes: Uint8Array, maxWidthEmu: number, maxHeightEmu: number): El {
    const { w, h, ext } = imageSize(bytes);
    const scale = Math.min(maxWidthEmu / w, maxHeightEmu / h);
    const cx = Math.round(w * scale);
    const cy = Math.round(h * scale);
    const rId = `rIdCvt${++this.rid}`;
    const name = `cvt_${this.rid}.${ext === "png" ? "png" : "jpg"}`;
    this.zip.file(`word/media/${name}`, bytes);
    const rel = this.rels.createElementNS("http://schemas.openxmlformats.org/package/2006/relationships", "Relationship");
    rel.setAttribute("Id", rId);
    rel.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
    rel.setAttribute("Target", `media/${name}`);
    this.rels.documentElement!.appendChild(rel);
    this.ensureType(ext === "png" ? "png" : "jpg", ext === "png" ? "image/png" : "image/jpeg");
    const id = ++this.picId;
    const xml = `<w:r xmlns:w="${W_NS}"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    const frag = new DOMParser().parseFromString(xml, "text/xml").documentElement!;
    return this.doc.importNode(frag, true) as El;
  }

  private ensureType(ext: string, type: string) {
    const root = this.types.documentElement!;
    const exists = kids(root).some((d) => d.nodeName === "Default" && attr(d, "Extension")?.toLowerCase() === ext);
    if (exists) return;
    const d = this.types.createElementNS("http://schemas.openxmlformats.org/package/2006/content-types", "Default");
    d.setAttribute("Extension", ext);
    d.setAttribute("ContentType", type);
    root.insertBefore(d, root.firstChild);
  }
}

const EMU = 914_400; // per inch

function firstRunProps(n: El | null | undefined): El | null {
  if (!n) return null;
  const r = n.getElementsByTagName("w:r")[0] as El | undefined;
  return r ? (child(r, "w:rPr") as El | null) : null;
}

export async function fillForm(data: Uint8Array | ArrayBuffer, fill: FormFill, images: FormImages = {}): Promise<{ file: Uint8Array; filled: number }> {
  const { zip, doc, scanner } = await open(data);
  const relsPath = "word/_rels/document.xml.rels";
  const rels = new DOMParser().parseFromString((await zip.file(relsPath)?.async("string")) ?? `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`, "text/xml");
  const types = new DOMParser().parseFromString(await zip.file("[Content_Types].xml")!.async("string"), "text/xml");
  const w = new Writer(zip, doc, rels, types);
  const checks = new Set(fill.checks);
  let filled = 0;

  const content = (value: string, rPr: El | null, kind: SlotKind): El | null => {
    if (value === "[[SIGNATURE]]") return images.signature ? w.image(images.signature, 1.3 * EMU, 0.6 * EMU) : null;
    if (value === "[[PHOTO]]") return images.photo ? w.image(images.photo, 1.18 * EMU, 1.57 * EMU) : null; // 3x4 cm
    return w.run(kind === "after" ? ` ${value}` : value, rPr);
  };

  for (const slot of scanner.slots) {
    if (slot.kind === "check") {
      if (!checks.has(slot.id)) continue;
      if (slot.index === -1) slot.textNode!.setAttribute("w:char", "F0FE");
      else {
        const t = slot.textNode!.textContent ?? "";
        slot.textNode!.textContent = t.slice(0, slot.index) + "☒" + t.slice(slot.index! + 1);
        // Keep Word's checkbox content control in sync when there is one.
        for (let a: Node | null = slot.textNode!.parentNode; a; a = a.parentNode) {
          if ((a as El).nodeName === "w:sdt") {
            const checked = (a as El).getElementsByTagNameNS(W14_NS, "checked")[0] as El | undefined;
            if (checked) checked.setAttributeNS(W14_NS, "w14:val", "1");
            break;
          }
        }
      }
      filled++;
      continue;
    }

    const value = (fill.values[slot.id] ?? "").trim();
    if (!value) continue;

    if (slot.kind === "choice") {
      const sdt = slot.node;
      const pr = child(sdt, "w:sdtPr");
      const placeholder = pr && child(pr, "w:showingPlcHdr");
      if (placeholder) pr!.removeChild(placeholder);
      const sc = child(sdt, "w:sdtContent");
      const ts = sc ? (Array.from(sc.getElementsByTagName("w:t")) as El[]) : [];
      if (ts.length) {
        ts[0].textContent = value;
        ts.slice(1).forEach((t) => (t.textContent = ""));
        // Placeholder text is often styled grey; drop that style.
        for (const r of Array.from(sc!.getElementsByTagName("w:r")) as El[]) {
          const rPr = child(r, "w:rPr");
          const style = rPr && child(rPr, "w:rStyle");
          if (style && /placeholder/i.test(attr(style, "w:val") ?? "")) rPr!.removeChild(style);
        }
      }
      filled++;
    } else if (slot.kind === "blank") {
      const t = slot.textNode!;
      if (value.startsWith("[[")) {
        t.textContent = (t.textContent ?? "").replace(slot.match!, " ");
        const img = content(value, null, "blank");
        if (img) t.parentNode!.parentNode!.insertBefore(img, t.parentNode!.nextSibling);
      } else {
        t.textContent = (t.textContent ?? "").replace(slot.match!, value);
        t.setAttribute("xml:space", "preserve");
      }
      filled++;
    } else if (slot.kind === "sign" || slot.kind === "photo") {
      const node = content(value, null, slot.kind);
      if (!node) continue;
      if (slot.kind === "photo") {
        for (const r of kids(slot.node).filter((k) => k.nodeName === "w:r")) slot.node.removeChild(r);
        slot.node.appendChild(node);
      } else {
        const p = doc.createElementNS(W_NS, "w:p");
        const pPr = child(slot.node, "w:pPr");
        if (pPr) p.appendChild(pPr.cloneNode(true));
        p.appendChild(node);
        slot.node.parentNode!.insertBefore(p, slot.node.nextSibling);
      }
      filled++;
    } else if (slot.kind === "after") {
      const runs = Array.from(slot.node.getElementsByTagName("w:r")) as El[];
      const node = content(value, runs.length ? child(runs[runs.length - 1], "w:rPr") : null, "after");
      if (node) {
        slot.node.appendChild(node);
        filled++;
      }
    } else if (slot.kind === "cell") {
      const tc = slot.node;
      let p = child(tc, "w:p");
      if (!p) {
        p = doc.createElementNS(W_NS, "w:p");
        tc.appendChild(p);
      }
      // Cells that only hold ":" keep it, and the answer follows it.
      const colon = /^[:：]$/.test(clean(textOf(tc)));
      if (!colon) for (const r of kids(p).filter((k) => k.nodeName === "w:r")) p.removeChild(r);
      const rPr = firstRunProps(slot.labelCell) ?? (child(p, "w:pPr") && child(child(p, "w:pPr")!, "w:rPr"));
      const node = content(value, rPr ? (rPr.cloneNode(true) as El) : null, colon ? "after" : "cell");
      if (node) {
        // A run's rPr must not carry bold from a bold label.
        const b = node.getElementsByTagName("w:b")[0];
        if (b && b.parentNode) b.parentNode.removeChild(b);
        p.appendChild(node);
        filled++;
      }
    }
  }

  for (const { find, replace } of fill.replacements ?? []) {
    if (!find.trim()) continue;
    for (const p of Array.from(doc.getElementsByTagName("w:p")) as El[]) {
      const ts = (Array.from(p.getElementsByTagName("w:t")) as El[]).filter((t) => {
        for (let a: Node | null = t.parentNode; a && a !== p; a = a.parentNode) if ((a as El).nodeName === "w:p") return false;
        return true;
      });
      const joined = ts.map((t) => t.textContent ?? "").join("");
      const at = joined.indexOf(find);
      if (at < 0) continue;
      // Rewrite only the text nodes the match touches; the first keeps the result.
      let pos = 0;
      let first: El | null = null;
      let prefix = "";
      let suffix = "";
      for (const t of ts) {
        const txt = t.textContent ?? "";
        const start = pos;
        const end = pos + txt.length;
        pos = end;
        if (end <= at || start >= at + find.length) continue;
        if (!first) {
          first = t;
          prefix = txt.slice(0, at - start);
        }
        if (end >= at + find.length) suffix = txt.slice(at + find.length - start);
        t.textContent = "";
      }
      if (first) {
        first.textContent = prefix + replace + suffix;
        first.setAttribute("xml:space", "preserve");
        filled++;
      }
      break;
    }
  }

  const ser = new XMLSerializer();
  zip.file("word/document.xml", ser.serializeToString(doc));
  zip.file(relsPath, ser.serializeToString(rels));
  zip.file("[Content_Types].xml", ser.serializeToString(types));
  const file = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { file, filled };
}

export function dataUrlToBytes(url: string | null | undefined): Uint8Array | null {
  if (!url) return null;
  const b64 = url.split(",")[1] ?? "";
  if (typeof atob === "function") return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array(Buffer.from(b64, "base64"));
}
