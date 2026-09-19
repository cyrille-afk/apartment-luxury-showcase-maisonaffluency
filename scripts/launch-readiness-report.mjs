#!/usr/bin/env node
/**
 * Calls the admin-only `deployment-readiness` edge function and prints a
 * per-credential pass/fail report. Exits 1 when anything is missing or still
 * pointing at a test/sandbox credential.
 *
 * Env:
 *   LAUNCH_ADMIN_EMAIL / LAUNCH_ADMIN_PASSWORD   an admin account
 *   (Supabase URL + anon key are read from .env)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(resolve(__dirname, "../.env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* .env optional */ }

const URL_ = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.LAUNCH_ADMIN_EMAIL;
const PASSWORD = process.env.LAUNCH_ADMIN_PASSWORD;

if (!URL_ || !ANON || !EMAIL || !PASSWORD) {
  console.error("  – skipped: LAUNCH_ADMIN_EMAIL / LAUNCH_ADMIN_PASSWORD not set.");
  process.exit(0);
}

const supabase = createClient(URL_, ANON, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (authErr || !auth.session) {
  console.error(`  ✘ admin sign-in failed: ${authErr?.message ?? "no session"}`);
  process.exit(1);
}

const res = await fetch(`${URL_}/functions/v1/deployment-readiness`, {
  method: "POST",
  headers: { Authorization: `Bearer ${auth.session.access_token}`, apikey: ANON },
});
const report = await res.json();
if (!res.ok) {
  console.error(`  ✘ readiness endpoint returned ${res.status}: ${JSON.stringify(report)}`);
  process.exit(1);
}

for (const c of report.checks) {
  const mark = c.present && c.live ? "✔" : "✘";
  console.log(`  ${mark} ${c.key.padEnd(24)} ${c.fingerprint ?? "—"}  ${c.note}`);
}
console.log(`  Stripe mode: ${report.stripe_mode} (source: ${report.stripe_credential_source})`);
if (report.ok) {
  console.log("  ✔ all live credentials populated");
  process.exit(0);
}
console.log(`  ✘ missing: [${report.missing.join(", ")}]  not live: [${report.not_live.join(", ")}]`);
process.exit(1);
