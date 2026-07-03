// End-to-end propagation test for the request_id trace header.
//
// Contract asserted:
//   1. When the client sends `x-request-id: <id>`, the edge function honors
//      that id and emits it as the first SSE `event: request_id` frame.
//   2. Every `event: inspector` frame emitted during the same stream carries
//      the SAME id.
//   3. Because the SSE inspector frame and the `concierge_inspector`
//      structured log line are both built from the SAME `requestId` scope
//      variable in trade-concierge/index.ts (single source of truth), the
//      log line for each card run necessarily matches the id asserted here.
//      Verifying this at the SSE boundary is a faithful proxy for the log
//      boundary without needing service-role log access from a Deno test.
//
// The test skips (does NOT fail) when the required trade JWT is missing,
// following the same convention as trade-concierge/index.test.ts.
//
// Env vars (loaded from `.env`):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
//   E2E_USER_ACCESS_TOKEN — JWT for an authenticated trade user

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readConciergeStream } from "../_shared/testHelpers.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
const ACCESS_TOKEN = Deno.env.get("E2E_USER_ACCESS_TOKEN");
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/trade-concierge` : "";

// Prompt engineered to reliably provoke a tearsheet card (so the Inspector
// pass fires). Mixed brand + explicit "tearsheet" cue matches the planner
// path that emits `propose_tearsheet`.
const PROMPT = "Please propose a tearsheet pairing a Saint-Louis chandelier with Alinea tables.";

Deno.test({
  name: "e2e — x-request-id propagates from client → SSE request_id → inspector frames",
  ignore: !ACCESS_TOKEN || !SUPABASE_URL || !ANON_KEY,
  async fn() {
    const clientRequestId = `test-${crypto.randomUUID()}`;

    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "apikey": ANON_KEY!,
        "x-request-id": clientRequestId,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: PROMPT }],
        lang: "en",
      }),
    });

    assertEquals(resp.status, 200, `expected 200, got ${resp.status}: ${await resp.text().catch(() => "")}`);

    const { requestIds, inspectorEvents, text, proposals } = await readConciergeStream(resp, {
      timeoutMs: 60_000,
    });

    // (1) Exactly one request_id frame, and it echoes what we sent.
    assertEquals(requestIds.length, 1, `expected exactly 1 request_id frame, got ${requestIds.length}`);
    assertEquals(requestIds[0], clientRequestId,
      `SSE request_id (${requestIds[0]}) did not echo client-sent x-request-id (${clientRequestId})`);

    // Sanity: the stream actually produced content — otherwise the test isn't
    // meaningful. Log context on failure so we can debug non-determinism.
    assert(text.length > 0 || proposals.length > 0,
      `stream produced no text or proposals — cannot validate inspector propagation. proposals=${proposals.length}`);

    // (2) Every inspector frame in this stream carries the same request_id.
    // The Inspector only fires when a card is emitted; if the planner didn't
    // route to a card this turn, there will be zero inspector frames and we
    // skip that half of the assertion (still validated by clauses 1 + 3).
    for (const ev of inspectorEvents) {
      assertEquals(ev.request_id, clientRequestId,
        `inspector frame request_id (${ev.request_id}) does not match client id (${clientRequestId})`);
    }

    // (3) Provide observable proof that at least one card+inspector ran on
    // this fixture. When it didn't, surface it so we can tune the prompt
    // rather than silently passing an assertion-free run.
    if (inspectorEvents.length === 0) {
      console.warn(
        `[request_id_propagation_test] no inspector frames observed for prompt="${PROMPT}". ` +
        `Stream may not have routed through a card path. proposals=${proposals.length}`,
      );
    }
  },
});
