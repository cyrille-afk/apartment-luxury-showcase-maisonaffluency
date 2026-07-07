// End-to-end tests for the Tier B semantic retrieval path.
//
// Guarantees exercised:
//   1. For each Tier-A-empty query (no roster name mentioned), the pure
//      `buildQuerySpecialties()` returns "". This confirms Tier A really
//      fails on the fixture set — a precondition for the rest of the tests.
//   2. The `concierge-grounding-probe` edge function returns embed_ok+rpc_ok
//      and surfaces ≥1 semantic hit whose similarity clears the production
//      floor (0.25). This proves the embed → match_roster_public pipeline
//      is live in the deployed environment.
//   3. Every returned semantic hit's name is on the deterministic ROSTER —
//      so retrieval can never smuggle in an off-roster fabrication.
//   4. The grounding_block returned by the probe contains the
//      "Most relevant roster members" details section built purely from
//      Tier B hits (Tier A yielded nothing).
//
// Runs against the deployed edge function. Auth: any valid trade user JWT.
// Set `E2E_USER_ACCESS_TOKEN` before running (see `scripts/mint-e2e-token.mjs`).
// The tests skip cleanly if the token isn't provided so they don't break
// the wider `deno test` sweep in local dev.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildQuerySpecialties } from "./_grounding.ts";
import { ROSTER } from "./_roster.ts";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const USER_TOKEN = Deno.env.get("E2E_USER_ACCESS_TOKEN") ?? "";
const ENDPOINT = `${SUPABASE_URL}/functions/v1/concierge-grounding-probe`;

const ROSTER_NAMES = new Set(ROSTER.map((r) => r.name));

// Queries that mention topics/materials/styles but NO roster name. Each is
// a realistic visitor question that Tier A cannot help with — retrieval is
// the only way to surface useful designers.
const TIER_A_EMPTY_QUERIES = [
  "I'm looking for Italian mid-century floor lamps for a deco library.",
  "Do you have any hand-woven wool rugs in muted earth tones?",
  "Show me sculptural brass side tables for a Parisian pied-à-terre.",
  "What art-deco lighting could work above a curved marble bar?",
];

async function probe(query: string) {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${USER_TOKEN}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ query }),
  });
  const text = await resp.text();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(text); } catch { /* leave null */ }
  return { status: resp.status, text, json };
}

// -------------------- Unit-level preconditions --------------------

Deno.test("Tier A returns empty for every fixture query (no roster name mention)", () => {
  for (const q of TIER_A_EMPTY_QUERIES) {
    const specs = buildQuerySpecialties(q);
    assertEquals(
      specs,
      "",
      `Fixture "${q}" unexpectedly matched Tier A lexical grounding: ${specs}`,
    );
  }
});

// -------------------- Live pipeline tests --------------------

if (!USER_TOKEN) {
  console.warn(
    "[tier_b_test] E2E_USER_ACCESS_TOKEN not set — skipping live probe tests. " +
      "Run `E2E_USER_ACCESS_TOKEN=$(node scripts/mint-e2e-token.mjs) " +
      "deno test supabase/functions/concierge-public-stream/tier_b_test.ts`.",
  );
} else {
  for (const query of TIER_A_EMPTY_QUERIES) {
    Deno.test({
      name: `Tier B surfaces on-roster designers for: "${query}"`,
      async fn() {
        const { status, text, json } = await probe(query);
        assertEquals(status, 200, `probe failed (${status}): ${text.slice(0, 300)}`);
        assert(json, "probe returned non-JSON body");

        assertEquals(json.tier_a_empty, true, "precondition: Tier A must be empty");
        assertEquals(json.embed_ok, true, "Lovable AI embeddings call must succeed");
        assertEquals(json.rpc_ok, true, "match_roster_public RPC must return rows");

        const hits = json.semantic_hits as Array<{
          name: string; specialty: string; similarity: number;
        }>;
        assert(
          Array.isArray(hits) && hits.length >= 1,
          `expected ≥1 semantic hit above sim floor, got ${hits?.length ?? 0}`,
        );

        for (const h of hits) {
          assert(
            ROSTER_NAMES.has(h.name),
            `off-roster name "${h.name}" surfaced by retrieval — allow-list breach`,
          );
          assert(
            h.similarity > 0.25,
            `hit "${h.name}" below production sim floor (${h.similarity})`,
          );
        }

        assertEquals(
          json.has_details_section,
          true,
          "grounding block must include the details section built from Tier B hits",
        );
        assertStringIncludes(
          json.grounding_block as string,
          "Most relevant roster members",
        );
        // At least one hit's name must appear in the details section.
        const block = json.grounding_block as string;
        const detailsIdx = block.indexOf("Most relevant roster members");
        const details = block.slice(detailsIdx);
        const found = hits.some((h) => details.includes(h.name));
        assert(
          found,
          `no semantic hit name found in details section for "${query}"`,
        );
      },
    });
  }

  // Off-topic queries that should NOT confidently match any roster entry —
  // proves the low-confidence / graceful-refusal fallback kicks in end-to-end.
  const OFF_TOPIC_QUERIES = [
    "What's your shipping policy for the Middle East?",
    "Can you recommend a good sushi restaurant in Tokyo?",
  ];
  for (const query of OFF_TOPIC_QUERIES) {
    Deno.test({
      name: `Graceful fallback (no confident match) for: "${query}"`,
      async fn() {
        const { status, json } = await probe(query);
        assertEquals(status, 200);
        assert(json, "probe returned non-JSON body");
        // Either the top hit was below the strict floor (low_confidence)
        // or nothing cleared the absolute floor at all — both are "not ok".
        const rs = json.retrieval_status as string;
        assert(
          rs === "low_confidence" || rs === "unavailable" ||
            (rs === "ok" && (json.semantic_hits as unknown[]).length === 0),
          `expected non-ok retrieval status for off-topic query, got "${rs}" with ${(json.semantic_hits as unknown[]).length} hits`,
        );
        // The grounding block must NOT present these as a firm curatorial
        // match — either it uses the soft-suggestion heading or the
        // graceful-refusal directive.
        const block = json.grounding_block as string;
        assertEquals(
          block.includes("Most relevant roster members"),
          false,
          `off-topic query "${query}" must not surface the strict quote-these heading`,
        );
        // One of the fallback affordances must be present.
        const hasFallback = block.includes("Roster members that MAY relate") ||
          block.includes("No confident roster match") ||
          block.includes("No retrieval context available");
        assert(
          hasFallback,
          `expected fallback directive in grounding block for "${query}"`,
        );
      },
    });
  }

  Deno.test("Rejects unauthenticated probes", async () => {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ query: "art deco lighting" }),
    });
    await resp.body?.cancel();
    assertEquals(resp.status, 401);
  });
}
