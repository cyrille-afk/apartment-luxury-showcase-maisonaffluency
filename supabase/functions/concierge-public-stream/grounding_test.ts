// Deterministic tests for the concierge-public-stream grounding layer.
// Runs under Deno: `deno test supabase/functions/concierge-public-stream/`.
//
// These are pure-string assertions on the injected roster block — they do
// NOT call the model. The hallucination surface we're closing is upstream
// of the LLM: as long as (a) the allow-list contains every roster name and
// (b) it contains no name we don't represent, the model has the correct
// grounding context. Model behaviour on top of that is a separate concern
// covered by manual adversarial spot checks (see the plan).

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGroundingBlock,
  buildQuerySpecialties,
  ROSTER_NAMES_BLOCK,
} from "./_grounding.ts";
import { ROSTER } from "./_roster.ts";

Deno.test("roster is non-empty and deduplicated", () => {
  assert(ROSTER.length > 100, `expected large roster, got ${ROSTER.length}`);
  const names = new Set(ROSTER.map((r) => r.name.toLowerCase()));
  assertEquals(names.size, ROSTER.length, "roster contains duplicate names");
});

Deno.test("names block includes every roster entry", () => {
  for (const entry of ROSTER) {
    assertStringIncludes(ROSTER_NAMES_BLOCK, entry.name);
  }
});

Deno.test("names block stays under 8 kB (cache prefix budget)", () => {
  const bytes = new TextEncoder().encode(ROSTER_NAMES_BLOCK).length;
  assert(bytes < 8000, `roster block is ${bytes} bytes — trim before shipping`);
});

Deno.test("on-roster designer mention yields a specialty line", () => {
  // Pierre Chareau is a well-known on-roster designer. His specialty line
  // must surface when the query mentions him.
  const specs = buildQuerySpecialties("Do you carry Pierre Chareau?");
  assertStringIncludes(specs, "Pierre Chareau");
});

Deno.test("last-name-only mention still matches", () => {
  // Chareau alone should hit Pierre Chareau (surname ≥ 5 chars rule).
  const specs = buildQuerySpecialties("Tell me about Chareau's work.");
  assertStringIncludes(specs, "Pierre Chareau");
});

Deno.test("off-roster designer mention returns empty specialties", () => {
  // "Yovanovitch" is famously NOT on the roster (was previously mentioned
  // in the concierge system prompt by mistake — this test guards the fix).
  const specs = buildQuerySpecialties("Do you carry Pierre Yovanovitch?");
  assertEquals(
    specs.includes("Yovanovitch"),
    false,
    "Yovanovitch should NOT surface from the roster",
  );
});

Deno.test("grounding block always includes the allow-list and rule", () => {
  const block = buildGroundingBlock("Hello");
  assertStringIncludes(block, "Verified Maison Affluency roster");
  assertStringIncludes(block, "Grounding rule");
  assertStringIncludes(block, "note the enquiry");
  // Random roster entry must be present.
  assertStringIncludes(block, ROSTER[0].name);
});

Deno.test("grounding block appends details section only on relevant queries", () => {
  const plain = buildGroundingBlock("What's your shipping policy?");
  assertEquals(
    plain.includes("Facts for this query"),
    false,
    "empty query should not add the details block",
  );

  const named = buildGroundingBlock("I'd like a Chareau piece for my library.");
  assertStringIncludes(named, "Facts for this query");
  assertStringIncludes(named, "Pierre Chareau");
});

Deno.test("specialties block is capped at 8 hits", () => {
  // Assemble a query that mentions many roster names at once — the block
  // should still cap at 8 lines to keep the prompt bounded.
  const many = ROSTER.slice(0, 20).map((r) => r.name).join(" ");
  const specs = buildQuerySpecialties(many);
  const lines = specs.split("\n").filter(Boolean);
  assert(lines.length <= 8, `expected ≤8 lines, got ${lines.length}`);
});
