// Deterministic unit tests for `validateRequirementsCoverage`.
//
// Pure function — no network, no fetch stubs. Each test pins one facet of the
// contract the Inspector Agent relies on:
//
//   1. Slot typology coverage (chair vs table synonym matching, greedy claim
//      so one item can only satisfy one slot).
//   2. Quantity shortfalls (delivered < qty_min → slot_undelivered).
//   3. Overdelivery (delivered > qty_max → slot_overdelivered, still ok=false).
//   4. Brand honoring (only enforced when the user named brands).
//   5. Fail-open defaults (no requirements → ok=true; empty slots → no_slots
//      violation but ok stays true; unknown typology falls back to token
//      matching, never throws).

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildInspectorGroundTruth,
  validateRequirementsCoverage,
  type InspectorGroundTruth,
  type RequirementsInput,
} from "./concierge-inspector.ts";

// ---------- helpers ----------------------------------------------------

function gt(items: Array<Partial<{
  id: string; title: string; designer: string | null; category: string | null; materials: string | null;
}>>): InspectorGroundTruth {
  return buildInspectorGroundTruth([{
    tool: "propose_tearsheet",
    pickIds: items.map((i, idx) => String(i.id ?? `id-${idx}`)),
    previews: items.map((i, idx) => ({
      id: String(i.id ?? `id-${idx}`),
      title: i.title ?? "",
      designer_name: i.designer ?? null,
      category: i.category ?? null,
      materials: i.materials ?? null,
    })),
  }]);
}

const req = (r: Partial<RequirementsInput>): RequirementsInput => ({
  slots: [], style: [], materials: [], brands: [], room: "", scale: "", era: "", notes: "",
  ...r,
});

// ---------- 1. Typology coverage --------------------------------------

Deno.test("coverage — dining_table + dining_chair are matched by category/title", () => {
  const g = gt([
    { id: "t1", title: "Oval Dining Table", category: "Dining Tables" },
    { id: "c1", title: "Side Chair", category: "Dining Chairs" },
    { id: "c2", title: "Side Chair", category: "Dining Chairs" },
    { id: "c3", title: "Side Chair", category: "Dining Chairs" },
    { id: "c4", title: "Side Chair", category: "Dining Chairs" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [
      { typology: "dining_table", qty_min: 1, qty_max: 1 },
      { typology: "dining_chair", qty_min: 4, qty_max: 4 },
    ],
  }), g);

  assert(v.ok, "expected ok when every slot is satisfied");
  assertEquals(v.violations.length, 0);
  assertEquals(v.coverage.length, 2);
  const table = v.coverage.find((c) => c.typology === "dining_table")!;
  const chair = v.coverage.find((c) => c.typology === "dining_chair")!;
  assertEquals(table.delivered, 1);
  assertEquals(table.matched_ids, ["t1"]);
  assertEquals(chair.delivered, 4);
  // Greedy: each id claimed exactly once → no unmatched leftovers.
  assertEquals(v.unmatched_ids.length, 0);
});

Deno.test("coverage — greedy assignment, one item cannot satisfy two slots", () => {
  // A single "dining table" must not double-count as both a dining_table slot
  // AND a side_table slot even though it contains the word "table".
  const g = gt([
    { id: "t1", title: "Round Dining Table", category: "Tables" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [
      { typology: "dining_table", qty_min: 1, qty_max: 1 },
      { typology: "side_table", qty_min: 1, qty_max: 1 },
    ],
  }), g);

  assertEquals(v.ok, false);
  const violations = v.violations.filter((x) => x.kind === "slot_undelivered");
  assertEquals(violations.length, 1);
  assertEquals((violations[0] as any).typology, "side_table");
});

// ---------- 2. Quantity shortfalls ------------------------------------

Deno.test("shortfall — 8 chairs requested, 4 delivered → slot_undelivered", () => {
  const g = gt([
    { id: "t1", title: "Dining Table", category: "Tables" },
    { id: "c1", title: "Chair", category: "Chairs" },
    { id: "c2", title: "Chair", category: "Chairs" },
    { id: "c3", title: "Chair", category: "Chairs" },
    { id: "c4", title: "Chair", category: "Chairs" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [
      { typology: "dining_table", qty_min: 1, qty_max: 1 },
      { typology: "dining_chair", qty_min: 8, qty_max: 8 },
    ],
  }), g);

  assertEquals(v.ok, false);
  assertEquals(v.violations.length, 1);
  const vio = v.violations[0] as any;
  assertEquals(vio.kind, "slot_undelivered");
  assertEquals(vio.typology, "dining_chair");
  assertEquals(vio.qty_min, 8);
  assertEquals(vio.delivered, 4);
});

Deno.test("shortfall — zero-match typology reports delivered=0", () => {
  const g = gt([
    { id: "t1", title: "Round Dining Table", category: "Tables" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [
      { typology: "chandelier", qty_min: 1, qty_max: 1 },
    ],
  }), g);

  assertEquals(v.ok, false);
  const vio = v.violations[0] as any;
  assertEquals(vio.kind, "slot_undelivered");
  assertEquals(vio.typology, "chandelier");
  assertEquals(vio.delivered, 0);
  assertEquals(v.coverage[0].matched_ids, []);
});

