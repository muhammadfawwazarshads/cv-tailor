/**
 * End-to-end API smoke test using the mock LLM.
 * Start the server first:  ENABLE_MOCK_LLM=true DATA_DIR=./data-smoke PORT=3999 npm run dev:server
 * Then run:                BASE_URL=http://localhost:3999 npm run smoke
 */
import fs from "node:fs";
import JSZip from "jszip";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3999";
let failures = 0;

function check(cond: unknown, label: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

function client() {
  let cookie = "";
  return async function api(method: string, url: string, body?: unknown, raw = false) {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json } as any;
  };
}

const stamp = Date.now();
const admin = client();
const user = client();

const a1 = await admin("POST", "/api/auth/register", { email: `admin${stamp}@example.com`, password: "password123", name: "Admin" });
check(a1.status === 200, `register first user (${a1.user?.role})`);
const u1 = await user("POST", "/api/auth/register", { email: `user${stamp}@example.com`, password: "password123", name: "User" });
check(u1.status === 200 && u1.user.role === "user", "second account is a normal user");

check((await user("GET", "/api/admin/usage")).status === 403, "normal user cannot open admin endpoints");
check((await user("POST", "/api/auth/login", { email: `user${stamp}@example.com`, password: "wrong-password" })).status === 401, "wrong password rejected");

// Providers: a broken one first, the mock second, to exercise fallback.
const broken = await admin("POST", "/api/admin/providers", {
  name: "Broken endpoint",
  type: "openai-compatible",
  model: "gpt-test",
  baseUrl: "http://127.0.0.1:9/v1",
  priority: 10,
});
check(broken.status === 201, "create broken provider");
const mock = await admin("POST", "/api/admin/providers", { name: "Mock", type: "mock", model: "mock", priority: 20 });
check(mock.status === 201, "create mock provider");
const keyed = await admin("POST", "/api/admin/providers", { name: "Claude", type: "anthropic", model: "claude-sonnet-5-5", apiKey: "sk-ant-secret-123456", enabled: false, priority: 30 });
check(keyed.status === 201 && keyed.provider.api_key_masked === "sk-a••••3456" && !("api_key_enc" in keyed.provider), "API key stored encrypted and returned masked");
check((await admin("POST", "/api/admin/providers", { name: "x", type: "anthropic", model: "m" })).status === 400, "anthropic without key rejected");
const tBroken = await admin("POST", `/api/admin/providers/${broken.provider.id}/test`);
check(tBroken.ok === false, `test broken provider fails (${tBroken.error})`);
const tMock = await admin("POST", `/api/admin/providers/${mock.provider.id}/test`);
check(tMock.ok === true, "test mock provider succeeds");

// Profile import + save
const cvText = fs.readFileSync(path.resolve("scripts/fixtures/sample-cv.txt"), "utf8");
check((await user("POST", "/api/applications", { jobDescription: "x".repeat(100) })).status === 400, "cannot create application with empty profile");
const imp = await user("POST", "/api/profile/import", { text: cvText });
check(imp.status === 200 && imp.profile?.name === "Alex Pratama", `import profile via AI with fallback (provider: ${imp.provider})`);
const profile = {
  ...imp.profile,
  headline: "Technology Consultant | Backend Engineer",
  experience: [
    {
      section: "Work Experience",
      organization: "Nusantara Consulting",
      role: "Technology Consultant",
      start: "Mar 2025",
      end: "Present",
      bullets: ["Built an approval workflow for budget submissions used by 300 employees."],
    },
  ],
};
const saved = await user("PUT", "/api/profile", { profile });
check(saved.status === 200 && saved.profile.experience[0].id, "save profile");

// Application flow
const jd = `We are hiring a DevOps Engineer. Requirements: strong Go or Python, AWS, Docker, Kubernetes, Ansible, Terraform, Linux, CI/CD with GitHub Actions. Nice to have: Redis, PostgreSQL.`;
const created = await user("POST", "/api/applications", { company: "Acme", roleTitle: "DevOps Engineer", jobDescription: jd, cvLanguage: "English" });
const app = created.application;
check(created.status === 201 && app.analysis?.fitScore >= 0, `create application + analysis (fit ${app.analysis?.fitScore})`);
check(app.status === "questions" && app.analysis.questions.length > 0, `analysis asks questions (${app.analysis.questions.length})`);

const q = app.analysis.questions.find((x: any) => x.question.includes("Kubernetes")) ?? app.analysis.questions[0];
const ans = await user("POST", `/api/applications/${app.id}/answers`, {
  answers: [{ questionId: q.id, question: q.question, answer: "Belum pernah", saveAsFact: true }],
});
check(ans.status === 200 && ans.application.answers.length === 1, "save answers");
const facts = await user("GET", "/api/facts");
check(facts.facts.length === 1, "answer saved as confirmed fact");

