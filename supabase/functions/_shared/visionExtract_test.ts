// Unit tests for _shared/visionExtract helpers. No network calls — we only
// verify the normalisation, filter builder, and query builder shape.
//
// Run with:  deno test supabase/functions/_shared/visionExtract_test.ts

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { toEmbeddingQuery, toStructuralFilter, type ExtractedVision } from "./visionExtract.ts";

function make(overrides: Partial<ExtractedVision> = {}): ExtractedVision {
  return {
    kind: "mood_board",
    style: [],
    palette: [],
    materials: [],
    categories: [],
    subcategories: [],
    room_type: null,
    designer_hints: [],
    max_width_cm: null,
    max_depth_cm: null,
    max_height_cm: null,
    max_lead_weeks: null,
    budget_currency: null,
    budget_max: null,
    notes: "",
    ...overrides,
  };
}

Deno.test("toEmbeddingQuery merges user text with extracted aesthetic signals", () => {
  const v = make({
    style: ["mid-century", "warm minimal"],
    palette: ["ivory", "walnut"],
    materials: ["boucle"],
    subcategories: ["sofa"],
    designer_hints: ["Pierre Jeanneret"],
  });
  const q = toEmbeddingQuery(v, "Client wants a two-seater for a snug");
  // Order matters: user text first, then style/palette/materials.
  const idxUser = q.indexOf("Client wants");
  const idxStyle = q.indexOf("style:");
  const idxMat = q.indexOf("materials:");
  const idxSub = q.indexOf("sofa");
  const idxDesigner = q.indexOf("Pierre Jeanneret");
  assertEquals(idxUser === 0, true, "user text should lead");
  assertEquals(idxUser < idxStyle && idxStyle < idxMat && idxMat < idxSub && idxSub < idxDesigner, true);
});

Deno.test("toEmbeddingQuery omits empty sections cleanly", () => {
  const v = make({ style: ["brutalist"] });
  const q = toEmbeddingQuery(v);
  assertEquals(q, "style: brutalist");
});

Deno.test("toEmbeddingQuery caps length at 1200 chars", () => {
  const bigList = Array.from({ length: 12 }, () => "x".repeat(100));
  const v = make({ style: bigList, palette: bigList, materials: bigList });
  const q = toEmbeddingQuery(v, "y".repeat(2000));
  assertEquals(q.length <= 1200, true);
});

Deno.test("toStructuralFilter picks the first category / subcategory / designer", () => {
  const v = make({
    categories: ["seating", "lighting"],
    subcategories: ["sofa", "armchair"],
    designer_hints: ["Charlotte Perriand", "someone else"],
    max_lead_weeks: 12,
  });
  const f = toStructuralFilter(v);
  assertEquals(f.category, "seating");
  assertEquals(f.subcategory, "sofa");
  assertEquals(f.designer, "Charlotte Perriand");
  assertEquals(f.max_lead_weeks, 12);
});

Deno.test("toStructuralFilter drops empty keys entirely", () => {
  const v = make({ categories: ["rugs"] });
  const f = toStructuralFilter(v);
  assertEquals(Object.keys(f).sort(), ["category"]);
});

Deno.test("toStructuralFilter is empty for a bare extraction", () => {
  const f = toStructuralFilter(make());
  assertEquals(Object.keys(f).length, 0);
});
