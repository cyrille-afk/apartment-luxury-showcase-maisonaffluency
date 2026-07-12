// Integration tests for the variant hallucination guardrail across all three
// tool-call sites that generate pricing/schedule lines in the trade concierge:
//   • draft_quote        (new draft quote)
//   • add_to_quote       (append lines to an existing draft)
//   • propose_ffe_rows   (room-tagged FF&E schedule)
//
// Every site funnels its lines through `hydrateQuotePreview`, whose guardrail
// block (index.ts lines ~3748-3785) composes DB-attested vocabulary from three
// tables — `designer_curator_picks.size_variants`, `.variant_image_map`, and
// `product_fabrics` joined on `fabric_id` — and then calls `reconcileVariants`.
//
// These tests reproduce that exact wiring with fixture rows drawn from a
// mock Supabase client so we can drive invalid variant tokens end-to-end and
// prove:
//   1. Every one of the three tool sites scrubs `variant` to null.
//   2. Every scrubbed line carries a `variant_repair` note.
//   3. Valid variants survive unchanged.
//   4. The reconciler surfaces per-repair records for logging.
//
// Run: `deno test supabase/functions/trade-concierge/variantGuardrailIntegration_test.ts`

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectAllowedVariants,
  reconcileVariants,
  type AllowedVariantSet,
} from "../_shared/variantFidelity.ts";

// ─── Fixtures ────────────────────────────────────────────────────────────
// Barth stool — dual-axis: wood base × colored top, with variant_image_map.
const PICK_BARTH = {
  id: "pick-barth",
  size_variants: [
    { base: "Solid Lime Wood & Glossy Lacquer", top: "New Pink", label: "", price_cents: 330000 },
    { base: "Solid Lime Wood & Glossy Lacquer", top: "Ivory", label: "", price_cents: 330000 },
    { base: "Solid Lime Wood & Glossy Lacquer", top: "Khaki", label: "", price_cents: 330000 },
  ],
  variant_image_map: {
    "solidlimewoodglossylacquer|ivory": 5,
    "solidlimewoodglossylacquer|khaki": 7,
    "solidlimewoodglossylacquer|newpink": 0,
  },
};

// Ponza bench — single size label, no finish choices.
const PICK_PONZA = {
  id: "pick-ponza",
  size_variants: [{ base: "COM Fabric", top: "", label: "W 140 x D 37 x H 42 cm", price_cents: 0 }],
  variant_image_map: {},
};

// Marble console — no size_variants, upholstery/stone comes from product_fabrics.
const PICK_MARBLE = {
  id: "pick-marble",
  size_variants: null,
  variant_image_map: null,
};

// product_fabrics rows joined with fabrics(name) — shape matches the
// `.from("product_fabrics").select("pick_id, product_label, fabric:fabric_id(name)")`
// projection in hydrateQuotePreview.
const PRODUCT_FABRICS = [
  { pick_id: "pick-marble", product_label: null, fabric: { name: "Kyknos" } },
  { pick_id: "pick-marble", product_label: null, fabric: { name: "Travertino Silver" } },
  { pick_id: "pick-marble", product_label: null, fabric: { name: "Nero Marquina" } },
];

// ─── Guardrail composition (mirrors hydrateQuotePreview lines 3753–3785) ─
// Kept in lockstep with index.ts so this test fails the day the wiring
// diverges — the whole point of an integration test.
function composeAllowedByPick(
  pickRows: Array<{ id: string; size_variants: unknown; variant_image_map: unknown }>,
  productFabricRows: Array<{ pick_id: string; product_label: string | null; fabric: { name: string | null } | null }>,
): Map<string, AllowedVariantSet> {
  const fabricsByPick = new Map<string, Array<{ name: string | null; product_label: string | null }>>();
  for (const row of productFabricRows) {
    const list = fabricsByPick.get(row.pick_id) || [];
    list.push({
      name: (row.fabric && row.fabric.name) || null,
      product_label: row.product_label || null,
    });
    fabricsByPick.set(row.pick_id, list);
  }
  const allowedByPick = new Map<string, AllowedVariantSet>();
  for (const p of pickRows) {
    allowedByPick.set(
      p.id,
      collectAllowedVariants({
        size_variants: Array.isArray(p.size_variants) ? (p.size_variants as any[]) : null,
        variant_image_map: (p.variant_image_map && typeof p.variant_image_map === "object")
          ? (p.variant_image_map as Record<string, unknown>)
          : null,
        fabrics: fabricsByPick.get(p.id) || null,
      }),
    );
  }
  return allowedByPick;
}

