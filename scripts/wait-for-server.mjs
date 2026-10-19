// Holds back the Vite dev server until the API answers, so a tab left open from the
// previous run doesn't hit the proxy while the server is still booting (ECONNREFUSED).
const url = `http://localhost:${process.env.PORT || 3000}/api/health`;
const deadline = Date.now() + 60_000;

while (Date.now() < deadline) {
  try {
    if ((await fetch(url)).ok) process.exit(0);
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
console.warn(`[wait] ${url} not reachable after 60s, starting Vite anyway`);
