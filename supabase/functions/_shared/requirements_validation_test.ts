// Unit tests for `validateRequirementsCoverage` — the hard-constraint checker
// that flags budget overruns, currency mismatches and palette drift on the
// items an assembled card was built from.
//
// These tests are pure (no fetch stubbing, no network) and pin the three
// violation kinds we now enforce as hard constraints:
//
//   1. `budget_over`              — priced sum exceeds `budget_cents`
//   2. `budget_currency_mismatch` — items priced in a currency other than the
//                                   requested one
//   3. `palette_mismatch`         — items whose title/category/materials do
//                                   not include any requested material/style
//                                   token
//
// Run with:
//   deno test --no-check --filter "requirements-validation" \
//     supabase/functions/_shared/requirements_validation_test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  validateRequirementsCoverage,
  type InspectorGroundTruth,
  type RequirementsInput,
} from "./concierge-inspector.ts";

// ---------- helpers ----------------------------------------------------

type Item = InspectorGroundTruth["cards"][number]["items"][number];

function makeItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    id: overrides.id,
    title: overrides.title ?? "Untitled",
    designer: overrides.designer ?? null,
    category: overrides.category ?? null,
    materials: overrides.materials ?? null,
    price_cents: overrides.price_cents ?? null,
    currency: overrides.currency ?? null,
  };
}

function makeGT(items: Item[]): InspectorGroundTruth {
  return {
    cards: [
      {
        tool: "propose_tearsheet",
        total: items.length,
        brand_counts: {},
        items,
      },
    ],
  };
}

function violationKinds(v: ReturnType<typeof validateRequirementsCoverage>): string[] {
  return v.violations.map((x) => x.kind).sort();
}

// ---------- budget: over ----------------------------------------------

Deno.test("requirements-validation — emits budget_over when priced total exceeds budget_cents", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Oak chair", category: "chair", price_cents: 600_000, currency: "EUR" }),
    makeItem({ id: "p2", title: "Oak chair", category: "chair", price_cents: 600_000, currency: "EUR" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 2, qty_max: 2 }],
    budget_cents: 1_000_000, // 10k EUR
    budget_currency: "EUR",
  };

  const v = validateRequirementsCoverage(req, gt);

  assertEquals(v.budget_ok, false);
  assert(v.budget, "budget check should be populated");
  assertEquals(v.budget!.total_cents, 1_200_000);
  assertEquals(v.budget!.over_by_cents, 200_000);
  assertEquals(v.budget!.priced_items, 2);
  assertEquals(v.budget!.unpriced_items, 0);
  assertEquals(v.budget!.ok, false);

  const over = v.violations.find((x) => x.kind === "budget_over");
  assert(over, "expected a budget_over violation");
  if (over.kind === "budget_over") {
    assertEquals(over.requested_cents, 1_000_000);
    assertEquals(over.total_cents, 1_200_000);
    assertEquals(over.over_by_cents, 200_000);
    assertEquals(over.currency, "EUR");
  }
  assertEquals(v.ok, false);
});

Deno.test("requirements-validation — does NOT emit budget_over when total is within budget", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Oak chair", category: "chair", price_cents: 300_000, currency: "EUR" }),
    makeItem({ id: "p2", title: "Oak chair", category: "chair", price_cents: 400_000, currency: "EUR" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 2, qty_max: 2 }],
    budget_cents: 1_000_000,
    budget_currency: "EUR",
  };

  const v = validateRequirementsCoverage(req, gt);
  assertEquals(v.budget_ok, true);
  assertEquals(v.budget!.ok, true);
  assertEquals(v.budget!.over_by_cents, 0);
  assertEquals(v.violations.filter((x) => x.kind === "budget_over").length, 0);
});

Deno.test("requirements-validation — unpriced items are counted but do not inflate the total", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Oak chair", category: "chair", price_cents: 400_000, currency: "EUR" }),
    makeItem({ id: "p2", title: "Oak chair", category: "chair", price_cents: null }), // Price on Request
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 2, qty_max: 2 }],
    budget_cents: 1_000_000,
    budget_currency: "EUR",
  };

  const v = validateRequirementsCoverage(req, gt);
  assertEquals(v.budget!.priced_items, 1);
  assertEquals(v.budget!.unpriced_items, 1);
  assertEquals(v.budget!.total_cents, 400_000);
  assertEquals(v.budget!.ok, true);
});

// ---------- budget: currency mismatch ---------------------------------

Deno.test("requirements-validation — emits budget_currency_mismatch when items are priced in a foreign currency", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Oak chair", category: "chair", price_cents: 300_000, currency: "USD" }),
    makeItem({ id: "p2", title: "Oak chair", category: "chair", price_cents: 300_000, currency: "EUR" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 2, qty_max: 2 }],
    budget_cents: 1_000_000,
    budget_currency: "EUR",
  };

  const v = validateRequirementsCoverage(req, gt);
  const mismatch = v.violations.find((x) => x.kind === "budget_currency_mismatch");
  assert(mismatch, "expected a budget_currency_mismatch violation");
  if (mismatch.kind === "budget_currency_mismatch") {
    assertEquals(mismatch.requested, "EUR");
    // Both currencies appear on the ground-truth items; order-insensitive check.
    assertEquals([...mismatch.found].sort(), ["EUR", "USD"]);
  }
});