Deno.test("shortfall — qty_max clamp prevents runaway greedy claim", () => {
  const g = gt(Array.from({ length: 12 }, (_, i) => ({
    id: `c${i}`, title: "Chair", category: "Chairs",
  })));
  const v = validateRequirementsCoverage(req({
    slots: [
      { typology: "dining_chair", qty_min: 6, qty_max: 6 },
    ],
  }), g);

  assert(v.ok);
  assertEquals(v.coverage[0].delivered, 6);
  // Six chairs left unclaimed for other slots (there are none).
  assertEquals(v.unmatched_ids.length, 6);
});

// ---------- 3. Overdelivery -------------------------------------------

Deno.test("overdelivery is currently prevented by qty_max clamp (not a violation)", () => {
  // The greedy loop stops at qty_max, so `slot_overdelivered` is a defensive
  // branch not reachable through the normal matcher. Assert the ok path.
  const g = gt(Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`, title: "Chair", category: "Chairs",
  })));
  const v = validateRequirementsCoverage(req({
    slots: [{ typology: "dining_chair", qty_min: 2, qty_max: 4 }],
  }), g);
  assert(v.ok);
  assertEquals(v.coverage[0].delivered, 4);
  assertEquals(v.violations.length, 0);
});

// ---------- 4. Brand honoring -----------------------------------------

Deno.test("brand — requested Saint-Louis, delivered Alinea → brand_mismatch", () => {
  const g = gt([
    { id: "a1", title: "Chandelier", category: "Lighting", designer: "Alinea" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [{ typology: "chandelier", qty_min: 1, qty_max: 1 }],
    brands: ["Saint-Louis"],
  }), g);

  assertEquals(v.brand_ok, false);
  assert(v.violations.some((x) => x.kind === "brand_mismatch"));
  assertEquals(v.ok, false);
});

Deno.test("brand — requested brand present anywhere in the set → brand_ok", () => {
  const g = gt([
    { id: "s1", title: "Tumbler", category: "Glassware", designer: "Saint-Louis" },
    { id: "a1", title: "Chandelier", category: "Lighting", designer: "Alinea" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [
      { typology: "chandelier", qty_min: 1, qty_max: 1 },
      { typology: "glassware", qty_min: 1, qty_max: 1 },
    ],
    brands: ["Saint-Louis"],
  }), g);
  assert(v.brand_ok);
  assert(!v.violations.some((x) => x.kind === "brand_mismatch"));
});

Deno.test("brand — no brands requested → brand check is skipped", () => {
  const g = gt([
    { id: "a1", title: "Chandelier", category: "Lighting", designer: "Alinea" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [{ typology: "chandelier", qty_min: 1, qty_max: 1 }],
    brands: [],
  }), g);
  assert(v.brand_ok);
  assert(v.ok);
});

// ---------- 5. Fail-open defaults -------------------------------------

Deno.test("fail-open — null requirements → ok=true, no violations", () => {
  const g = gt([{ id: "x1", title: "Whatever", category: "Objects" }]);
  const v = validateRequirementsCoverage(null, g);
  assert(v.ok);
  assertEquals(v.violations, []);
  assertEquals(v.total_items, 1);
  assertEquals(v.unmatched_ids, ["x1"]);
});

Deno.test("fail-open — undefined requirements → ok=true, no violations", () => {
  const g = gt([{ id: "x1", title: "Whatever", category: "Objects" }]);
  const v = validateRequirementsCoverage(undefined, g);
  assert(v.ok);
  assertEquals(v.violations, []);
});

Deno.test("fail-open — empty slots array emits no_slots but ok stays true", () => {
  const g = gt([{ id: "x1", title: "Whatever", category: "Objects" }]);
  const v = validateRequirementsCoverage(req({ slots: [] }), g);
  assert(v.ok, "empty-slots must not fail — nothing to validate against");
  assertEquals(v.violations.length, 1);
  assertEquals(v.violations[0].kind, "no_slots");
});

Deno.test("fail-open — unknown typology falls back to token matching, never throws", () => {
  const g = gt([
    { id: "o1", title: "Mysterious Object", category: "Objects" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [{ typology: "totally_unknown_thing", qty_min: 1, qty_max: 1 }],
  }), g);
  // No match expected, but the call must return a structured result rather
  // than throwing.
  assertEquals(v.ok, false);
  assertEquals(v.coverage.length, 1);
  assertEquals(v.coverage[0].delivered, 0);
});

Deno.test("fail-open — empty ground truth with slots → all slots undelivered", () => {
  const g = gt([]);
  const v = validateRequirementsCoverage(req({
    slots: [
      { typology: "dining_table", qty_min: 1, qty_max: 1 },
      { typology: "dining_chair", qty_min: 4, qty_max: 4 },
    ],
  }), g);
  assertEquals(v.ok, false);
  assertEquals(v.violations.length, 2);
  assertEquals(v.total_items, 0);
  assertEquals(v.unmatched_ids, []);
});

Deno.test("fail-open — malformed qty values are clamped, not thrown", () => {
  const g = gt([
    { id: "c1", title: "Chair", category: "Chairs" },
  ]);
  const v = validateRequirementsCoverage(req({
    slots: [
      // qty_min NaN, qty_max negative — both should coerce to 0 without throwing.
      { typology: "chair", qty_min: Number.NaN as any, qty_max: -3 as any },
    ],
  }), g);
  assert(v.ok, "0-min slot is trivially satisfied");
  assertEquals(v.coverage[0].qty_min, 0);
  assertEquals(v.coverage[0].qty_max, 0);
});
