// End-to-end tests for pure DISCOVERY turns on `trade-concierge`.
//
// A "discovery turn" is one where the concierge answers with prose only
// (no card proposals). These turns are the highest-risk surface for
// hallucinated designer/brand namedrops (Poliform, Lasvit, Kelly Wearstler,
// etc.), because there are no product cards to anchor the reply.
//
// This suite verifies the full guardrail pipeline is wired end-to-end:
//   1. `event: discovery_guard` fires on the SSE stream (Stage 1: fast strip)
//   2. `event: inspector` fires with `discovery: true` (Stage 2: audit)
//   3. Final assembled client text contains ZERO known off-catalog names.
//
// If either guardrail fails at runtime, a `hard_fallback` event must have
// fired and the raw prose must not have leaked.
//
// Env vars (loaded from `.env`):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
//   E2E_USER_ACCESS_TOKEN — JWT for an authenticated trade user. Skipped
//                            (not failed) when missing.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readConciergeStream } from "../_shared/testHelpers.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const ACCESS_TOKEN = Deno.env.get("E2E_USER_ACCESS_TOKEN");
const ENDPOINT = `${SUPABASE_URL}/functions/v1/trade-concierge`;

// Known off-catalog designers / brands that the model has previously
// hallucinated on discovery turns. These MUST never appear in final client
// output for a Maison Affluency concierge reply.
const FORBIDDEN_NAMES = [
  "Poliform",
  "Lasvit",
  "Moooi",
  "Kelly Wearstler",
  "Vincent Van Duysen",
  "Piero Lissoni",
  "Patricia Urquiola",
  "Jean-Michel Frank",
  "Minotti",
  "B&B Italia",
  "Cassina",
  "Flos",
  "Artemide",
  "Roche Bobois",
];

// Open-ended prompts likely to trigger a pure discovery reply (no card
// proposal). Kept intentionally vague so the concierge must reason from
// the allowlist rather than resolve to a specific piece.
const DISCOVERY_PROMPTS = [
  "I'm styling a Parisian pied-à-terre. Any thoughts on statement lighting?",
  "What kind of designers do you work with for atmospheric living rooms?",
  "Give me some general guidance on choosing a chandelier for a high-ceiling foyer.",
];

async function runQuery(prompt: string) {
  return await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      surface: "trade",
      project_id: null,
      lang: "en",
    }),
  });
}

for (const prompt of DISCOVERY_PROMPTS) {
  Deno.test({
    name: `trade-concierge discovery: "${prompt.slice(0, 60)}…" runs guard+inspector and leaks no off-catalog names`,
    ignore: !ACCESS_TOKEN,
    async fn() {
      const resp = await runQuery(prompt);
      if (resp.status !== 200) {
        const body = await resp.text().catch(() => "");
        throw new Error(`expected 200, got ${resp.status}: ${body}`);
      }

      const stream = await readConciergeStream(resp, { timeoutMs: 90_000 });
      assert(stream.text.length > 0, `empty stream for prompt: ${prompt}`);

      // Only assert on pure discovery turns — if the model happened to
      // emit a card proposal, this prompt didn't exercise the discovery
      // path and we skip the guard/inspector assertions.
      if (stream.proposals.length > 0) {
        console.log(`[skip discovery assertions] proposals emitted for: ${prompt}`);
        return;
      }

      // Guardrail wiring: at least one of the two must have run. If both
      // failed the pipeline MUST have fired hard_fallback rather than
      // leaking raw prose.
      const guardRan = stream.discoveryGuardEvents.length > 0;
      const discoveryInspectorRan = stream.inspectorEvents.some((e) => e.discovery === true);
      const hardFallbackFired = stream.hardFallbackEvents.length > 0;

      assert(
        guardRan || hardFallbackFired,
        `discovery_guard event was never emitted (and no hard_fallback) for: ${prompt}\n` +
          `events: inspector=${stream.inspectorEvents.length} guard=${stream.discoveryGuardEvents.length} hard_fallback=${stream.hardFallbackEvents.length}`,
      );
      assert(
        discoveryInspectorRan || hardFallbackFired,
        `inspector event with discovery:true was never emitted (and no hard_fallback) for: ${prompt}\n` +
          `inspector events: ${JSON.stringify(stream.inspectorEvents)}`,
      );

      // Final client text must never contain forbidden off-catalog names.
      const hay = stream.text.toLowerCase();
      const leaked = FORBIDDEN_NAMES.filter((n) => hay.includes(n.toLowerCase()));
      assert(
        leaked.length === 0,
        `discovery reply leaked off-catalog names ${JSON.stringify(leaked)} for: ${prompt}\n` +
          `--- reply ---\n${stream.text}\n--- end ---`,
      );
    },
  });
}
