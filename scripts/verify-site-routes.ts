#!/usr/bin/env bun
/**
 * Site routing smoke check: key pages must load (200 HTML), legacy URLs must
 * 301 to their current page, and unknown URLs must return the 404 page.
 * Usage: bun scripts/verify-site-routes.ts [BASE]   (default https://www.maisonaffluency.com)
 */
const BASE = (process.argv[2] || process.env.SITE_BASE || "https://www.maisonaffluency.com").replace(/\/$/, "");

const PAGES = [
  "/", "/designers", "/contact", "/journal", "/gallery", "/new-in", "/apartment-tour",
  "/trade-program", "/privacy", "/terms", "/designers/emma-donnersberg", "/trade/login",
];
const REDIRECTS: Record<string, string> = {
  "/products": "/designers", "/shop/x": "/designers", "/catalogue": "/designers",
  "/collection/a": "/designers", "/home": "/", "/index.html": "/",
};
const UNKNOWN = ["/this-page-does-not-exist-ma", "/designers-nope/zzz"];

const failures: string[] = [];
const get = (p: string) =>
  fetch(BASE + p, { redirect: "manual", headers: { "user-agent": "MA-route-check/1.0" }, signal: AbortSignal.timeout(30000) });

for (const p of PAGES) {
  try {
    const r = await get(p);
    const body = await r.text();
    if (r.status !== 200) failures.push(`${p}: expected 200, got ${r.status}`);
    else if (!/<html/i.test(body) || !/<title>[^<]+<\/title>/i.test(body)) failures.push(`${p}: 200 but no HTML title`);
    else console.log(`✓ ${p} 200`);
  } catch (e) { failures.push(`${p}: ${(e as Error).message}`); }
}
for (const [p, to] of Object.entries(REDIRECTS)) {
  try {
    const r = await get(p);
    const loc = r.headers.get("location") ?? "";
    const path = loc ? new URL(loc, BASE).pathname : "";
    if (r.status !== 301 || path !== to) failures.push(`${p}: expected 301 → ${to}, got ${r.status} → ${loc || "none"}`);
    else console.log(`✓ ${p} 301 → ${to}`);
  } catch (e) { failures.push(`${p}: ${(e as Error).message}`); }
}
for (const p of UNKNOWN) {
  try {
    const r = await get(p);
    await r.text();
    if (r.status !== 404) failures.push(`${p}: expected 404, got ${r.status}`);
    else console.log(`✓ ${p} 404`);
  } catch (e) { failures.push(`${p}: ${(e as Error).message}`); }
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} route check(s) failed on ${BASE}:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log(`\nAll route checks passed on ${BASE}.`);
