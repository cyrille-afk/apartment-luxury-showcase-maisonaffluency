// Deno unit tests for the concierge variant/finish guardrail.
// Run: `deno test supabase/functions/_shared/variantFidelity_test.ts`

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectAllowedVariants,
  reconcileVariants,
  validateVariant,
} from "./variantFidelity.ts";

// Fixture 1 — Barth stool: dual-axis size_variants + variant_image_map.
const BARTH = collectAllowedVariants({
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
  fabrics: null,
});

// Fixture 2 — Ponza Bench: single label, no top/base finish choices.
const PONZA = collectAllowedVariants({
  size_variants: [{ base: "COM Fabric", top: "", label: "W 140 x D 37 x H 42 cm", price_cents: 0 }],
  variant_image_map: {},
  fabrics: null,
});

// Fixture 3 — pick with product_fabrics only (upholstery library).
const FABRIC_PIECE = collectAllowedVariants({
  size_variants: null,
  variant_image_map: null,
  fabrics: [
    { name: "Kyknos", product_label: null },
    { name: "Travertino Silver", product_label: null },
    { name: "Nero Marquina", product_label: null },
  ],
});

// Fixture 4 — pick with NO finish/variant data at all.
const NO_CHOICES = collectAllowedVariants({ size_variants: null, variant_image_map: null, fabrics: null });

Deno.test("collectAllowedVariants — Barth captures every top + the wood base", () => {
  assertEquals(BARTH.hasChoices, true);
  const flat = BARTH.labels.join(" | ").toLowerCase();
  for (const t of ["new pink", "ivory", "khaki", "solid lime wood"]) {
    assertEquals(flat.includes(t), true, `expected "${t}" in labels`);
  }
});

Deno.test("validateVariant — attested combo accepted", () => {
  const r = validateVariant("Solid Lime Wood & Glossy Lacquer — Ivory", BARTH);
  assertEquals(r.valid, true);
});

Deno.test("validateVariant — single attested top accepted", () => {
  assertEquals(validateVariant("Khaki", BARTH).valid, true);
});

Deno.test("validateVariant — hallucinated top rejected with unknown token", () => {
  const r = validateVariant("Solid Lime Wood — Aubergine Velvet", BARTH);
  // "aubergine" is not in Barth's actual tops (New Pink, Ivory, Khaki here).
  assertEquals(r.valid, false);
  assertEquals(r.reason, "unknown_token");
  assertEquals(r.unknownTokens?.includes("aubergine"), true);
});

Deno.test("validateVariant — completely fabricated finish rejected", () => {
  const r = validateVariant("Carrara marble top on polished brass base", BARTH);
  assertEquals(r.valid, false);
  assertEquals(r.reason, "unknown_token");
});

Deno.test("validateVariant — Ponza (no finish choices) rejects any finish string", () => {
  const r = validateVariant("Cognac leather", PONZA);
  // Ponza has a size label but no finish/top — the candidate mentions "cognac"
  // and "leather", neither attested. Expect unknown_token.
  assertEquals(r.valid, false);
});

Deno.test("validateVariant — Ponza accepts its own size label", () => {
  assertEquals(validateVariant("W 140 x D 37 x H 42 cm", PONZA).valid, true);
});

Deno.test("validateVariant — pick with no choices at all rejects any variant", () => {
  const r = validateVariant("Bronze", NO_CHOICES);
  assertEquals(r.valid, false);
  assertEquals(r.reason, "no_choices_offered");
});

Deno.test("validateVariant — pick with no choices AND empty variant is fine", () => {
  assertEquals(validateVariant("", NO_CHOICES).valid, true);
  assertEquals(validateVariant(null, NO_CHOICES).valid, true);
});

Deno.test("validateVariant — fabric name from product_fabrics accepted", () => {
  assertEquals(validateVariant("Kyknos", FABRIC_PIECE).valid, true);
  assertEquals(validateVariant("Nero Marquina", FABRIC_PIECE).valid, true);
});

Deno.test("validateVariant — fabric not linked to this product rejected", () => {
  const r = validateVariant("Calacatta Viola", FABRIC_PIECE);
  assertEquals(r.valid, false);
  assertEquals(r.reason, "unknown_token");
});

Deno.test("reconcileVariants — mixed batch: bad line has variant scrubbed + repair note", () => {
  const map = new Map([
    ["barth", BARTH],
    ["ponza", PONZA],
  ]);
  const { lines, repairs } = reconcileVariants(
    [
      { pick_id: "barth", qty: 1, variant: "Ivory" },
      { pick_id: "barth", qty: 1, variant: "Neon lime lacquer" },
      { pick_id: "ponza", qty: 2, variant: null },
      { pick_id: "unknown-pick", qty: 1, variant: "anything" }, // no allowed entry → pass-through
    ],
    map,
  );
  assertEquals(lines[0].variant, "Ivory");
  assertEquals(lines[1].variant, null);
  assertEquals(typeof (lines[1] as any).variant_repair, "string");
  assertEquals(lines[2].variant, null);
  assertEquals(lines[3].variant, "anything");
  assertEquals(repairs.length, 1);
  assertEquals(repairs[0].pick_id, "barth");
});