Deno.test("requirements-validation — no currency_mismatch when every priced item matches the requested currency", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Oak chair", category: "chair", price_cents: 300_000, currency: "eur" }),
    makeItem({ id: "p2", title: "Oak chair", category: "chair", price_cents: 300_000, currency: "EUR" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 2, qty_max: 2 }],
    budget_cents: 1_000_000,
    budget_currency: "eur", // lowercased on input — validator must normalise
  };

  const v = validateRequirementsCoverage(req, gt);
  assertEquals(v.violations.filter((x) => x.kind === "budget_currency_mismatch").length, 0);
});

// ---------- palette ----------------------------------------------------

Deno.test("requirements-validation — emits palette_mismatch listing offending SKU ids and titles", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Oak side chair", category: "chair", materials: "solid oak, brass" }),
    makeItem({ id: "p2", title: "Walnut lounge chair", category: "chair", materials: "walnut, leather" }),
    makeItem({ id: "p3", title: "Marble console", category: "console", materials: "carrara marble" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 2, qty_max: 2 }],
    materials: ["oak", "brass"],
  };

  const v = validateRequirementsCoverage(req, gt);
  assertEquals(v.palette_ok, false);
  assert(v.palette, "palette check should be populated");
  assertEquals(v.palette!.matched_ids, ["p1"]);
  assertEquals([...v.palette!.offending_ids].sort(), ["p2", "p3"]);

  const pm = v.violations.find((x) => x.kind === "palette_mismatch");
  assert(pm, "expected a palette_mismatch violation");
  if (pm.kind === "palette_mismatch") {
    assertEquals([...pm.requested].sort(), ["brass", "oak"]);
    assertEquals([...pm.offending_ids].sort(), ["p2", "p3"]);
    // Titles are surfaced for the tooltip UI.
    assert(pm.offending_titles.includes("Walnut lounge chair"));
    assert(pm.offending_titles.includes("Marble console"));
  }
});

Deno.test("requirements-validation — no palette_mismatch when every item hits at least one palette token (via title or materials)", () => {
  const gt = makeGT([
    // Token match via `materials`.
    makeItem({ id: "p1", title: "Side chair", category: "chair", materials: "solid oak" }),
    // Token match via `title`.
    makeItem({ id: "p2", title: "Brass floor lamp", category: "floor_lamp", materials: "steel" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 1, qty_max: 1 }],
    materials: ["oak", "brass"],
  };

  const v = validateRequirementsCoverage(req, gt);
  assertEquals(v.palette_ok, true);
  assertEquals(v.violations.filter((x) => x.kind === "palette_mismatch").length, 0);
  assertEquals([...v.palette!.matched_ids].sort(), ["p1", "p2"]);
  assertEquals(v.palette!.offending_ids, []);
});

Deno.test("requirements-validation — style tokens count toward the palette check alongside materials", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Minimalist oak chair", category: "chair", materials: "oak" }),
    makeItem({ id: "p2", title: "Baroque gilded armchair", category: "chair", materials: "gilt wood" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 2, qty_max: 2 }],
    style: ["minimalist"],
  };

  const v = validateRequirementsCoverage(req, gt);
  const pm = v.violations.find((x) => x.kind === "palette_mismatch");
  assert(pm, "expected the baroque piece to fail the minimalist palette check");
  if (pm.kind === "palette_mismatch") {
    assertEquals(pm.offending_ids, ["p2"]);
  }
});

// ---------- combined ---------------------------------------------------

Deno.test("requirements-validation — a single card can trip budget_over, budget_currency_mismatch AND palette_mismatch simultaneously", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Walnut lounge chair", category: "chair", materials: "walnut", price_cents: 800_000, currency: "USD" }),
    makeItem({ id: "p2", title: "Marble console",     category: "console", materials: "marble",  price_cents: 800_000, currency: "EUR" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 1, qty_max: 1 }],
    budget_cents: 1_000_000, // 10k EUR — total is 16k
    budget_currency: "EUR",
    materials: ["oak", "brass"], // neither item matches
  };

  const v = validateRequirementsCoverage(req, gt);
  const kinds = violationKinds(v);
  assert(kinds.includes("budget_over"), `missing budget_over: ${kinds.join(",")}`);
  assert(kinds.includes("budget_currency_mismatch"), `missing budget_currency_mismatch: ${kinds.join(",")}`);
  assert(kinds.includes("palette_mismatch"), `missing palette_mismatch: ${kinds.join(",")}`);
  assertEquals(v.ok, false);
  assertEquals(v.budget_ok, false);
  assertEquals(v.palette_ok, false);
});

// ---------- disabled paths --------------------------------------------

Deno.test("requirements-validation — budget check is skipped entirely when budget_cents is 0 / missing", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Oak chair", category: "chair", price_cents: 999_999_99, currency: "EUR" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 1, qty_max: 1 }],
    // no budget_cents
  };

  const v = validateRequirementsCoverage(req, gt);
  assertEquals(v.budget, null);
  assertEquals(v.budget_ok, true);
  assertEquals(v.violations.filter((x) => x.kind === "budget_over").length, 0);
  assertEquals(v.violations.filter((x) => x.kind === "budget_currency_mismatch").length, 0);
});

Deno.test("requirements-validation — palette check is skipped when neither materials nor style is provided", () => {
  const gt = makeGT([
    makeItem({ id: "p1", title: "Walnut chair", category: "chair", materials: "walnut" }),
  ]);
  const req: RequirementsInput = {
    slots: [{ typology: "chair", qty_min: 1, qty_max: 1 }],
  };

  const v = validateRequirementsCoverage(req, gt);
  assertEquals(v.palette, null);
  assertEquals(v.palette_ok, true);
  assertEquals(v.violations.filter((x) => x.kind === "palette_mismatch").length, 0);
});
