// Regression tests for the Inspector Agent.
//
// These tests stub `globalThis.fetch` so they run offline and deterministically.
// They pin the two failure modes we've actually shipped bugs for:
//
//   1. Mixed-brand misattribution — prose says "all Saint-Louis" when the
//      tearsheet is a Saint-Louis + Alinea mix. Inspector MUST rewrite.
//   2. Zero-match typology — prose mentions "Alinea chairs" when the
//      ground truth has zero Alinea chairs. Inspector MUST remove/correct.
//
// Plus contract tests for the fail-open behaviour (timeout, HTTP error,
// malformed JSON, empty inputs).

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildInspectorGroundTruth,
  buildInspectorLogRecord,
  logInspectorRun,
  runInspectorPass,
  type InspectorGroundTruth,
} from "./concierge-inspector.ts";

// ---------- helpers ----------------------------------------------------

const realFetch = globalThis.fetch;

type FakeInspectorReply = {
  corrected_prose: string;
  corrections: Array<{ original: string; replacement: string; reason: string }>;
};

function stubFetchWithReply(reply: FakeInspectorReply | "http_500" | "malformed" | "timeout") {
  const calls: Array<{ body: any }> = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ body });
    if (reply === "timeout") {
      // Never resolve — the caller's AbortSignal will abort after 2.5s.
      // Speed the test up by aborting locally instead of waiting.
      return await new Promise<Response>((_, reject) => {
        const sig = (init as any)?.signal as AbortSignal | undefined;
        if (sig) sig.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }
    if (reply === "http_500") {
      return new Response("boom", { status: 500 });
    }
    if (reply === "malformed") {
      return new Response(JSON.stringify({
        choices: [{ message: { content: "not json at all { { {" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(reply) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { calls };
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

// A realistic ground truth: 4 Saint-Louis lighting + 8 Alinea tables. This is
// the exact regression scenario the user hit ("13 products all Saint-Louis").
function mixedBrandGT(): InspectorGroundTruth {
  return buildInspectorGroundTruth([{
    tool: "propose_tearsheet",
    pickIds: Array.from({ length: 12 }, (_, i) => `id-${i}`),
    previews: [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `id-sl-${i}`, title: `Chandelier ${i}`, designer_name: "Saint-Louis",
        category: "Lighting", materials: "Crystal",
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `id-al-${i}`, title: `Table ${i}`, designer_name: "Alinea Design Objects",
        category: "Furniture", materials: "Oak",
      })),
    ],
  }]);
}

// A ground truth with only Alinea tables (no chairs) — the zero-match case.
function alineaTablesOnlyGT(): InspectorGroundTruth {
  return buildInspectorGroundTruth([{
    tool: "propose_tearsheet",
    pickIds: ["t1", "t2", "t3"],
    previews: [
      { id: "t1", title: "Astra Dining Table", designer_name: "Alinea Design Objects", category: "Table", materials: "Marble" },
      { id: "t2", title: "Piero Console",      designer_name: "Alinea Design Objects", category: "Table", materials: "Walnut" },
      { id: "t3", title: "Orbis Side Table",   designer_name: "Alinea Design Objects", category: "Table", materials: "Bronze" },
    ],
  }]);
}

// ---------- pure-function tests ---------------------------------------

Deno.test("buildInspectorGroundTruth aggregates per-brand counts + totals", () => {
  const gt = mixedBrandGT();
  assertEquals(gt.cards.length, 1);
  assertEquals(gt.cards[0].total, 12);
  assertEquals(gt.cards[0].brand_counts["Saint-Louis"], 4);
  assertEquals(gt.cards[0].brand_counts["Alinea Design Objects"], 8);
});

Deno.test("buildInspectorGroundTruth treats missing designer as 'Unknown'", () => {
  const gt = buildInspectorGroundTruth([{
    tool: "propose_tearsheet",
    pickIds: ["a"],
    previews: [{ id: "a", title: "Something", designer_name: null, category: null, materials: null }],
  }]);
  assertEquals(gt.cards[0].brand_counts["Unknown"], 1);
});

// ---------- Inspector contract tests ----------------------------------

Deno.test("Inspector — mixed-brand: rewrites 'all Saint-Louis' to real split", async () => {
  const stub = stubFetchWithReply({
    corrected_prose:
      "Here's a first edit — 12 pieces (4 Saint-Louis, 8 Alinea Design Objects) drawn from the Maison Affluency Curation.",
    corrections: [{
      original: "13 pieces, all Saint-Louis",
      replacement: "12 pieces (4 Saint-Louis, 8 Alinea Design Objects)",
      reason: "Ground truth shows a mixed set of 4 Saint-Louis + 8 Alinea; original claim contradicted totals and brand attribution.",
    }],
  });
  try {
    const result = await runInspectorPass({
      prose: "Here's a first edit — 13 pieces, all Saint-Louis, drawn from our curated selection.",
      groundTruth: mixedBrandGT(),
      apiKey: "test-key",
    });
    assert(result.ok, `expected ok, got reason=${result.reason}`);
    assertEquals(result.corrections.length, 1);
    // The corrected prose must NOT still claim "all Saint-Louis".
    assert(!/all Saint-?Louis/i.test(result.corrected_prose),
      `corrected prose still claims 'all Saint-Louis': ${result.corrected_prose}`);
    // And must mention Alinea (the real second brand).
    assertStringIncludes(result.corrected_prose, "Alinea");
    // Contract: the request body must include both keys the system prompt binds to.
    const sent = stub.calls[0]?.body;
    const userMsg = sent?.messages?.find((m: any) => m.role === "user");
    const payload = JSON.parse(userMsg.content);
    assert("ASSISTANT_PROSE" in payload, "user payload must include ASSISTANT_PROSE");
    assert("GROUND_TRUTH" in payload, "user payload must include GROUND_TRUTH");
    assertEquals(payload.GROUND_TRUTH.cards[0].brand_counts["Saint-Louis"], 4);
  } finally { restoreFetch(); }
});

Deno.test("Inspector — zero-match typology: removes 'Alinea chairs' when ground truth has none", async () => {
  const stub = stubFetchWithReply({
    corrected_prose:
      "Here's a first edit of three Alinea tables — the Astra Dining Table, Piero Console, and Orbis Side Table.",
    corrections: [{
      original: "Alinea chairs and tables",
      replacement: "Alinea tables",
      reason: "Ground truth contains zero Alinea chairs; only tables are present.",
    }],
  });
  try {
    const result = await runInspectorPass({
      prose: "Here's a first edit — a selection of Alinea chairs and tables from our curated selection.",
      groundTruth: alineaTablesOnlyGT(),
      apiKey: "test-key",
    });
    assert(result.ok);
    assertEquals(result.corrections.length, 1);
    // Corrected prose must not falsely claim chairs.
    assert(!/\bchairs?\b/i.test(result.corrected_prose),
      `corrected prose still claims chairs: ${result.corrected_prose}`);
    // Confirm we're not silently dropping the brand.
    assertStringIncludes(result.corrected_prose, "Alinea");
    void stub;
  } finally { restoreFetch(); }
});

// ---------- fail-open contract ----------------------------------------

Deno.test("Inspector — HTTP 500 returns original prose unchanged (fail-open)", async () => {
  stubFetchWithReply("http_500");
  try {
    const original = "Here's a first edit — 13 pieces, all Saint-Louis.";
    const result = await runInspectorPass({
      prose: original,
      groundTruth: mixedBrandGT(),
      apiKey: "test-key",
    });
    assertEquals(result.ok, false);
    assertEquals(result.corrected_prose, original);
    assertEquals(result.corrections.length, 0);
    assertEquals(result.reason, "http_500");
  } finally { restoreFetch(); }
});

Deno.test("Inspector — malformed JSON response falls back to original prose", async () => {
  stubFetchWithReply("malformed");
  try {
    const original = "Here's a first edit.";
    const result = await runInspectorPass({
      prose: original,
      groundTruth: mixedBrandGT(),
      apiKey: "test-key",
    });
    assertEquals(result.ok, false);
    assertEquals(result.corrected_prose, original);
    assertEquals(result.reason, "parse_failed");
  } finally { restoreFetch(); }
});

Deno.test("Inspector — abort/timeout returns original prose", async () => {
  stubFetchWithReply("timeout");
  try {
    const original = "Buffered prose.";
    const t0 = Date.now();
    const result = await runInspectorPass({
      prose: original,
      groundTruth: mixedBrandGT(),
      apiKey: "test-key",
    });
    const elapsed = Date.now() - t0;
    // Must abort within ~3s (2500ms timeout + slack), NOT hang forever.
    assert(elapsed < 4000, `inspector hung too long: ${elapsed}ms`);
    assertEquals(result.ok, false);
    assertEquals(result.corrected_prose, original);
    assertEquals(result.reason, "timeout");
  } finally { restoreFetch(); }
});

Deno.test("Inspector — skips call entirely when prose is empty", async () => {
  const stub = stubFetchWithReply({ corrected_prose: "should-not-be-called", corrections: [] });
  try {
    const result = await runInspectorPass({
      prose: "   ",
      groundTruth: mixedBrandGT(),
      apiKey: "test-key",
    });
    assertEquals(result.ok, true);
    assertEquals(result.corrected_prose, "");
    assertEquals(result.reason, "skipped_empty");
    assertEquals(stub.calls.length, 0, "must not hit the network for empty prose");
  } finally { restoreFetch(); }
});

Deno.test("Inspector — skips call entirely when ground truth has zero items", async () => {
  const stub = stubFetchWithReply({ corrected_prose: "should-not-be-called", corrections: [] });
  try {
    const emptyGT = buildInspectorGroundTruth([{ tool: "propose_tearsheet", pickIds: [], previews: [] }]);
    const result = await runInspectorPass({
      prose: "Some prose that mentions Alinea chairs.",
      groundTruth: emptyGT,
      apiKey: "test-key",
    });
    assertEquals(result.ok, true);
    assertEquals(result.reason, "skipped_empty");
    assertEquals(stub.calls.length, 0);
  } finally { restoreFetch(); }
});

Deno.test("Inspector — clamps oversize corrections + preserves shape", async () => {
  // Model returns 20 malformed + oversize corrections; helper must clamp to 8
  // and coerce fields into the {original, replacement, reason} shape.
  const bloated = Array.from({ length: 20 }, (_, i) => ({
    original: "x".repeat(2000) + i,
    replacement: "y".repeat(2000) + i,
    reason: "z".repeat(600),
  }));
  stubFetchWithReply({
    corrected_prose: "ok",
    corrections: bloated as any,
  });
  try {
    const result = await runInspectorPass({
      prose: "some prose",
      groundTruth: mixedBrandGT(),
      apiKey: "test-key",
    });
    assert(result.ok);
    assertEquals(result.corrections.length, 8);
    for (const c of result.corrections) {
      assert(c.original.length <= 500);
      assert(c.replacement.length <= 500);
      assert(c.reason.length <= 240);
    }
  } finally { restoreFetch(); }
});

// ---------- structured log tests --------------------------------------
//
// Contract: for every Inspector run tied to a card (or set of cards), the
// edge function emits EXACTLY ONE JSON log line tagged `concierge_inspector`
// carrying the request_id, card types/totals, aggregated brand counts, and
// both the original and (possibly rewritten) prose. These tests capture
// console.log to assert that contract without touching the network.

type CapturedLog = { text: string; parsed: any };

function captureConsoleLog(): { logs: CapturedLog[]; restore: () => void } {
  const logs: CapturedLog[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    logs.push({ text, parsed });
  };
  return { logs, restore: () => { console.log = original; } };
}

Deno.test("structured log — exactly one concierge_inspector JSON line per run", async () => {
  const stub = stubFetchWithReply({
    corrected_prose: "Here's a first edit — 12 pieces (4 Saint-Louis, 8 Alinea Design Objects).",
    corrections: [{
      original: "13 pieces, all Saint-Louis",
      replacement: "12 pieces (4 Saint-Louis, 8 Alinea Design Objects)",
      reason: "Mixed set; totals and brand attribution were wrong.",
    }],
  });
  const cap = captureConsoleLog();
  try {
    const gt = mixedBrandGT();
    const original = "Here's a first edit — 13 pieces, all Saint-Louis.";
    const result = await runInspectorPass({ prose: original, groundTruth: gt, apiKey: "k" });
    logInspectorRun(buildInspectorLogRecord({
      requestId: "req-abc-123",
      originalProse: original,
      result,
      groundTruth: gt,
    }));

    const tagged = cap.logs.filter((l) => l.parsed?.tag === "concierge_inspector");
    assertEquals(tagged.length, 1, `expected exactly 1 concierge_inspector log, got ${tagged.length}`);
    const rec = tagged[0].parsed;

    // Required fields
    assertEquals(rec.tag, "concierge_inspector");
    assertEquals(rec.request_id, "req-abc-123");
    assertEquals(rec.ok, true);
    assertEquals(rec.card_types, ["propose_tearsheet"]);
    assertEquals(rec.card_totals, [12]);
    assertEquals(rec.brand_counts["Saint-Louis"], 4);
    assertEquals(rec.brand_counts["Alinea Design Objects"], 8);
    assertEquals(rec.prose_len, original.length);
    assertEquals(rec.corrections_count, 1);
    assertEquals(rec.changed, true);
    assertEquals(rec.original_prose, original);
    assertStringIncludes(rec.corrected_prose, "Alinea");
    assert(!/all Saint-?Louis/i.test(rec.corrected_prose));
    assert(typeof rec.ts === "string" && rec.ts.length > 0);
    assert(rec.ground_truth?.cards?.length === 1);
    void stub;
  } finally { cap.restore(); restoreFetch(); }
});

Deno.test("structured log — one line per card-type when multiple cards run", async () => {
  const cap = captureConsoleLog();
  try {
    // Simulate two sequential card runs in the same request: a tearsheet AND
    // a draft_quote. The edge handler calls logInspectorRun once per card.
    const tearsheetGT = mixedBrandGT();
    const quoteGT = alineaTablesOnlyGT();

    stubFetchWithReply({
      corrected_prose: "Tearsheet prose corrected.",
      corrections: [{ original: "x", replacement: "y", reason: "r" }],
    });
    const r1 = await runInspectorPass({ prose: "Tearsheet prose original.", groundTruth: tearsheetGT, apiKey: "k" });
    logInspectorRun(buildInspectorLogRecord({
      requestId: "req-multi", originalProse: "Tearsheet prose original.", result: r1, groundTruth: tearsheetGT,
    }));
    restoreFetch();

    stubFetchWithReply({ corrected_prose: "Quote prose unchanged.", corrections: [] });
    const r2 = await runInspectorPass({ prose: "Quote prose unchanged.", groundTruth: quoteGT, apiKey: "k" });
    logInspectorRun(buildInspectorLogRecord({
      requestId: "req-multi", originalProse: "Quote prose unchanged.", result: r2,
      groundTruth: { cards: [{ ...quoteGT.cards[0], tool: "draft_quote" }] },
    }));

    const tagged = cap.logs.filter((l) => l.parsed?.tag === "concierge_inspector");
    assertEquals(tagged.length, 2, `expected 2 log lines (one per card), got ${tagged.length}`);
    // All share the same request_id.
    assertEquals(tagged[0].parsed.request_id, "req-multi");
    assertEquals(tagged[1].parsed.request_id, "req-multi");
    // Card types are distinct and preserved from ground truth.
    assertEquals(tagged[0].parsed.card_types, ["propose_tearsheet"]);
    assertEquals(tagged[1].parsed.card_types, ["draft_quote"]);
    // First run changed prose; second didn't.
    assertEquals(tagged[0].parsed.changed, true);
    assertEquals(tagged[1].parsed.changed, false);
    assertEquals(tagged[1].parsed.corrections_count, 0);
  } finally { cap.restore(); restoreFetch(); }
});

Deno.test("structured log — fail-open run still emits one line with reason + changed=false", async () => {
  stubFetchWithReply("http_500");
  const cap = captureConsoleLog();
  try {
    const gt = mixedBrandGT();
    const original = "Prose that would have been rewritten.";
    const result = await runInspectorPass({ prose: original, groundTruth: gt, apiKey: "k" });
    logInspectorRun(buildInspectorLogRecord({
      requestId: "req-fail", originalProse: original, result, groundTruth: gt,
    }));

    const tagged = cap.logs.filter((l) => l.parsed?.tag === "concierge_inspector");
    assertEquals(tagged.length, 1);
    const rec = tagged[0].parsed;
    assertEquals(rec.ok, false);
    assertEquals(rec.reason, "http_500");
    assertEquals(rec.changed, false);
    assertEquals(rec.corrections_count, 0);
    assertEquals(rec.original_prose, original);
    assertEquals(rec.corrected_prose, original);
  } finally { cap.restore(); restoreFetch(); }
});

Deno.test("structured log — original_prose and corrected_prose are truncated at 4000 chars", () => {
  const cap = captureConsoleLog();
  try {
    const huge = "a".repeat(5000);
    logInspectorRun(buildInspectorLogRecord({
      requestId: "req-clip",
      originalProse: huge,
      result: { ok: true, corrected_prose: "b".repeat(5000), corrections: [], ms: 1 },
      groundTruth: mixedBrandGT(),
    }));
    const rec = cap.logs.find((l) => l.parsed?.tag === "concierge_inspector")!.parsed;
    // Clip helper adds an ellipsis when it truncates, so length is 4001.
    assert(rec.original_prose.length <= 4001, `original_prose too long: ${rec.original_prose.length}`);
    assert(rec.corrected_prose.length <= 4001, `corrected_prose too long: ${rec.corrected_prose.length}`);
    assert(rec.original_prose.endsWith("…"));
    assert(rec.corrected_prose.endsWith("…"));
    // prose_len must reflect the ORIGINAL untruncated length.
    assertEquals(rec.prose_len, 5000);
  } finally { cap.restore(); }
});

// ---------------------------------------------------------------------------
// Discovery-turn Inspector regression tests
// ---------------------------------------------------------------------------
//
// Locks in the guarantee that:
//   1. runInspectorPass DOES run on pure-discovery turns (empty GT) as long
//      as a CURATION allowlist is provided — it must NOT short-circuit.
//   2. The request payload carries CURATION_ALLOWLIST and the system prompt
//      includes the DISCOVERY-TURN RULE, so the LLM has the scope of
//      permitted names.
//   3. The deterministic redactor strips uncited designer + piece names and
//      never lets a Poliform / Lasvit / Moooi / Kelly Wearstler through.
//   4. On any inspector failure mode (timeout, HTTP error, malformed JSON)
//      the deterministic redactor is a safe drop-in that also strips those
//      uncited names.

import {
  runDiscoveryProseGuard,
  deterministicRedact,
  deriveRequirementsFromText,
  mergeRequirementsWithText,
  validateRequirementsCoverage,
  SAFE_FALLBACK_PROSE,
} from "./concierge-inspector.ts";

const DISCOVERY_PROSE_HALLUCINATION =
  "With your warm bronze and stone palette, I'd suggest a piece like the 'Torus' table by Poliform, " +
  "and the 'Luminous Aura' chandelier by Lasvit. Alternatively the 'Helix' chandelier by Moooi could work. " +
  "We could also draw on Kelly Wearstler's approach to sculptural forms.";

const ALLOWED_DESIGNERS_SAMPLE = ["Saint-Louis", "Alinea Design Objects", "Andrée Putman"];
const ALLOWED_TITLES_SAMPLE = ["Calliope Medium Chandelier", "Bronze MicMac Chandelier"];

// 1. Inspector must NOT short-circuit on empty GT when allowlist is present.
Deno.test("runInspectorPass runs on discovery turns when allowlist is provided", async () => {
  const { calls } = stubFetchWithReply({
    corrected_prose:
      "With your warm bronze and stone palette, I'd like to hear more about the atmosphere before I name specific pieces.",
    corrections: [
      { original: "'Torus' table by Poliform", replacement: "[removed]", reason: "not in curation" },
      { original: "'Luminous Aura' chandelier by Lasvit", replacement: "[removed]", reason: "not in curation" },
    ],
  });
  try {
    const res = await runInspectorPass({
      prose: DISCOVERY_PROSE_HALLUCINATION,
      groundTruth: { cards: [] },
      apiKey: "test-key",
      allowedDesigners: ALLOWED_DESIGNERS_SAMPLE,
      allowedPieceTitles: ALLOWED_TITLES_SAMPLE,
    });
    assertEquals(res.ok, true, "inspector should complete, not skip");
    assertEquals(res.reason, undefined, `inspector unexpectedly skipped: ${res.reason}`);
    assert(res.corrections.length > 0, "inspector should have emitted corrections");
    assertEquals(calls.length, 1, "inspector must actually call the LLM (not short-circuit)");
    // The payload MUST include the CURATION_ALLOWLIST so the LLM has scope.
    const userMsg = calls[0].body.messages.find((m: any) => m.role === "user");
    const payload = JSON.parse(userMsg.content);
    assert("CURATION_ALLOWLIST" in payload, "payload must include CURATION_ALLOWLIST");
    assert(
      Array.isArray(payload.CURATION_ALLOWLIST.designers) &&
        payload.CURATION_ALLOWLIST.designers.includes("Saint-Louis"),
      "allowed designers must be forwarded",
    );
    // System prompt must instruct the LLM about the discovery-turn rule.
    const sysMsg = calls[0].body.messages.find((m: any) => m.role === "system");
    assertStringIncludes(sysMsg.content, "DISCOVERY-TURN RULE");
    assertStringIncludes(sysMsg.content, "CURATION_ALLOWLIST");
  } finally { restoreFetch(); }
});

// 2. Inspector still short-circuits when BOTH GT and allowlist are empty
// (nothing to compare against — legacy behaviour preserved for safety).
Deno.test("runInspectorPass short-circuits when GT and allowlist are both empty", async () => {
  const { calls } = stubFetchWithReply({ corrected_prose: "should not be called", corrections: [] });
  try {
    const res = await runInspectorPass({
      prose: "Some prose.",
      groundTruth: { cards: [] },
      apiKey: "test-key",
    });
    assertEquals(res.ok, true);
    assertEquals(res.reason, "skipped_empty");
    assertEquals(calls.length, 0, "must not call LLM when nothing to check");
  } finally { restoreFetch(); }
});

// 3. Deterministic redactor — regression against the exact hallucination the
// user hit ("Torus by Poliform / Luminous Aura by Lasvit / Helix by Moooi").
Deno.test("deterministicRedact strips uncited designers and piece titles", () => {
  const res = deterministicRedact({
    prose: DISCOVERY_PROSE_HALLUCINATION,
    allowedDesigners: ALLOWED_DESIGNERS_SAMPLE,
    allowedPieceTitles: ALLOWED_TITLES_SAMPLE,
  });
  const p = res.redacted_prose;
  // None of the uncited names may survive.
  for (const forbidden of ["Poliform", "Lasvit", "Moooi", "Kelly Wearstler", "Torus", "Luminous Aura", "Helix"]) {
    assert(
      !p.includes(forbidden),
      `deterministicRedact must strip "${forbidden}" but kept it: ${p}`,
    );
  }
  assert(res.removed_spans.length > 0, "must record what was stripped");
});

// 4. Allowlisted names are preserved verbatim.
Deno.test("deterministicRedact keeps allowlisted designer names", () => {
  const prose = "The Calliope Medium Chandelier by Saint-Louis pairs well with pieces by Andrée Putman.";
  const res = deterministicRedact({
    prose,
    allowedDesigners: ALLOWED_DESIGNERS_SAMPLE,
    allowedPieceTitles: ALLOWED_TITLES_SAMPLE,
  });
  assertStringIncludes(res.redacted_prose, "Saint-Louis");
  assertStringIncludes(res.redacted_prose, "Calliope Medium Chandelier");
  assertStringIncludes(res.redacted_prose, "Andrée Putman");
});

// 5. Heavy-hallucination prose triggers the `gutted` flag so the caller
// swaps in SAFE_FALLBACK_PROSE instead of releasing a Swiss-cheese reply.
Deno.test("deterministicRedact flags gutted output for safe-fallback swap", () => {
  const prose =
    "Poliform, Lasvit, Moooi, B&B Italia, Cassina, Minotti, Baxter, Flexform, Fendi Casa, Vitra.";
  const res = deterministicRedact({
    prose,
    allowedDesigners: ALLOWED_DESIGNERS_SAMPLE,
    allowedPieceTitles: ALLOWED_TITLES_SAMPLE,
  });
  assertEquals(res.gutted, true, "too many redactions must flag gutted");
  assert(SAFE_FALLBACK_PROSE.length > 40, "safe fallback must be non-trivial");
});

// 6. Discovery Guard: when the LLM strips namedrops, the returned prose must
// not carry any of the forbidden names.
Deno.test("runDiscoveryProseGuard returns prose free of uncited names on happy path", async () => {
  const cleaned =
    "With your warm bronze and stone palette, tell me more about the atmosphere and I'll pull a curated first edit.";
  stubFetchWithReply({ corrected_prose: cleaned, corrections: [] } as any);
  // Overwrite the stub reply to include removed_names (guard uses a different key).
  globalThis.fetch = (async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ corrected_prose: cleaned, removed_names: ["Poliform", "Lasvit", "Moooi", "Kelly Wearstler"] }) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    const res = await runDiscoveryProseGuard({
      prose: DISCOVERY_PROSE_HALLUCINATION,
      allowedDesigners: ALLOWED_DESIGNERS_SAMPLE,
      allowedPieceTitles: ALLOWED_TITLES_SAMPLE,
      apiKey: "test-key",
    });
    assertEquals(res.ok, true);
    for (const forbidden of ["Poliform", "Lasvit", "Moooi", "Kelly Wearstler"]) {
      assert(!res.corrected_prose.includes(forbidden), `guard output leaked "${forbidden}"`);
    }
    assert(res.removed_names.length >= 3);
  } finally { restoreFetch(); }
});

// 7. Discovery Guard failure surfaces ok:false so the caller can hard-fallback.
Deno.test("runDiscoveryProseGuard returns ok:false on HTTP error (caller must hard-fallback)", async () => {
  stubFetchWithReply("http_500");
  try {
    const res = await runDiscoveryProseGuard({
      prose: DISCOVERY_PROSE_HALLUCINATION,
      allowedDesigners: ALLOWED_DESIGNERS_SAMPLE,
      allowedPieceTitles: ALLOWED_TITLES_SAMPLE,
      apiKey: "test-key",
    });
    assertEquals(res.ok, false);
    assert(res.reason?.startsWith("http_"), `expected http_ reason, got ${res.reason}`);
  } finally { restoreFetch(); }
});

Deno.test("requirements validator derives budget + material + shape + seats from raw prompt and blocks unverifiable cards", () => {
  const requirements = deriveRequirementsFromText("Draft a dining edit — 8 seats, walnut, rectangular, under $12k");
  const gt = buildInspectorGroundTruth([{
    tool: "propose_tearsheet",
    pickIds: ["a", "b"],
    previews: [
      {
        id: "a",
        title: "Rocwood Dining Table",
        designer_name: "Eric Schmitt Studio",
        category: "Dining Table",
        materials: "Patinated bronze base, black tinted walnut top",
        dimensions: "240 cm long",
        price_cents: null,
        currency: "USD",
      },
      {
        id: "b",
        title: "Angelo M Dining Table",
        designer_name: "Alinéa Design Objects",
        category: "Dining Table",
        materials: "Natural stone top and base, solid American walnut",
        dimensions: "oval top, 210 cm long",
        price_cents: 9_000_00,
        currency: "USD",
      },
    ],
  }]);
  const validation = validateRequirementsCoverage(requirements, gt);
  assertEquals(validation.ok, false);
  const kinds = validation.violations.map((v) => v.kind);
  assert(kinds.includes("budget_unpriced"), `expected budget_unpriced, got ${JSON.stringify(validation.violations)}`);
  assert(kinds.includes("shape_unverified"), `expected shape_unverified, got ${JSON.stringify(validation.violations)}`);
  assert(kinds.includes("capacity_unverified"), `expected capacity_unverified, got ${JSON.stringify(validation.violations)}`);
});

Deno.test("requirements validator passes a fully verified priced dining table", () => {
  const requirements = deriveRequirementsFromText("Draft a dining edit — 8 seats, walnut, rectangular, under $12k");
  const gt = buildInspectorGroundTruth([{
    tool: "propose_tearsheet",
    pickIds: ["ok"],
    previews: [{
      id: "ok",
      title: "Rectangular Walnut Dining Table",
      designer_name: "Maison Affluency Atelier",
      category: "Dining Table",
      materials: "Walnut",
      dimensions: "Rectangular, seats 8, 280 cm long",
      price_cents: 11_500_00,
      currency: "USD",
    }],
  }]);
  const validation = validateRequirementsCoverage(requirements, gt);
  assertEquals(validation.ok, true, JSON.stringify(validation.violations));
});

Deno.test("mergeRequirementsWithText restores prompt constraints omitted by model-extracted requirements", () => {
  const modelReq = {
    slots: [{ typology: "dining_table", qty_min: 1, qty_max: 1 }],
    brands: [],
    style: [],
    materials: [],
    room: "dining room",
    scale: "",
    era: "",
    notes: "",
  };
  const merged = mergeRequirementsWithText(modelReq, "Draft a dining edit — 8 seats, walnut, rectangular, under $12k");
  assert(merged, "expected merged requirements");
  assertEquals(merged?.budget_cents, 1_200_000);
  assertEquals(merged?.budget_currency, "USD");
  assert(merged?.materials?.includes("walnut"), `expected walnut in ${JSON.stringify(merged?.materials)}`);
  assertStringIncludes(merged?.scale || "", "seats 8");
  assertStringIncludes(merged?.notes || "", "rectangular");
});
