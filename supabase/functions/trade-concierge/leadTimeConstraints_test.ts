import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  inferLeadTimeConstraints,
  parseLeadTimeWeeks,
  resolveRowLeadTime,
  filterRowsByLeadTimeConstraints,
  buildBrandLeadTimeIndex,
} from "../_shared/leadTimeConstraints.ts";

Deno.test("inferLeadTimeConstraints: 'under 8 weeks' -> maxWeeks=8", () => {
  const c = inferLeadTimeConstraints("I need a sofa delivered under 8 weeks");
  assertEquals(c?.maxWeeks, 8);
});

Deno.test("inferLeadTimeConstraints: 'within 6 weeks' -> maxWeeks=6", () => {
  assertEquals(inferLeadTimeConstraints("ship within 6 weeks")?.maxWeeks, 6);
});

Deno.test("inferLeadTimeConstraints: 'no more than 3 months' -> maxWeeks=12", () => {
  assertEquals(inferLeadTimeConstraints("lead time no more than 3 months")?.maxWeeks, 12);
});

Deno.test("inferLeadTimeConstraints: 'in stock only' -> inStockOnly + maxWeeks=0", () => {
  const c = inferLeadTimeConstraints("in stock only please");
  assertEquals(c?.inStockOnly, true);
  assertEquals(c?.maxWeeks, 0);
});

Deno.test("inferLeadTimeConstraints: '10 weeks or less' -> maxWeeks=10", () => {
  assertEquals(inferLeadTimeConstraints("10 weeks or less")?.maxWeeks, 10);
});

Deno.test("inferLeadTimeConstraints: 'at least 12 weeks' -> minWeeks=12", () => {
  assertEquals(inferLeadTimeConstraints("at least 12 weeks lead time")?.minWeeks, 12);
});

Deno.test("inferLeadTimeConstraints: multiple ceilings pick the tightest", () => {
  assertEquals(inferLeadTimeConstraints("under 12 weeks, ideally within 6 weeks")?.maxWeeks, 6);
});

Deno.test("inferLeadTimeConstraints: no time cue -> null", () => {
  assertEquals(inferLeadTimeConstraints("a walnut dining table for eight"), null);
});

Deno.test("parseLeadTimeWeeks: '8-10 weeks' -> 8..10", () => {
  assertEquals(parseLeadTimeWeeks("8-10 weeks"), { minWeeks: 8, maxWeeks: 10, isInStock: false });
});

Deno.test("parseLeadTimeWeeks: '3 months' -> 12..12", () => {
  assertEquals(parseLeadTimeWeeks("3 months"), { minWeeks: 12, maxWeeks: 12, isInStock: false });
});

Deno.test("parseLeadTimeWeeks: 'In stock' -> 0..0 inStock", () => {
  assertEquals(parseLeadTimeWeeks("In stock"), { minWeeks: 0, maxWeeks: 0, isInStock: true });
});

Deno.test("resolveRowLeadTime: uses direct field", () => {
  const r = { lead_time: "6 weeks" };
  assertEquals(resolveRowLeadTime(r)?.maxWeeks, 6);
});

Deno.test("resolveRowLeadTime: falls back to stock_status", () => {
  const r = { lead_time: null, stock_status: "In Stock" };
  assertEquals(resolveRowLeadTime(r)?.isInStock, true);
});

Deno.test("resolveRowLeadTime: falls back to brand index", () => {
  const idx = buildBrandLeadTimeIndex([
    { brand_name: "Acme Studio", default_lead_weeks_min: 4, default_lead_weeks_max: 6, default_stock_status: "made_to_order" },
  ]);
  const r = { lead_time: null, brand_name: "Acme Studio" };
  const p = resolveRowLeadTime(r, idx);
  assertEquals(p?.minWeeks, 4);
  assertEquals(p?.maxWeeks, 6);
});

Deno.test("filter: 'under 8 weeks' drops 12-week piece", () => {
  const rows = [
    { id: "a", lead_time: "6 weeks" },
    { id: "b", lead_time: "12 weeks" },
    { id: "c", lead_time: "in stock" },
  ];
  const res = filterRowsByLeadTimeConstraints(rows, { maxWeeks: 8 });
  assertEquals(res.kept.map((r) => r.id).sort(), ["a", "c"]);
});

Deno.test("filter: inStockOnly keeps only stock", () => {
  const rows = [
    { id: "a", lead_time: "6 weeks" },
    { id: "b", stock_status: "in stock" },
  ];
  const res = filterRowsByLeadTimeConstraints(rows, { inStockOnly: true, maxWeeks: 0 });
  assertEquals(res.kept.map((r) => r.id), ["b"]);
});

