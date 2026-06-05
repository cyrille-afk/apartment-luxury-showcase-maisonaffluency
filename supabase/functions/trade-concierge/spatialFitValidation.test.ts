import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  coerceClearance,
  classifyResultFailure,
  countDimensionNumbers,
} from "../_shared/spatialFitValidation.ts";

// ---- coerceClearance ----

Deno.test("coerceClearance: bare numbers are mm", () => {
  assertStrictEquals(coerceClearance(600), 600);
  assertStrictEquals(coerceClearance("600"), 600);
  assertStrictEquals(coerceClearance("0"), 0);
});

Deno.test("coerceClearance: cm/m/in/ft unit conversion", () => {
  assertStrictEquals(coerceClearance("50cm"), 500);
  assertStrictEquals(coerceClearance("50 cm"), 500);
  assertStrictEquals(coerceClearance("0.6m"), 600);
  assertStrictEquals(coerceClearance("2in"), 51);
  assertStrictEquals(coerceClearance('24"'), 610);
  assertStrictEquals(coerceClearance("2'"), 610);
});

Deno.test("coerceClearance: rejects garbage and empties", () => {
  assertStrictEquals(coerceClearance(""), null);
  assertStrictEquals(coerceClearance(null), null);
  assertStrictEquals(coerceClearance(undefined), null);
  assertStrictEquals(coerceClearance("plenty of space"), null);
  assertStrictEquals(coerceClearance("50xx"), null);
  assertStrictEquals(coerceClearance(NaN), null);
});

// ---- countDimensionNumbers ----

Deno.test("countDimensionNumbers: typical formats", () => {
  assertStrictEquals(countDimensionNumbers("W120 × D80 × H75 cm"), 3);
  assertStrictEquals(countDimensionNumbers("120 x 80"), 2);
  assertStrictEquals(countDimensionNumbers("Ø42"), 1);
  assertStrictEquals(countDimensionNumbers(""), 0);
  assertStrictEquals(countDimensionNumbers(null), 0);
});

// ---- classifyResultFailure ----

Deno.test("classifyResultFailure: success returns null", () => {
  assertStrictEquals(
    classifyResultFailure({ preflightCode: null, transportError: null, verdict: "fits", ok: true }),
    null,
  );
});

Deno.test("classifyResultFailure: preflight wins over transport", () => {
  assertEquals(
    classifyResultFailure({ preflightCode: "missing_dimensions", transportError: "HTTP 500", verdict: null, ok: false }),
    "missing_dimensions",
  );
});

Deno.test("classifyResultFailure: transport error → service_unreachable", () => {
  assertEquals(
    classifyResultFailure({ preflightCode: null, transportError: "HTTP 502", verdict: null, ok: false }),
    "service_unreachable",
  );
});

Deno.test("classifyResultFailure: missing verdict → no_verdict", () => {
  assertEquals(
    classifyResultFailure({ preflightCode: null, transportError: null, verdict: null, ok: true }),
    "no_verdict",
  );
});

Deno.test("classifyResultFailure: ok:false with verdict but no cause → other", () => {
  assertEquals(
    classifyResultFailure({ preflightCode: null, transportError: null, verdict: "fits", ok: false }),
    "other",
  );
});
