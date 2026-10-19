/**
 * End-to-end API smoke test using the mock LLM.
 * Start the server first:  ENABLE_MOCK_LLM=true DATA_DIR=./data-smoke PORT=3999 npm run dev:server
 * Then run:                BASE_URL=http://localhost:3999 npm run smoke
 */
import fs from "node:fs";
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
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
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

const st = await user("PATCH", `/api/applications/${app.id}`, { status: "applied" });
check(st.application.status === "applied", "update status");

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