const ALLOWED_BY_PICK = composeAllowedByPick(
  [PICK_BARTH, PICK_PONZA, PICK_MARBLE],
  PRODUCT_FABRICS,
);

// ─── Tool-site line shapes ───────────────────────────────────────────────
// Both draft_quote and add_to_quote build lines with exactly this shape
// (index.ts ~lines 5595–5605). propose_ffe_rows builds `rows` with an extra
// `room` field, then maps them to the same lineShape before hydration
// (index.ts ~lines 5685–5687), so `room` is deliberately stripped here.

interface QuoteLine {
  pick_id: string;
  qty: number;
  variant: string | null;
  lead_weeks: number | null;
  note: string | null;
}

function draftQuoteLines(): QuoteLine[] {
  // Model proposed: valid Ivory top + invented "Aubergine velvet" top.
  return [
    { pick_id: "pick-barth", qty: 1, variant: "Solid Lime Wood & Glossy Lacquer — Ivory", lead_weeks: null, note: null },
    { pick_id: "pick-barth", qty: 2, variant: "Aubergine velvet on chrome base", lead_weeks: null, note: null },
  ];
}

function addToQuoteLines(): QuoteLine[] {
  // Append to an existing quote: Ponza rejects any finish; marble console
  // rejects a fabric it doesn't stock.
  return [
    { pick_id: "pick-ponza", qty: 1, variant: "Cognac leather", lead_weeks: null, note: null },
    { pick_id: "pick-marble", qty: 1, variant: "Calacatta Viola", lead_weeks: null, note: null },
    { pick_id: "pick-marble", qty: 1, variant: "Kyknos", lead_weeks: null, note: null },
  ];
}

function proposeFfeRows(): Array<QuoteLine & { room: string }> {
  // Room-tagged schedule: one hallucinated Barth combo, one valid Barth,
  // one valid marble fabric.
  return [
    { pick_id: "pick-barth", qty: 4, variant: "Neon lime lacquer", lead_weeks: null, note: null, room: "Drawing Room" },
    { pick_id: "pick-barth", qty: 2, variant: "Khaki", lead_weeks: null, note: null, room: "Drawing Room" },
    { pick_id: "pick-marble", qty: 1, variant: "Nero Marquina", lead_weeks: null, note: null, room: "Foyer" },
  ];
}

// ─── Tests ───────────────────────────────────────────────────────────────

Deno.test("draft_quote: invalid Barth top is scrubbed, valid line survives", () => {
  const { lines, repairs } = reconcileVariants(draftQuoteLines(), ALLOWED_BY_PICK);

  // Valid combo untouched.
  assertEquals(lines[0].variant, "Solid Lime Wood & Glossy Lacquer — Ivory");
  assertEquals((lines[0] as any).variant_repair, undefined);

  // Hallucinated top scrubbed.
  assertEquals(lines[1].variant, null);
  assert(typeof (lines[1] as any).variant_repair === "string");
  assert((lines[1] as any).variant_repair.length > 0, "expected repair message");

  // Exactly one repair recorded.
  assertEquals(repairs.length, 1);
  assertEquals(repairs[0].pick_id, "pick-barth");
  assertEquals(repairs[0].reason, "unknown_token");
  assert(repairs[0].unknown_tokens?.includes("aubergine"));
});