const re = await user("POST", `/api/applications/${app.id}/analyze`);
check(re.status === 200 && !re.application.analysis.questions.some((x: any) => x.question === q.question), "re-analysis skips answered question");

const t = await user("POST", `/api/applications/${app.id}/tailor`);
check(t.status === 200 && t.version.number === 1, "tailor creates version 1");
const cvJson = JSON.stringify(t.version.data);
check(!/Kubernetes/.test(JSON.stringify(t.version.data.sections.filter((s: any) => s.kind === "skills"))), "skill the user denied is not claimed");
check(cvJson.includes("Nusantara Consulting"), "CV keeps real experience");

const r = await user("POST", `/api/applications/${app.id}/versions/${t.version.id}/revise`, {
  instruction: "ganti Technology Consultant jadi Senior Technology Consultant",
});
check(r.status === 200 && r.version.number === 2 && JSON.stringify(r.version.data).includes("Senior Technology Consultant"), "revise creates version 2");

const edited = structuredClone(r.version.data);
edited.headline = "Edited headline";
const m = await user("PUT", `/api/applications/${app.id}/versions/${r.version.id}`, { cv: edited });
check(m.status === 200 && m.version.number === 3 && m.version.data.headline === "Edited headline", "manual edit creates version 3");

const pdf = await user("GET", `/api/applications/${app.id}/versions/${m.version.id}/pdf`, undefined, true);
check(pdf.status === 200 && pdf.buf.subarray(0, 4).toString() === "%PDF", `PDF export (${pdf.buf.length} bytes)`);
const outDir = path.resolve(process.env.SMOKE_OUT_DIR || "scripts/tmp");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "smoke.pdf"), pdf.buf);

// Drafts: application email, cover letter, follow-up
const d1 = await user("POST", `/api/applications/${app.id}/drafts`, { kind: "email", language: "English", instruction: "Mention I can relocate" });
const email = d1.application?.drafts?.find((d: any) => d.kind === "email");
check(d1.status === 200 && email?.variants.length === 2 && email.subject, "email draft with two variants");
check(email?.variants[0].body.includes("Alex Pratama") && email.variants[0].body.includes("relocate"), "draft has signature and follows the instruction");
const d2 = await user("POST", `/api/applications/${app.id}/drafts`, { kind: "cover_letter", language: "English" });
check(d2.application.drafts.length === 2, "cover letter kept next to email draft");
const d3 = await user("POST", `/api/applications/${app.id}/drafts`, { kind: "email", language: "Bahasa Indonesia" });
check(d3.application.drafts.length === 2 && d3.application.drafts[0].language === "Bahasa Indonesia", "regenerating replaces the draft of the same kind");
check((await user("POST", `/api/applications/${app.id}/drafts`, { kind: "poem" })).status === 400, "unknown draft kind rejected");

const st = await user("PATCH", `/api/applications/${app.id}`, { status: "applied" });
check(st.application.status === "applied", "update status");

// Job leads: paste a noisy page with several jobs
const page = `LinkedIn  Home  My Network  Jobs  Messaging
Search results
DevOps Engineer
Schneider Electric
Cikarang, West Java (Hybrid)
About the job: we digitalize our manufacturing plants. Requirements: Linux, Docker, AWS, Python, CI/CD with GitHub Actions.
Responsibilities: deploy services, automate builds, monitor production.
Apply by email to careers@example.com
Data Entry Staff
Maju Jaya Abadi
Bekasi
Kirim CV via WhatsApp 0812xxxx, ada biaya pelatihan Rp500.000. Lowongan cepat tanpa interview.
Syarat: bisa Excel, teliti, jujur.
Backend Developer
Toyota
Promoted`;
const ex = await user("POST", "/api/leads/extract", { text: page, preferences: "Software, DevOps" });
check(ex.status === 201 && ex.leads.length === 3, `extract leads from pasted page (${ex.leads?.length})`);
const devops = ex.leads.find((l: any) => l.title === "DevOps Engineer");
const spam = ex.leads.find((l: any) => l.title === "Data Entry Staff");
check(devops?.data.companyTier === "large" && devops.data.manufacturing, "big manufacturing company labelled");
check(spam?.data.redFlags.length > 0 && spam.data.recommendation === "skip", "red flags detected");
const again = await user("POST", "/api/leads/extract", { text: page });
check(again.status === 201 && again.leads.length === 0 && again.skipped === 3, "re-pasting skips duplicates");
const card = ex.leads.find((l: any) => l.title === "Backend Developer");
check((await user("POST", `/api/leads/${card.id}/apply`)).status === 400, "card without description cannot become an application");
const dismissed = await user("PATCH", `/api/leads/${spam.id}`, { status: "dismissed" });
check(dismissed.lead.status === "dismissed", "dismiss lead");
const fromLead = await user("POST", `/api/leads/${devops.id}/apply`, { cvLanguage: "English" });
check(fromLead.status === 201 && fromLead.application.role_title === "DevOps Engineer" && fromLead.application.analysis, "lead becomes an analysed application");
const leadsNow = await user("GET", "/api/leads");
check(leadsNow.leads.find((l: any) => l.id === devops.id).status === "applied", "lead marked as applied");
check((await admin("GET", "/api/leads")).leads.length === 0, "leads are private per user");

