import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import type { CvDocument, CvSection } from "../shared/schemas.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = [path.resolve(here, "../assets/fonts"), path.resolve(here, "../../server/assets/fonts")].find((d) =>
  fs.existsSync(path.join(d, "Carlito-Regular.ttf")),
);

const SIZE = 8.7;
const GAP = 1.5; // line gap -> ~10.2pt leading
const MARGIN_X = 40;
const MARGIN_Y = 34;
const LINK = "#1155CC";

/** Replaces characters that confuse ATS parsers or that the font may not cover. */
export function atsSafe(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[→⇒➜➔]/g, "to")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "");
}

/** Renders a CV as a text-based, single-column, table-free PDF that ATS parsers read cleanly. */
export function renderCvPdf(cv: CvDocument): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X },
    info: { Title: `${atsSafe(cv.name)} - CV`, Author: atsSafe(cv.name), Subject: "Curriculum Vitae" },
    autoFirstPage: true,
  });
  const fonts = fontDir
    ? {
        regular: path.join(fontDir, "Carlito-Regular.ttf"),
        bold: path.join(fontDir, "Carlito-Bold.ttf"),
        italic: path.join(fontDir, "Carlito-Italic.ttf"),
      }
    : { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };
  doc.registerFont("R", fonts.regular);
  doc.registerFont("B", fonts.bold);
  doc.registerFont("I", fonts.italic);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = MARGIN_X;
  const width = doc.page.width - MARGIN_X * 2;
  const bottom = () => doc.page.height - MARGIN_Y;
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };
  const t = (s: string) => atsSafe(s ?? "").trim();

  /* ---------- Header ---------- */
  doc.font("B").fontSize(13).fillColor("black").text(t(cv.name), left, doc.y, { width, align: "center" });
  doc.moveDown(0.1);
  if (cv.headline) doc.font("B").fontSize(SIZE).text(t(cv.headline), left, doc.y, { width, align: "center", lineGap: GAP });
  const contact = cv.contact.map(t).filter(Boolean);
  if (contact.length) {
    // Measure to center the mixed plain/link line manually.
    doc.font("R").fontSize(SIZE);
    const sep = " | ";
    const full = contact.join(sep);
    const fullW = doc.widthOfString(full);
    if (fullW > width) {
      doc.text(full, left, doc.y, { width, align: "center", lineGap: GAP });
    } else {
      let x = left + (width - fullW) / 2;
      const y = doc.y;
      contact.forEach((item, i) => {
        const isLink = /^https?:\/\//i.test(item);
        doc.fillColor(isLink ? LINK : "black").text(item, x, y, {
          lineBreak: false,
          link: isLink ? item : undefined,
          underline: isLink,
        });
        x += doc.widthOfString(item);
        if (i < contact.length - 1) {
          doc.fillColor("black").text(sep, x, y, { lineBreak: false });
          x += doc.widthOfString(sep);
        }
      });
      doc.fillColor("black");
      doc.x = left;
      doc.y = y + SIZE + GAP + 1;
    }
  }

  /* ---------- Building blocks ---------- */
  const sectionTitle = (title: string) => {
    ensure(40);
    doc.y += 7;
    doc.font("B").fontSize(11).fillColor("black").text(t(title), left, doc.y, { width });
    const y = doc.y + 1;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.8).strokeColor("black").stroke();
    doc.y = y + 4;
  };

  const bulletHeight = (text: string, bold?: string) => {
    doc.font("R").fontSize(SIZE);
    return doc.heightOfString((bold ? `${bold} ` : "") + text, { width: width - 14, lineGap: GAP });
  };

  const bullet = (text: string, bold?: string) => {
    const h = bulletHeight(text, bold);
    ensure(Math.min(h, 3 * (SIZE + GAP)));
    const y = doc.y;
    doc.font("R").fontSize(SIZE).text("•", left + 4, y, { lineBreak: false });
    if (bold) {
      doc.font("B").text(`${t(bold)} `, left + 14, y, { width: width - 14, continued: true, lineGap: GAP });
      doc.font("R").text(t(text), { width: width - 14, lineGap: GAP });
    } else {
      doc.font("R").text(t(text), left + 14, y, { width: width - 14, lineGap: GAP });
    }
    doc.x = left;
  };

  const entryHeight = (e: CvSection["entries"][number]) => {
    doc.font("B").fontSize(SIZE);
    let h = doc.heightOfString(t(e.title) || " ", { width: width - 120, lineGap: GAP });
    if (e.subtitle) h += doc.font("I").heightOfString(t(e.subtitle), { width, lineGap: GAP });
    for (const b of e.bullets) h += bulletHeight(b);
    return h;
  };

  const entry = (e: CvSection["entries"][number], first: boolean) => {
    const h = entryHeight(e);
    // Keep short entries together; long ones may break but never leave a lone heading.
    ensure(h < 220 ? h : 60);
    if (!first) doc.y += 3;
    const y = doc.y;
    const date = t(e.date);
    doc.font("R").fontSize(SIZE);
    const dateW = date ? doc.widthOfString(date) + 10 : 0;
    if (date) doc.text(date, left, y, { width, align: "right", lineBreak: false });
    doc.font("B").fontSize(SIZE).text(t(e.title), left, y, { width: width - dateW, lineGap: GAP });
    if (e.subtitle) doc.font("I").text(t(e.subtitle), left, doc.y, { width, lineGap: GAP });
    for (const b of e.bullets) if (t(b)) bullet(b);
  };

  /* ---------- Sections ---------- */
  for (const s of cv.sections) {
    const hasContent =
      (s.kind === "paragraph" && t(s.text)) ||
      (s.kind === "skills" && s.skills.length) ||
      (s.kind === "bullets" && s.bullets.length) ||
      (s.kind === "entries" && s.entries.length);
    if (!hasContent) continue;
    sectionTitle(s.title);
    if (s.kind === "paragraph") {
      doc.font("R").fontSize(SIZE).text(t(s.text), left, doc.y, { width, lineGap: GAP, align: "left" });
    } else if (s.kind === "skills") {
      for (const g of s.skills) if (t(g.items)) bullet(g.items, g.category ? `${g.category}:` : undefined);
    } else if (s.kind === "bullets") {
      for (const b of s.bullets) if (t(b)) bullet(b);
    } else {
      s.entries.forEach((e, i) => entry(e, i === 0));
    }
  }

  doc.end();
  return done;
}

export function pdfFileName(cv: CvDocument, company?: string) {
  const base = [cv.name, company].filter(Boolean).join(" ").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
  return `CV_${base || "export"}.pdf`;
}
