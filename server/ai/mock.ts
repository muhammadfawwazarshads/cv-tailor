/**
 * Deterministic stand-in for an LLM, enabled with ENABLE_MOCK_LLM=true.
 * Useful for local development, demos, and automated tests without API keys.
 */
import type { Analysis, Answer, CvDocument, Lead, LeadsResult, Profile, TailorResult } from "../shared/schemas.js";
import { emptyProfile } from "../shared/schemas.js";
import { profileToCv, profileToText } from "./convert.js";

const TERMS = [
  "Go", "Golang", "Python", "Java", "JavaScript", "TypeScript", "Node.js", "React", "Next.js", "Vue", "Flutter", "Kotlin", "C++",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Kafka", "RabbitMQ",
  "AWS", "GCP", "Google Cloud", "Azure", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "CI/CD", "Linux", "Bash", "Nginx",
  "REST", "GraphQL", "Microservices", "LLM", "RAG", "Machine Learning", "Excel", "Power BI", "Tableau", "Figma", "Git", "Playwright", "ServiceNow",
];

const has = (text: string, term: string) => new RegExp(`(^|[^a-z0-9])${term.replace(/[.+#/]/g, (c) => `\\${c}`)}([^a-z0-9]|$)`, "i").test(text);

function analyze(meta: { profile: Profile; jobDescription: string; answers: Answer[] }): Analysis {
  const profileText = profileToText(meta.profile) + "\n" + meta.answers.map((a) => a.answer).join("\n");
  const wanted = TERMS.filter((t) => has(meta.jobDescription, t));
  const matched = wanted.filter((t) => has(profileText, t));
  const missing = wanted.filter((t) => !matched.includes(t));
  const answered = new Set(meta.answers.map((a) => a.question));
  const fitScore = wanted.length ? Math.max(20, Math.min(95, Math.round((matched.length / wanted.length) * 100))) : 60;
  return {
    fitScore,
    verdict: fitScore >= 70 ? "Cocok, layak daftar" : fitScore >= 45 ? "Lumayan, ada beberapa gap" : "Berat, banyak syarat belum terpenuhi",
    summary: `(Mode demo) ${matched.length} dari ${wanted.length} kata kunci teknis di JD ada di profil kamu.`,
    focus: matched.slice(0, 5),
    strengths: matched.slice(0, 6).map((t) => ({ point: t, evidence: "Disebut di profil kamu" })),
    gaps: missing.slice(0, 6).map((t) => ({ point: t, severity: "medium" as const, advice: `Pelajari dasar ${t} atau bikin mini project.` })),
    questions: missing
      .map((t, i) => ({ id: `q${i + 1}`, question: `Pernah pakai ${t}? Kalau iya, di project mana dan sejauh apa?`, reason: `${t} disebut di JD` }))
      .filter((q) => !answered.has(q.question))
      .slice(0, 5),
  };
}

function tailor(meta: { profile: Profile; answers: Answer[] }): TailorResult {
  const cv = profileToCv(meta.profile);
  const removed: string[] = [];
  for (const a of meta.answers) {
    const term = TERMS.find((t) => a.question.includes(`pakai ${t}`));
    if (term && /\b(belum|tidak|nggak|ga)\b/i.test(a.answer)) {
      for (const s of cv.sections) {
        s.skills = s.skills.map((g) => ({
          ...g,
          items: g.items
            .split(",")
            .map((x) => x.trim())
            .filter((x) => !has(x, term))
            .join(", "),
        }));
      }
      removed.push(term);
    }
  }
  return {
    cv,
    changes: ["(Mode demo) CV disusun langsung dari profil master tanpa penulisan ulang AI.", ...removed.map((t) => `${t} dihapus karena kamu bilang belum pernah pakai.`)],
    notClaimed: removed.map((t) => `${t}: tidak diklaim, siapkan jawaban jujur saat interview.`),
    interviewPrep: ["Ceritakan project yang paling relevan dengan role ini."],
  };
}