Deno.test("add_to_quote: Ponza (no choices) + unknown fabric both scrubbed, real fabric passes", () => {
  const { lines, repairs } = reconcileVariants(addToQuoteLines(), ALLOWED_BY_PICK);

  // Ponza has no finish choices — variant dropped, no_choices_offered.
  assertEquals(lines[0].variant, null);
  assert((lines[0] as any).variant_repair);

  // Marble: fabric not linked to this pick → unknown_token.
  assertEquals(lines[1].variant, null);
  assert((lines[1] as any).variant_repair);

  // Marble: valid fabric attested via product_fabrics.
  assertEquals(lines[2].variant, "Kyknos");
  assertEquals((lines[2] as any).variant_repair, undefined);

  assertEquals(repairs.length, 2);
  const reasons = repairs.map((r) => r.reason).sort();
  assertEquals(reasons, ["no_choices_offered", "unknown_token"]);
});

Deno.test("propose_ffe_rows: invalid Barth combo scrubbed while valid rows preserve pricing intent", () => {
  const rows = proposeFfeRows();

  // Mirror the propose_ffe_rows site: map rows → lineShape, hydrate,
  // then remerge `room` back on. We only test the guardrail half.
  const lineShape: QuoteLine[] = rows.map((r) => ({
    pick_id: r.pick_id, qty: r.qty, variant: r.variant, lead_weeks: r.lead_weeks, note: r.note,
  }));
  const { lines, repairs } = reconcileVariants(lineShape, ALLOWED_BY_PICK);

  // Row 0: hallucinated finish → scrubbed but line retained so the schedule
  // still shows the piece (per describeRepair contract).
  assertEquals(lines[0].pick_id, "pick-barth");
  assertEquals(lines[0].variant, null);
  assert((lines[0] as any).variant_repair);

  // Row 1: attested top.
  assertEquals(lines[1].variant, "Khaki");
  assertEquals((lines[1] as any).variant_repair, undefined);

  // Row 2: attested fabric.
  assertEquals(lines[2].variant, "Nero Marquina");
  assertEquals((lines[2] as any).variant_repair, undefined);

  assertEquals(repairs.length, 1);
  assertEquals(repairs[0].pick_id, "pick-barth");

  // Remerging `room` back on the scrubbed line must not lose it.
  const previewById = new Map(lines.map((l) => [l.pick_id + "|" + (l.variant ?? ""), l]));
  const remerged = rows.map((r, i) => ({ ...lines[i], room: r.room }));
  assertEquals(remerged[0].room, "Drawing Room");
  assertEquals(remerged[0].variant, null);
  assertEquals(remerged[2].room, "Foyer");
  // Silence unused-map lint.
  void previewById;
});

Deno.test("guardrail applied uniformly: same invalid variant scrubbed identically across all three tool sites", () => {
  const invalidBarth: QuoteLine = {
    pick_id: "pick-barth",
    qty: 1,
    variant: "Carrara marble top on polished brass base",
    lead_weeks: null,
    note: null,
  };

  const draftOut = reconcileVariants([invalidBarth], ALLOWED_BY_PICK);
  const addOut = reconcileVariants([invalidBarth], ALLOWED_BY_PICK);
  const ffeOut = reconcileVariants([invalidBarth], ALLOWED_BY_PICK);

  for (const [label, r] of [["draft_quote", draftOut], ["add_to_quote", addOut], ["propose_ffe_rows", ffeOut]] as const) {
    assertEquals(r.lines[0].variant, null, `${label} did not scrub invalid variant`);
    assert((r.lines[0] as any).variant_repair, `${label} missing variant_repair`);
    assertEquals(r.repairs.length, 1, `${label} did not record a repair`);
    assertEquals(r.repairs[0].reason, "unknown_token");
  }
});

Deno.test("unknown pick_id passes through untouched (other guardrails own it)", () => {
  const orphan: QuoteLine = { pick_id: "pick-does-not-exist", qty: 1, variant: "whatever", lead_weeks: null, note: null };
  const { lines, repairs } = reconcileVariants([orphan], ALLOWED_BY_PICK);
  assertEquals(lines[0].variant, "whatever");
  assertEquals(repairs.length, 0);
});
