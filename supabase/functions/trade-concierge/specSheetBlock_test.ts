import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSpecSheetRows, renderSpecSheetBlock, shortSku } from "../_shared/specSheetBlock.ts";

Deno.test("shortSku produces a stable MA-prefixed 8-char SKU", () => {
  assertEquals(shortSku("aabbccdd-eeff-0011-2233-445566778899"), "MA-AABBCCDD");
  assertEquals(shortSku(""), "—");
});

Deno.test("buildSpecSheetRows normalizes missing fields to em dashes", () => {
  const rows = buildSpecSheetRows([
    { id: "id-1", title: "Console", designer_name: "Alexander Lamont", dimensions: "W180 D40 H80 cm", materials: "Bronze, shagreen", lead_time: "12–14 weeks" },
    { id: "id-2", title: "Chair", designer_name: null, dimensions: null, materials: null, lead_time: null, stock_status: "In stock" },
  ]);
  assertEquals(rows.length, 2);
  assertEquals(rows[0].sku, "MA-ID1");
  assertEquals(rows[0].designer, "Alexander Lamont");
  assertEquals(rows[1].designer, "—");
  assertEquals(rows[1].lead_time, "In stock");
});

Deno.test("renderSpecSheetBlock returns empty for <2 pieces (single-piece recs skip the block)", () => {
  assertEquals(renderSpecSheetBlock([{ id: "x", title: "Chair" }]), "");
});

Deno.test("renderSpecSheetBlock lists every required field per piece", () => {
  const out = renderSpecSheetBlock([
    { id: "aabbccdd-eeff-0011-2233-445566778899", title: "Console", designer_name: "Alexander Lamont", dimensions: "W180", materials: "Bronze", lead_time: "12 weeks" },
    { id: "11223344-5566-7788-99aa-bbccddeeff00", title: "Chair", brand_name: "Apparatus", dimensions: "H80", materials: "Oak", lead_time: "In stock" },
  ]);
  assert(out.startsWith("Spec sheet:"));
  assert(out.includes("Console — Alexander Lamont [MA-AABBCCDD]"));
  assert(out.includes("Chair — Apparatus [MA-11223344]"));
  assert(out.includes("Dimensions: W180"));
  assert(out.includes("Materials: Bronze"));
  assert(out.includes("Lead time: 12 weeks"));
});
