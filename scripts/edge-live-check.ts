// Post-deploy check: calls every deployed backend function once and confirms it
// started. Sends a harmless CORS preflight (OPTIONS) — no body, no auth, no side
// effects. A function that failed to boot answers 5xx (BOOT_ERROR / 503) or not
// at all; any other answer, even 401/404/405, proves the code started.
//
// Usage: deno run -A --no-config scripts/edge-live-check.ts [name ...]
// Env:   EDGE_BASE_URL (defaults to the project's functions URL)
const BASE = Deno.env.get("EDGE_BASE_URL") ??
  "https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1";
const root = new URL("../supabase/functions/", import.meta.url);

const requested = Deno.args;
const names: string[] = [];
for await (const e of Deno.readDir(root)) {
  if (!e.isDirectory || e.name.startsWith("_")) continue;
  if (requested.length && !requested.includes(e.name)) continue;
  try { await Deno.stat(new URL(`${e.name}/index.ts`, root)); names.push(e.name); } catch { /* none */ }
}
names.sort();

async function probe(name: string): Promise<{ ok: boolean; detail: string }> {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) { // absorb cold starts / redeploy windows
    try {
      const res = await fetch(`${BASE}/${name}`, {
        method: "OPTIONS",
        headers: { Origin: "https://www.maisonaffluency.com", "Access-Control-Request-Method": "POST" },
        signal: AbortSignal.timeout(20000),
      });
      const body = (await res.text()).slice(0, 160).replace(/\s+/g, " ");
      if (res.status < 500) return { ok: true, detail: `HTTP ${res.status}` };
      last = `HTTP ${res.status} ${body}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  return { ok: false, detail: last };
}

const failures: { name: string; detail: string }[] = [];
const queue = [...names];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const name = queue.shift()!;
    const r = await probe(name);
    console.log(`${r.ok ? "ok  " : "FAIL"}  ${name} — ${r.detail}`);
    if (!r.ok) failures.push({ name, detail: r.detail });
  }
}));

console.log(`\n${names.length - failures.length}/${names.length} deployed functions started.`);
if (failures.length) {
  console.error(`\n${failures.length} deployed function(s) not starting:`);
  for (const f of failures.sort((a, b) => a.name.localeCompare(b.name))) console.error(`  - ${f.name}: ${f.detail}`);
  Deno.exit(1);
}
