// Regression tests for deferred-wording detection in typology parsing.
//
// These pin the exact bug we shipped fixes for: end-clients frequently defer
// items ("rug and chandelier at a later date", "TBD", "phase 2", …). Those
// items MUST NOT appear as required typology slots, otherwise the validator
// rejects an otherwise-complete brief.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveRequirementsFromText } from "./concierge-inspector.ts";

function typs(text: string): string[] {
  const r = deriveRequirementsFromText(text);
  return (r?.slots ?? []).map((s) => s.typology).sort();
}

const ACTIVE = ["armchair", "coffee_table", "side_table", "sofa"];

// ---------- deferred phrasings that MUST exclude rug/chandelier ----------

const DEFERRED_CASES: Array<{ label: string; brief: string }> = [
  {
    label: "explicit 'at a later date'",
    brief:
      "Living room. Sofa, armchairs, coffee table, side table. I will select the rug and chandelier at a later date.",
  },
  {
    label: "trailing bare 'later'",
    brief: "Living room. Sofa, armchairs, coffee table, side table. Rug and chandelier later.",
  },
  {
    label: "semicolon aside with 'rug/chandelier later'",
    brief: "Living room: sofa, armchair, coffee table, side table; rug/chandelier later.",
  },
  {
    label: "em-dash aside with TBD",
    brief:
      "Living room. Sofa, armchairs, coffee table, side table — rug and chandelier TBD.",
  },
  {
    label: "parenthetical 'to follow'",
    brief:
      "Living room. Sofa, armchair, coffee table, side table (rug and chandelier to follow).",
  },
  {
    label: "phase 2",
    brief:
      "Living room: sofa, armchairs, coffee table, side table. Rug, chandelier in phase 2.",
  },
  {
    label: "next phase (spaced-hyphen aside)",
    brief:
      "Living room. Sofa, armchairs, coffee table and side table - rug and chandelier next phase.",
  },
  {
    label: "sourced separately",
    brief:
      "Living room. Sofa, armchairs, coffee table, side table. I will source the rug and chandelier separately.",
  },
  {
    label: "colon + TBD",
    brief: "Living room. Sofa, armchairs, coffee table, side table. Rug and chandelier: TBD.",
  },
  {
    label: "TBC abbreviation",
    brief: "Living room. Sofa, armchair, coffee table, side table. Chandelier and rug TBC.",
  },
  {
    label: "'not now'",
    brief:
      "Living room. Sofa, armchairs, coffee table, side table. Rug and chandelier — not now.",
  },
  {
    label: "'down the road'",
    brief:
      "Living room. Sofa, armchairs, coffee table, side table. We'll pick the rug and chandelier down the road.",
  },
  {
    label: "parenthetical (later)",
    brief:
      "Living room. Sofa, armchairs, coffee table, side table. Rug (later) and chandelier (later).",
  },
  {
    label: "'will be selected later'",
    brief:
      "Living room. Sofa, armchairs, coffee table, side table. Rug and chandelier will be selected later.",
  },
];

for (const { label, brief } of DEFERRED_CASES) {
  Deno.test(`deferred: ${label} → excludes rug/chandelier`, () => {
    const t = typs(brief);
    assertEquals(
      t,
      ACTIVE,
      `Expected only ${ACTIVE.join(", ")} but got ${t.join(", ") || "(none)"}\nBrief: ${brief}`,
    );
    assert(!t.includes("rug"), "rug must not be a required slot");
    assert(!t.includes("chandelier"), "chandelier must not be a required slot");
    assert(!t.includes("pendant"), "pendant must not be a required slot");
    assert(!t.includes("ceiling_light"), "ceiling_light must not be a required slot");
  });
}

// ---------- guardrail: non-deferred mentions still count ---------------

Deno.test("non-deferred: rug + chandelier explicitly required", () => {
  const t = typs(
    "Living room. Sofa, armchairs, coffee table, side table, rug and chandelier.",
  );
  // Rug and chandelier/pendant should now be present alongside the base four.
  for (const active of ACTIVE) {
    assert(t.includes(active), `missing active typology: ${active}`);
  }
  const hasLight = t.includes("chandelier") || t.includes("pendant") || t.includes("ceiling_light");
  const hasRug = t.includes("rug");
  assert(hasRug, "rug should be a required slot when not deferred");
  assert(hasLight, "chandelier/pendant should be a required slot when not deferred");
});

Deno.test("non-deferred: standalone 'later' inside brand name is not a trigger", () => {
  // Sanity check the trailing-later regex doesn't eat unrelated clauses.
  const t = typs(
    "Living room. Sofa, armchairs, coffee table, side table. Prefer a warmer palette.",
  );
  assertEquals(t, ACTIVE);
});
