// Boot check for every backend function.
//
// Loads each supabase/functions/<name>/index.ts exactly as the runtime would
// at start-up — resolving every import and named export — but with the HTTP
// server stubbed out, so nothing listens and no request is handled. Catches the
// failures that stop a function from starting at all: a missing export from a
// _shared file, a duplicate declaration, a bad import path, a syntax error.
// Type errors are deliberately NOT checked here (the runtime doesn't either).
//
// Usage: deno run -A --no-config --node-modules-dir=none scripts/edge-boot-check.ts [name ...]
const root = new URL("../supabase/functions/", import.meta.url);

// Dummy env so top-level `Deno.env.get(...)!` reads don't crash.
for (const k of [
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY", "LOVABLE_API_KEY", "STRIPE_SECRET_KEY",
  "RESEND_API_KEY", "CRON_SECRET",
]) if (!Deno.env.get(k)) Deno.env.set(k, k === "SUPABASE_URL" ? "http://127.0.0.1:1" : "boot-check");

// Stub every way a function can start a server.
const fakeServer = {
  finished: new Promise(() => {}), addr: { hostname: "0", port: 0, transport: "tcp" },
  shutdown: async () => {}, ref() {}, unref() {},
};
// deno-lint-ignore no-explicit-any
const D = Deno as any;
D.serve = () => fakeServer;
D.listen = () => ({
  addr: fakeServer.addr, close() {}, ref() {}, unref() {},
  accept: () => new Promise(() => {}),
  [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }),
});

// Child mode: boot exactly one function in this isolated process.
if (Deno.args[0] === "--one") {
  try {
    await import(new URL(`${Deno.args[1]}/index.ts`, root).href);
    Deno.exit(0);
  } catch (e) {
    console.error((e instanceof Error ? `${e.name}: ${e.message}` : String(e)).split("\n")[0]);
    Deno.exit(1);
  }
}

// Parent mode: each function gets its own process, because the runtime boots
// each function in isolation — sharing one module graph would let one function's
// npm versions leak into another's resolution and hide or invent failures.
const requested = Deno.args;
const names: string[] = [];
for await (const e of Deno.readDir(root)) {
  if (!e.isDirectory || e.name.startsWith("_")) continue;
  if (requested.length && !requested.includes(e.name)) continue;
  try { await Deno.stat(new URL(`${e.name}/index.ts`, root)); names.push(e.name); } catch { /* no entrypoint */ }
}
names.sort();

const self = new URL(import.meta.url).pathname;
const failures: { name: string; error: string }[] = [];
async function bootOne(name: string) {
  const out = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--no-config", "--node-modules-dir=none", self, "--one", name],
    stdout: "piped", stderr: "piped",
  }).output();
  if (out.code === 0) { console.log(`ok    ${name}`); return; }
  const err = new TextDecoder().decode(out.stderr).replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n")[0] || `exit ${out.code}`;
  failures.push({ name, error: err });
  console.log(`FAIL  ${name} — ${err}`);
}
const queue = [...names];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) await bootOne(queue.shift()!);
}));

console.log(`\n${names.length - failures.length}/${names.length} functions boot.`);
if (failures.length) {
  console.error(`\n${failures.length} function(s) would fail to start:`);
  for (const f of failures.sort((a, b) => a.name.localeCompare(b.name))) console.error(`  - ${f.name}: ${f.error}`);
  Deno.exit(1);
}
Deno.exit(0);
