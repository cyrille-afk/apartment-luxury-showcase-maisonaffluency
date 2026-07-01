#!/usr/bin/env node
/**
 * Mint a trade user access token for concierge end-to-end tests.
 *
 * Signs in with password against the project's Supabase Auth using the
 * anon key from `.env`, then prints the access token.
 *
 * Credentials come from env vars — never hardcode a real user's password:
 *   E2E_USER_EMAIL       — trade user email
 *   E2E_USER_PASSWORD    — trade user password
 *
 * Usage:
 *   # Print the token
 *   node scripts/mint-e2e-token.mjs
 *
 *   # Export into current shell (bash/zsh) before running tests
 *   export E2E_USER_ACCESS_TOKEN="$(node scripts/mint-e2e-token.mjs)"
 *   deno test --allow-net --allow-env --allow-read \
 *     supabase/functions/trade-concierge/index.test.ts
 *
 *   # One-liner: mint + run
 *   E2E_USER_ACCESS_TOKEN="$(node scripts/mint-e2e-token.mjs)" \
 *     deno test --allow-net --allow-env --allow-read \
 *     supabase/functions/trade-concierge/index.test.ts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, "../.env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // .env is optional if vars already exported
  }
}

function die(msg) {
  console.error(`[mint-e2e-token] ${msg}`);
  process.exit(1);
}

loadDotEnv();

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY) die("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.");
if (!EMAIL || !PASSWORD) {
  die(
    "Set E2E_USER_EMAIL and E2E_USER_PASSWORD in your shell (do not commit them).\n" +
      "  export E2E_USER_EMAIL='trade-user@example.com'\n" +
      "  export E2E_USER_PASSWORD='...'",
  );
}

const res = await fetch(
  `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  },
);

const body = await res.json().catch(() => ({}));
if (!res.ok || !body.access_token) {
  die(
    `Sign-in failed (HTTP ${res.status}): ${body.error_description || body.msg || body.error || "no access_token in response"}`,
  );
}

// stdout ONLY the token so `$(...)` capture works cleanly.
process.stdout.write(body.access_token);
