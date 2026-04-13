import { assert, assertEquals } from "jsr:@std/assert";

import { rankCatalogCandidates, selectCandidateShortlist, summarizeBoardIntent } from "./relevance.ts";

Deno.test("prioritizes dining complements for a dining table", () => {
  const board = [
    {
      id: "table-1",
      title: "Angelo M Dining Table",
      brand: "Maison",
      category: "Tables",
      subcategory: "Dining",
      materials: "Walnut and bronze",
    },
  ];

  const catalog = [
    {
      id: "chair-1",
      title: "Wire Dining Chair",
      brand: "Overgaard & Dyrman",
      category: "Seating",
      subcategory: "Dining Chair",
      materials: "Burnished steel wire and leather",
    },
    {
      id: "pendant-1",
      title: "Orion Pendant",
      brand: "Garnier & Linker",
      category: "Lighting",
      subcategory: "Pendant",
      materials: "Bronze and alabaster",
    },
    {
      id: "armchair-1",
      title: "Apora Armchair",
      brand: "Bruno Moinard Editions",
      category: "Seating",
      subcategory: "Armchair",
      materials: "Walnut and textured fabric",
    },
  ];

  const ranked = selectCandidateShortlist(rankCatalogCandidates(board, catalog), 3);
  assertEquals(ranked[0].role, "dining_chair");
  assert(ranked.slice(0, 2).some((item) => item.role === "pendant"));
  assertEquals(ranked[2].role, "armchair");
});

Deno.test("summarizes chair-led rooms with companion roles", () => {
  const summary = summarizeBoardIntent([
    {
      id: "chair-1",
      title: "Twin Chair",
      brand: "Studio",
      category: "Seating",
      subcategory: "Lounge Chair",
      materials: "Oak and leather",
    },
  ]);

  assert(summary.desiredRoles.includes("side table"));
  assert(summary.desiredRoles.includes("floor lamp"));
  assert(summary.materialTokens.includes("oak"));
});