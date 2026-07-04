// Unit tests for reconcileMaterialsWithSource — the material-fidelity
// validator that repairs the planner's extracted `materials` array when it
// silently narrows the user's intent (crystal ↔ glass swap, dropped
// qualifiers like "burl walnut" / "Nero Marquina", missed alternatives).
//
// Runs under Deno test — `deno test supabase/functions/trade-concierge/materialFidelity_test.ts`.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { reconcileMaterialsWithSource } from "./index.ts";

Deno.test("crystal parity — user said 'glass or crystal', planner dropped crystal", () => {
  const raw = "A show-stopping chandelier in glass or crystal for the dining room.";
  const { materials, repair } = reconcileMaterialsWithSource(["glass"], raw);
  assertEquals(materials.includes("glass"), true);
  assertEquals(materials.includes("crystal"), true);
  assertEquals(repair.added.includes("crystal"), true);
});

Deno.test("crystal parity — user said only 'crystal', planner substituted 'glass'", () => {
  const raw = "I want a crystal chandelier.";
  const { materials, repair } = reconcileMaterialsWithSource(["glass"], raw);
  assertEquals(materials.includes("crystal"), true);
  assertEquals(repair.added.includes("crystal"), true);
});

Deno.test("qualifier restoration — 'burl walnut' → planner kept only 'walnut'", () => {
  const raw = "A credenza in burl walnut, please.";
  const { materials, repair } = reconcileMaterialsWithSource(["walnut"], raw);
  assertEquals(materials.includes("burl walnut"), true);
  assertEquals(materials.includes("walnut"), false);
  assertEquals(repair.replaced.some(([b, c]) => b === "walnut" && c === "burl walnut"), true);
});

Deno.test("qualifier restoration — 'Nero Marquina marble' → planner kept only 'marble'", () => {
  const raw = "The dining table should be in Nero Marquina marble.";
  const { materials, repair } = reconcileMaterialsWithSource(["marble"], raw);
  assertEquals(materials.includes("nero marquina"), true);
  assertEquals(materials.includes("marble"), false);
  assertEquals(repair.replaced.some(([b, c]) => b === "marble" && c === "nero marquina"), true);
});

Deno.test("missed alternatives — 'onyx, alabaster or rock crystal' → planner kept only onyx", () => {
  const raw = "Something in onyx, alabaster or rock crystal.";
  const { materials, repair } = reconcileMaterialsWithSource(["onyx"], raw);
  assertEquals(materials.includes("onyx"), true);
  assertEquals(materials.includes("alabaster"), true);
  assertEquals(materials.includes("rock crystal"), true);
  // rock crystal covers the "crystal" base, so bare "crystal" should NOT
  // be added on top.
  assertEquals(materials.includes("crystal"), false);
  assertEquals(repair.added.includes("alabaster"), true);
  assertEquals(repair.added.includes("rock crystal"), true);
});

Deno.test("no-op when extraction already faithful", () => {
  const raw = "I want a sofa in patinated bronze and mohair.";
  const { materials, repair } = reconcileMaterialsWithSource(["patinated bronze", "mohair"], raw);
  assertEquals(materials, ["patinated bronze", "mohair"]);
  assertEquals(repair.added.length, 0);
  assertEquals(repair.replaced.length, 0);
});

Deno.test("word-boundary safety — 'cashmere' does not trigger 'mere' or partial matches", () => {
  const raw = "A cashmere throw on a walnut console.";
  const { materials } = reconcileMaterialsWithSource([], raw);
  assertEquals(materials.includes("cashmere"), true);
  assertEquals(materials.includes("walnut"), true);
  // No spurious tokens
  assertEquals(materials.length, 2);
});

Deno.test("empty raw message returns extraction unchanged", () => {
  const { materials, repair } = reconcileMaterialsWithSource(["glass"], "");
  assertEquals(materials, ["glass"]);
  assertEquals(repair.added.length, 0);
  assertEquals(repair.replaced.length, 0);
});