function revise(meta: { cv: CvDocument; notes: Partial<TailorResult>; instruction: string }): TailorResult {
  const m = meta.instruction.match(/ganti\s+(.+?)\s+(?:jadi|menjadi|dengan|ke)\s+(.+)/i);
  let cv = meta.cv;
  const changes: string[] = [];
  if (m) {
    const from = m[1].trim().replace(/^["']|["']$/g, "");
    const to = m[2].trim().replace(/^["']|["']$/g, "");
    const json = JSON.stringify(cv);
    if (json.includes(from)) {
      cv = JSON.parse(json.split(from).join(to.replace(/"/g, '\\"')));
      changes.push(`"${from}" diganti jadi "${to}".`);
    } else changes.push(`Teks "${from}" tidak ditemukan di CV.`);
  } else changes.push("(Mode demo) Hanya instruksi 'ganti X jadi Y' yang didukung.");
  return { cv, changes, notClaimed: meta.notes.notClaimed ?? [], interviewPrep: meta.notes.interviewPrep ?? [] };
}

function extract(meta: { sourceText: string }): Profile {
  const p = emptyProfile();
  const lines = meta.sourceText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  p.name = lines[0] ?? "";
  p.contact.email = meta.sourceText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "";
  p.contact.phone = meta.sourceText.match(/\+?\d[\d\s-]{8,}\d/)?.[0] ?? "";
  p.contact.website = meta.sourceText.match(/https?:\/\/\S+/)?.[0] ?? "";
  const heading = /^(summary|profile|about|ringkasan|tentang saya)$/i;
  const start = lines.findIndex((l) => heading.test(l));
  const body: string[] = [];
  if (start >= 0) {
    for (const l of lines.slice(start + 1)) {
      if (/^[A-Z][A-Za-z &]{2,40}$/.test(l) && !/[.,]/.test(l)) break; // next section heading
      body.push(l);
    }
  }
  p.summary = body.join(" ").slice(0, 600);
  p.headline = lines[1] && !/@|\d{6,}/.test(lines[1]) ? lines[1] : "";
  const found = TERMS.filter((t) => has(meta.sourceText, t));
  if (found.length) p.skills = [{ category: "Technical Skills", items: found.join(", ") }];
  return p;
}

const BIG = ["schneider", "toyota", "astra", "shopee", "sea", "google", "microsoft", "samsung", "unilever", "epson", "honda", "telkom", "bank", "ntt", "accenture", "ey", "stmicroelectronics", "tiket.com", "gojek", "tokopedia", "grab"];
const TITLE = /\b(engineer|developer|analyst|staff|specialist|consultant|architect|intern|programmer|administrator|scientist)\b/i;

function leads(meta: { profile: Profile; sourceText: string }): LeadsResult {
  const lines = meta.sourceText.split(/\r?\n/).map((l) => l.trim());
  const starts = lines.map((l, i) => (l.length < 80 && TITLE.test(l) ? i : -1)).filter((i) => i >= 0);
  const profileText = profileToText(meta.profile);
  const jobs: Lead[] = starts.slice(0, 25).map((start, n) => {
    const end = starts[n + 1] ?? lines.length;
    const body = lines.slice(start + 1, end).filter(Boolean);
    const company = body[0] ?? "";
    const text = body.join("\n");
    const wanted = TERMS.filter((t) => has(text, t));
    const matched = wanted.filter((t) => has(profileText, t));
    const fitScore = wanted.length ? Math.round((matched.length / wanted.length) * 100) : 50;
    const redFlags = [
      /biaya|fee|deposit/i.test(text) && "Ada permintaan biaya",
      /whatsapp|wa\.me|@gmail\.com/i.test(text) && "Kontak pribadi (WA/Gmail)",
    ].filter(Boolean) as string[];
    const big = BIG.some((b) => norm(company).split(" ").includes(b));
    return {
      title: lines[start],
      company,
      location: body[1] ?? "",
      workMode: /remote/i.test(text) ? "remote" : /hybrid/i.test(text) ? "hybrid" : "",
      employmentType: "",
      seniority: "",
      postedAt: "",
      applyInfo: text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "",
      deadline: "",
      jobDescription: body.length > 3 ? text : "",
      hasDetails: body.length > 3,
      category: /devops|cloud|sre/i.test(lines[start]) ? "DevOps/Cloud" : /data/i.test(lines[start]) ? "Data" : "Software",
      manufacturing: /manufactur|pabrik|factory|mes\b/i.test(text),
      companyTier: big ? "large" : "unknown",
      companyNote: big ? "(Mode demo) Nama perusahaan dikenal." : "(Mode demo) Perusahaan tidak dikenali.",
      redFlags,
      fitScore,
      fitReason: `(Mode demo) ${matched.length} dari ${wanted.length} kata kunci teknis cocok.`,
      matched: matched.slice(0, 5),
      missing: wanted.filter((t) => !matched.includes(t)).slice(0, 5),
      recommendation: redFlags.length ? "skip" : fitScore >= 60 ? "apply" : "try",
    };
  });
  return { jobs };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();

export function mockResponse(task: string, meta: any): unknown {
  switch (task) {
    case "extract_profile":
      return extract(meta);
    case "analyze":
      return analyze(meta);
    case "tailor":
      return tailor(meta);
    case "revise":
      return revise(meta);
    case "extract_leads":
      return leads(meta);
    default:
      return { ok: true };
  }
}