Deno.test("filter: unknown-lead-time rows drop when no brand fallback", () => {
  const rows = [
    { id: "a", lead_time: "6 weeks" },
    { id: "b" }, // unknown
    { id: "c", lead_time: "5 weeks" },
  ];
  const res = filterRowsByLeadTimeConstraints(rows, { maxWeeks: 8 });
  assertEquals(res.unknownDropped, 1);
  assertEquals(res.kept.map((r) => r.id).sort(), ["a", "c"]);
});

Deno.test("filter: safety valve marks fellBack when <2 survive", () => {
  const rows = [
    { id: "a", lead_time: "20 weeks" },
    { id: "b", lead_time: "18 weeks" },
  ];
  const res = filterRowsByLeadTimeConstraints(rows, { maxWeeks: 6 });
  assertEquals(res.kept.length, 0);
  assert(res.fellBack);
});

// ----- Range parsing -----

Deno.test("range: '4-6 weeks' -> min=4, max=6", () => {
  const c = inferLeadTimeConstraints("we need it in 4-6 weeks");
  assertEquals(c?.minWeeks, 4);
  assertEquals(c?.maxWeeks, 6);
});

Deno.test("range: 'between 8 and 10 weeks' -> min=8, max=10", () => {
  const c = inferLeadTimeConstraints("deliver between 8 and 10 weeks");
  assertEquals(c?.minWeeks, 8);
  assertEquals(c?.maxWeeks, 10);
});

Deno.test("range: '4 to 6 weeks' -> min=4, max=6", () => {
  const c = inferLeadTimeConstraints("ships in 4 to 6 weeks");
  assertEquals(c?.minWeeks, 4);
  assertEquals(c?.maxWeeks, 6);
});

Deno.test("range: en-dash '4–6 weeks' -> min=4, max=6", () => {
  const c = inferLeadTimeConstraints("lead time 4–6 weeks please");
  assertEquals(c?.minWeeks, 4);
  assertEquals(c?.maxWeeks, 6);
});

Deno.test("range: '2 to 3 months' -> min=8, max=12 (weeks)", () => {
  const c = inferLeadTimeConstraints("between 2 and 3 months");
  assertEquals(c?.minWeeks, 8);
  assertEquals(c?.maxWeeks, 12);
});

Deno.test("range + separate ceiling: keeps tightest", () => {
  const c = inferLeadTimeConstraints("4-8 weeks, but ideally under 6 weeks");
  assertEquals(c?.maxWeeks, 6);
  assertEquals(c?.minWeeks, 4);
});

// ----- Strict range enforcement against brand_lead_times -----

Deno.test("filter strict: brand range 8-12 fails a '≤ 10 weeks' ceiling", () => {
  const idx = buildBrandLeadTimeIndex([
    { brand_name: "Late Atelier", default_lead_weeks_min: 8, default_lead_weeks_max: 12, default_stock_status: "made_to_order" },
    { brand_name: "Fast Atelier", default_lead_weeks_min: 4, default_lead_weeks_max: 6, default_stock_status: "made_to_order" },
  ]);
  const rows = [
    { id: "late", brand_name: "Late Atelier" },
    { id: "fast", brand_name: "Fast Atelier" },
  ];
  const res = filterRowsByLeadTimeConstraints(rows, { maxWeeks: 10 }, idx);
  assertEquals(res.kept.map((r) => r.id), ["fast"]);
});

Deno.test("filter strict: row '8-10 weeks' fails a '≤ 8 weeks' ceiling", () => {
  const rows = [
    { id: "a", lead_time: "6 weeks" },
    { id: "b", lead_time: "8-10 weeks" },
  ];
  const res = filterRowsByLeadTimeConstraints(rows, { maxWeeks: 8 });
  assertEquals(res.kept.map((r) => r.id), ["a"]);
});

Deno.test("filter strict: user range 4-6 enforces both bounds", () => {
  const rows = [
    { id: "tooEarly", lead_time: "in stock" },   // 0..0 → 0 < 4 → drop
    { id: "fits",     lead_time: "5 weeks" },     // 5..5 → pass
    { id: "tooLate",  lead_time: "8 weeks" },     // 8 > 6 → drop
  ];
  const res = filterRowsByLeadTimeConstraints(rows, { minWeeks: 4, maxWeeks: 6 });
  assertEquals(res.kept.map((r) => r.id), ["fits"]);
});
