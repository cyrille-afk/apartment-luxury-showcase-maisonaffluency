// Automated regression suite for the PUBLIC /concierge endpoint.
//
// Runs common designer-name queries against `concierge-public-stream` and
// verifies:
//   1. The endpoint responds successfully (200 SSE stream) or is rate-limited
//      (429). Neither is a failure — both prove it's alive.
//   2. When a stream is returned, it does NOT leak catalog SKUs or prices
//      (public concierge is explicitly ungrounded — see function header).
//
// Companion suite: `supabase/functions/trade-concierge/index.test.ts` runs
// the same queries against the signed-in trade surface and verifies that the
// matching catalog items DO appear.
//
// Env vars (loaded from `.env`):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readConciergeStream, streamContainsAny } from "../_shared/testHelpers.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/concierge-public-stream`;

// Designer-name queries a typical visitor would ask on /concierge.
const QUERIES = [
  "What Alexander Lamont items do you have?",
  "Do you carry Apparatus Studio?",
  "Show me pieces by Pierre Augustin Rose.",
];

// Signals the public surface must NEVER leak (no pricing / no SKU codes).
// Word-boundary matches so vocabulary like "European" doesn't false-trigger "EUR".
const FORBIDDEN_LEAK_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "€ + number", re: /€\s?\d/ },
  { name: "$ + number", re: /\$\s?\d/ },
  { name: "£ + number", re: /£\s?\d/ },
  { name: "USD/EUR/GBP price", re: /\b(USD|EUR|GBP)\b\s?\d/ },
  { name: "trade price", re: /\btrade\s+price\b/i },
  { name: "SKU", re: /\bSKU[:\s#-]/i },
];

async function runQuery(prompt: string) {
  const sid = crypto.randomUUID();
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
      "apikey": ANON_KEY,
      "x-concierge-surface": "public",
      "x-concierge-sid": sid,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      surface: "public",
      project_id: null,
      lang: "en",
    }),
  });
  return resp;
}

for (const prompt of QUERIES) {
  Deno.test({
    name: `concierge-public-stream: "${prompt}" responds and does not leak catalog`,
    async fn() {
      const resp = await runQuery(prompt);

      // 429 = alive but rate-limited (per-IP shared with prior test runs). Skip.
      if (resp.status === 429) {
        try { await resp.body?.cancel(); } catch { /* ignore */ }
        return;
      }

      if (resp.status !== 200) {
        const body = await resp.text().catch(() => "");
        throw new Error(`expected 200, got ${resp.status}: ${body}`);
      }

      const { text } = await readConciergeStream(resp, { timeoutMs: 40_000 });
      assert(text.length > 0, `empty stream for prompt: ${prompt}`);

      const leak = FORBIDDEN_LEAK_PATTERNS.find((p) => p.re.test(text));
      assert(
        !leak,
        `public concierge leaked "${leak?.name}" for prompt "${prompt}":\n${text.slice(0, 500)}`,
      );
    },
  });
}