// Personal data + company form
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
check((await user("PUT", "/api/personal", { signature: "data:text/html;base64,AAAA" })).status === 400, "non-image signature rejected");
const pd = await user("PUT", "/api/personal", { signature: PNG_1PX, personal: { items: [{ label: "Name", value: "Alex Pratama" }] } });
check(pd.status === 200 && pd.signature === PNG_1PX && pd.personal.items.length === 1, "save signature and remembered answer");
check((await admin("GET", "/api/personal")).signature === null, "personal data is private per user");

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const cell = (t: string) => `<w:tc><w:p>${t ? `<w:r><w:rPr><w:b/></w:rPr><w:t>${t}</w:t></w:r>` : ""}</w:p></w:tc>`;
const para = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${para("DATE: 2025/10/01")}<w:tbl><w:tr>${cell("Name")}${cell("")}</w:tr><w:tr>${cell("Blood Type")}${cell("")}</w:tr></w:tbl>${para("Gender ☐ Male ☐ Female")}${para("Signature of applicant")}${para("Date: __________")}</w:body></w:document>`;
const zip = new JSZip();
zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
zip.file("word/document.xml", docXml);
const formBuf = await zip.generateAsync({ type: "nodebuffer" });
async function upload(url: string, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("file", new Blob([formBuf]), "Form Data Diri.docx");
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return user("POST", url, fd as any);
}
const fa = await upload("/api/forms/analyze");
const nameSlot = fa.slots?.find((x: any) => x.label === "Name");
const bloodQ = fa.plan?.questions.find((q: any) => q.question.includes("Blood Type"));
const sign = fa.slots?.find((x: any) => x.kind === "sign");
check(fa.status === 200 && nameSlot && sign && fa.slots.filter((x: any) => x.kind === "check").length === 2, `form slots detected (${fa.slots?.map((x: any) => x.kind).join(",")})`);
check(fa.plan.values.some((v: any) => v.id === nameSlot.id && v.value === "Alex Pratama"), "remembered answer fills the form");
check(bloodQ && fa.plan.values.some((v: any) => v.value === "[[SIGNATURE]]"), "missing data becomes a question; signature placed");
const male = fa.slots.find((x: any) => x.kind === "check" && x.label === "Male");
const ff = await upload("/api/forms/fill", {
  fill: JSON.stringify({
    values: { ...Object.fromEntries(fa.plan.values.map((v: any) => [v.id, v.value])), [bloodQ.slotIds[0]]: "B" },
    checks: [male.id],
    replacements: [{ find: "DATE: 2025/10/01", replace: "DATE: 2026/10/19" }],
  }),
});
check(ff.status === 200 && ff.filled >= 5, `fill form (${ff.filled} fields)`);
const outZip = await JSZip.loadAsync(Buffer.from(ff.file ?? "", "base64"));
const outXml = (await outZip.file("word/document.xml")?.async("string")) ?? "";
check(outXml.includes("Alex Pratama") && outXml.includes(">B<") && outXml.includes("☒ Male") && outXml.includes("2026/10/19"), "filled values written into the document");
check(Object.keys(outZip.files).some((f) => f.startsWith("word/media/")) && outXml.includes("r:embed"), "signature image embedded");
check((await user("POST", "/api/forms/analyze", { not: "a file" })).status === 400, "analyze without a file rejected");

// Isolation between users
check((await admin("GET", `/api/applications/${app.id}`)).status === 404, "other users cannot read the application");
check((await admin("GET", `/api/applications/not-a-uuid`)).status === 404, "malformed id returns 404");

// Usage log shows the failed attempt on the broken provider and successes on the mock.
const usage = await admin("GET", "/api/admin/usage");
const names = usage.summary.map((s: any) => `${s.provider_name}:${s.ok}/${s.calls}`).join(", ");
check(
  usage.summary.some((s: any) => s.provider_name === "Broken endpoint" && s.errors > 0) && usage.summary.some((s: any) => s.provider_name === "Mock" && s.ok > 0),
  `usage log records fallback (${names})`,
);

// All providers failing gives a clear error.
await admin("PUT", `/api/admin/providers/${mock.provider.id}`, { name: "Mock", type: "mock", model: "fail", priority: 20 });
const allFail = await user("POST", `/api/applications/${app.id}/analyze`);
check(allFail.status === 502 && /Semua provider AI gagal/.test(allFail.error), "clear error when every provider fails");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
