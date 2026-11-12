import { assert, assertEquals } from "jsr:@std/assert";

import { rankCatalogCandidates, selectCandidateShortlist, summarizeBoardIntent, selectFurnitureAnchors, inferRole } from "./relevance.ts";

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

Deno.test("armchair anchors outrank a lighting fixture regardless of board order", () => {
  const board = [
    { id: "light", title: "Spider Mini", brand: "Atelier", category: "Lighting", materials: "Bronze" },
    { id: "seat", title: "Amboseli Armchair", brand: "Atelier", category: "Seating", materials: "Walnut and bronze" },
  ];
  assertEquals(selectFurnitureAnchors(board).map(item => item.id), ["seat"]);
  const ranked = rankCatalogCandidates(board, [
    { id: "table", title: "Companion Side Table", brand: "Maker", category: "Tables", materials: "Walnut" },
    { id: "chair", title: "Dining Chair", brand: "Maker", category: "Seating", materials: "Bronze" },
  ]);
  assertEquals(ranked[0].id, "table");
  assertEquals(ranked[0].anchorTitle, "Amboseli Armchair");
});

Deno.test("one sofa prioritizes coffee tables and material compatibility", () => {
  const ranked = rankCatalogCandidates([{ id: "sofa", title: "Walnut Sofa", brand: "Maker", category: "Sofas", materials: "Walnut and wool" }], [
    { id: "match", title: "Oak Coffee Table", brand: "B", category: "Tables", materials: "Oak" },
    { id: "other", title: "Glass Coffee Table", brand: "B", category: "Tables", materials: "Glass" },
    { id: "dining", title: "Dining Table", brand: "B", category: "Tables", materials: "Walnut" },
  ]);
  assertEquals(ranked[0].id, "match");
  assertEquals(ranked[0].role, "coffee_table");
});

Deno.test("eight complements include multiple functional categories", () => {
  const board = [{ id: "chair", title: "Armchair", category: "Seating", brand: "A" }];
  const catalog = Array.from({ length: 8 }, (_, i) => ({ id: `table-${i}`, title: `Side Table ${i}`, brand: `B${i}`, category: "Tables" }));
  const ranked = rankCatalogCandidates(board, [...catalog,
    { id: "lamp", title: "Floor Lamp", brand: "C", category: "Lighting" },
    { id: "rug", title: "Rug", brand: "D", category: "Rugs" },
  ]);
  const selected = selectCandidateShortlist(ranked, 8);
  assertEquals(selected.filter(item => item.role === "side_table").length, 2);
  assert(selected.some(item => item.role === "floor_lamp"));
  assert(selected.some(item => item.role === "rug"));
});

Deno.test("plural storage typology is not overridden by references to other furniture", () => {
  assertEquals(inferRole({ id: "storage", title: "Anjos Sideboard", brand: "Hamrei", category: "Storage", subcategory: "Buffets, Cabinets And Sideboards", materials: "Wood, styled with a coffee table" }), "sideboard");
});

Deno.test("stools and breakfast tables are not footrests or chair-side surfaces", () => {
  assertEquals(inferRole({ id: "stool", title: "Flock Bar & Counter Stool CS2", brand: "Noom", category: "Seating", subcategory: "Ottomans & Stools" }), "stool");
  assertEquals(inferRole({ id: "table", title: "Drop Breakfast Table", brand: "Atelier", category: "Tables", subcategory: "Side Tables" }), "dining_table");
});