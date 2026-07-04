import { assertEquals } from "https://deno.land/std@0.220.1/assert/mod.ts";
import {
  inferDimensionConstraints,
  parseDimensionsToMm,
  checkRowAgainstDimensionConstraints,
  filterRowsByDimensionConstraints,
} from "../_shared/dimensionConstraints.ts";

Deno.test("inferDimensionConstraints — 'under 240cm in length'", () => {
  const c = inferDimensionConstraints("A sofa under 240cm in length, upholstered in bouclé");
  assertEquals(c?.maxLengthMm, 2400);
});

Deno.test("inferDimensionConstraints — axis-first phrasing", () => {
  const c = inferDimensionConstraints("Coffee table with depth under 90 cm and height no more than 40cm");
  assertEquals(c?.maxDepthMm, 900);
  assertEquals(c?.maxHeightMm, 400);
});

Deno.test("inferDimensionConstraints — seat depth min", () => {
  const c = inferDimensionConstraints("Lounge chair with a minimum seat depth of 55cm");
  assertEquals(c?.minSeatDepthMm, 550);
});

Deno.test("inferDimensionConstraints — diameter shortcut", () => {
  const c = inferDimensionConstraints("Round dining table, max diameter 140 cm");
  assertEquals(c?.maxDiameterMm, 1400);
});

Deno.test("inferDimensionConstraints — inches", () => {
  const c = inferDimensionConstraints("Sideboard no wider than 60\" in length");
  assertEquals(c?.maxLengthMm, Math.round(60 * 25.4));
});

Deno.test("inferDimensionConstraints — no cues → null", () => {
  const c = inferDimensionConstraints("I want a warm mid-century lounge chair for a hotel lobby");
  assertEquals(c, null);
});

Deno.test("parseDimensionsToMm — labelled W×D×H", () => {
  const p = parseDimensionsToMm("W 140 x D 50 x H 100 cm");
  assertEquals(p.widthMm, 1400);
  assertEquals(p.depthMm, 500);
  assertEquals(p.heightMm, 1000);
});

Deno.test("parseDimensionsToMm — H75 × W80 × D85 no spaces", () => {
  const p = parseDimensionsToMm("H75 × W80 × D85 cm");
  assertEquals(p.heightMm, 750);
  assertEquals(p.widthMm, 800);
  assertEquals(p.depthMm, 850);
});

Deno.test("parseDimensionsToMm — Dia + H", () => {
  const p = parseDimensionsToMm("Dia 120 x H 25 cm");
  assertEquals(p.diameterMm, 1200);
  assertEquals(p.heightMm, 250);
});

Deno.test("parseDimensionsToMm — bare 'N × M cm'", () => {
  const p = parseDimensionsToMm("251 × 297 cm");
  assertEquals(p.lengthMm, 2510);
  assertEquals(p.widthMm, 2970);
});

Deno.test("parseDimensionsToMm — multi-line with production note", () => {
  const p = parseDimensionsToMm("W 146 × D 146 × H 100 cm – 80 kg\nProduction lead time: 16 weeks");
  assertEquals(p.widthMm, 1460);
  assertEquals(p.depthMm, 1460);
  assertEquals(p.heightMm, 1000);
});

Deno.test("checkRow — pass on max length 240cm vs W 140", () => {
  const v = checkRowAgainstDimensionConstraints("W 140 x D 50 x H 100 cm", { maxLengthMm: 2400 });
  assertEquals(v, "pass");
});

Deno.test("checkRow — fail on max length 240cm vs 297cm bare", () => {
  const v = checkRowAgainstDimensionConstraints("251 × 297 cm", { maxLengthMm: 2400 });
  assertEquals(v, "fail");
});

Deno.test("checkRow — unknown when no dimensions", () => {
  const v = checkRowAgainstDimensionConstraints(null, { maxLengthMm: 2400 });
  assertEquals(v, "unknown");
});

Deno.test("filterRows — drops violators and unknowns when >=2 survive", () => {
  const rows = [
    { id: "a", dimensions: "W 140 x D 50 x H 100 cm" },        // pass
    { id: "b", dimensions: "251 × 297 cm" },                    // fail (length)
    { id: "c", dimensions: null },                              // unknown
    { id: "d", dimensions: "W 200 x D 90 x H 75 cm" },          // pass
  ];
  const res = filterRowsByDimensionConstraints(rows, { maxLengthMm: 2400 });
  assertEquals(res.kept.map((r) => r.id), ["a", "d"]);
  assertEquals(res.dropped, 1);
  assertEquals(res.unknownDropped, 1);
  assertEquals(res.fellBack, false);
});

Deno.test("filterRows — safety valve keeps unknowns when strict < 2", () => {
  const rows = [
    { id: "a", dimensions: "251 × 297 cm" }, // fail
    { id: "b", dimensions: null },           // unknown
    { id: "c", dimensions: null },           // unknown
  ];
  const res = filterRowsByDimensionConstraints(rows, { maxLengthMm: 2400 });
  assertEquals(res.kept.map((r) => r.id), ["b", "c"]);
  assertEquals(res.fellBack, true);
});
