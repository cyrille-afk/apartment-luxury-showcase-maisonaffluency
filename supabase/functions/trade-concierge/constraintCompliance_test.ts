import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildConstraintCompliance, renderComplianceNote } from "../_shared/constraintCompliance.ts";

const pieces = [
  { id: "a", title: "Oak Bench", dimensions: "W 200 x D 45 x H 45 cm", lead_time: "6 weeks", price_cents: 400000, currency: "EUR" },
  { id: "b", title: "Long Console", dimensions: "W 260 x D 40 x H 80 cm", lead_time: "14 weeks", price_cents: 800000, currency: "EUR" },
  { id: "c", title: "Mystery Piece", dimensions: null, lead_time: null, price_cents: null, currency: null },
];

Deno.test("compliance: max length ≤ 240cm — a=pass, b=fail, c=unknown", () => {
  const rows = buildConstraintCompliance({
    dim: { maxLengthMm: 2400 },
    pieces,
  });
  assertEquals(rows.length, 1);
  const r = rows[0];
  assertEquals(r.key, "maxLengthMm");
  assertEquals(r.target, "≤ 240 cm");
  assertEquals(r.pieces.find((p) => p.pick_id === "a")?.status, "pass");
  assertEquals(r.pieces.find((p) => p.pick_id === "b")?.status, "fail");
  assertEquals(r.pieces.find((p) => p.pick_id === "c")?.status, "unknown");
  assertEquals(r.passCount, 1);
  assertEquals(r.failCount, 1);
  assertEquals(r.unknownCount, 1);
});

Deno.test("compliance: max lead ≤ 8 weeks — a=pass, b=fail, c=unknown", () => {
  const rows = buildConstraintCompliance({
    lead: { maxWeeks: 8 },
    pieces,
  });
  const r = rows.find((x) => x.key === "maxLeadWeeks")!;
  assertEquals(r.target, "≤ 8 wks");
  assertEquals(r.pieces.find((p) => p.pick_id === "a")?.status, "pass");
  assertEquals(r.pieces.find((p) => p.pick_id === "b")?.status, "fail");
  assertEquals(r.pieces.find((p) => p.pick_id === "c")?.status, "unknown");
});

Deno.test("compliance: budget ceiling", () => {
  const rows = buildConstraintCompliance({
    budgetCents: 500000,
    budgetCurrency: "EUR",
    pieces,
  });
  const r = rows.find((x) => x.key === "maxUnitBudget")!;
  assertEquals(r.pieces.find((p) => p.pick_id === "a")?.status, "pass");
  assertEquals(r.pieces.find((p) => p.pick_id === "b")?.status, "fail");
  assertEquals(r.pieces.find((p) => p.pick_id === "c")?.status, "unknown");
});

Deno.test("compliance: renderComplianceNote lists fails", () => {
  const rows = buildConstraintCompliance({
    dim: { maxLengthMm: 2400 },
    lead: { maxWeeks: 8 },
    pieces,
  });
  const note = renderComplianceNote(rows);
  assert(note.includes("Constraint compliance:"));
  assert(note.includes("Max length"));
  assert(note.includes("Max lead time"));
  assert(note.includes("Long Console"));
});

Deno.test("compliance: no constraints -> empty", () => {
  assertEquals(buildConstraintCompliance({ pieces }).length, 0);
  assertEquals(renderComplianceNote([]), "");
});

Deno.test("compliance: seat depth min", () => {
  const seat = [
    { id: "s1", title: "Deep Lounge", dimensions: "W 90 x SD 55 x H 75 cm" },
    { id: "s2", title: "Shallow Chair", dimensions: "W 60 x SD 40 x H 80 cm" },
  ];
  const rows = buildConstraintCompliance({
    dim: { minSeatDepthMm: 500 },
    pieces: seat,
  });
  const r = rows[0];
  assertEquals(r.label, "Min seat depth");
  assertEquals(r.target, "≥ 50 cm");
  assertEquals(r.pieces.find((p) => p.pick_id === "s1")?.status, "pass");
  assertEquals(r.pieces.find((p) => p.pick_id === "s2")?.status, "fail");
});
