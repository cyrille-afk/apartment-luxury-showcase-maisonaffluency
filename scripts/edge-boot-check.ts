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

const requested = Deno.args;
const names: string[] = [];
for await (const e of Deno.readDir(root)) {
  if (!e.isDirectory || e.name.startsWith("_")) continue;
  if (requested.length && !requested.includes(e.name)) continue;
  try { await Deno.stat(new URL(`${e.name}/index.ts`, root)); names.push(e.name); } catch { /* no entrypoint */ }
}
names.sort();

const failures: { name: string; error: string }[] = [];
for (const name of names) {
  try {
    await import(new URL(`${name}/index.ts`, root).href);
    console.log(`ok    ${name}`);
  } catch (e) {
    const msg = (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).split("\n")[0];
    failures.push({ name, error: msg });
    console.log(`FAIL  ${name} — ${msg}`);
  }
}

console.log(`\n${names.length - failures.length}/${names.length} functions boot.`);
if (failures.length) {
  console.error(`\n${failures.length} function(s) would fail to start:`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.error}`);
  Deno.exit(1);
}
Deno.exit(0); // unref'd timers / pending top-level promises must not hang CI
