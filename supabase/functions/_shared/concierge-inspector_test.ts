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
