import { assert, assertEquals } from "jsr:@std/assert";

import { rankCatalogCandidates, selectCandidateShortlist, summarizeBoardIntent, selectFurnitureAnchors, selectPairingReferences, inferRole, isFunctionalComplement } from "./relevance.ts";

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

const spider = { id: "spider", title: "Spider Mini", brand: "Atelier", category: "Lighting", subcategory: "Ceiling Lights" };

Deno.test("Spider Mini excludes all chandeliers, pendants and ceiling lights before ranking", () => {
  const ranked = rankCatalogCandidates([spider], [
    { id: "chandelier", title: "Bronze Chandelier", brand: "B", category: "Lighting" },
    { id: "pendant", title: "Pendant Light", brand: "B", category: "Lighting" },
    { id: "ceiling", title: "Ceiling Light", brand: "B", category: "Lighting" },
    { id: "dining", title: "Dining Table", brand: "B", category: "Tables" },
  ]);
  assertEquals(ranked.map(item => item.id), ["dining"]);
});

Deno.test("a pendant on the board excludes chandeliers as the same overhead function", () => {
  assertEquals(isFunctionalComplement([{ ...spider, subcategory: "Pendant Lights" }],
    { id: "other", title: "Chandelier", brand: "B", category: "Lighting" }), false);
});

Deno.test("a dining table on the board excludes another dining table even if it is a breakfast table", () => {
  const ranked = rankCatalogCandidates([{ id: "dining", title: "Dining Table", brand: "A", category: "Tables" }], [
    { id: "repeat", title: "Breakfast Table", brand: "B", category: "Tables" },
    { id: "chair", title: "Dining Chair", brand: "B", category: "Seating" },
  ]);
  assertEquals(ranked.map(item => item.id), ["chair"]);
});

Deno.test("a sofa on the board excludes another sofa including a settee", () => {
  const ranked = rankCatalogCandidates([{ id: "sofa", title: "Sofa", brand: "A" }], [
    { id: "repeat", title: "Settee", brand: "B" },
    { id: "coffee", title: "Coffee Table", brand: "B" },
  ]);
  assertEquals(ranked.map(item => item.id), ["coffee"]);
});

Deno.test("occupied roles are excluded across all board items, not only the primary anchor", () => {
  const board = [{ id: "sofa", title: "Sofa", brand: "A" }, spider,
    { id: "lamp", title: "Floor Lamp", brand: "A", category: "Lighting" }];
  const ranked = rankCatalogCandidates(board, [
    { id: "pendant", title: "Pendant", brand: "B", category: "Lighting" },
    { id: "floor", title: "Floor Lamp", brand: "B", category: "Lighting" },
    { id: "table", title: "Table Lamp", brand: "B", category: "Lighting" },
  ]);
  assertEquals(ranked.map(item => item.id), ["table"]);
});

Deno.test("overhead-only references prioritize dining tables, chairs and perimeter storage", () => {
  assertEquals(selectFurnitureAnchors([spider]), []);
  assertEquals(selectPairingReferences([spider]), [spider]);
  const ranked = rankCatalogCandidates([spider], [
    { id: "side", title: "Side Table", brand: "B", category: "Tables" },
    { id: "floor", title: "Floor Lamp", brand: "B", category: "Lighting" },
    { id: "console", title: "Console", brand: "B", category: "Storage" },
    { id: "storage", title: "Sideboard", brand: "B", category: "Storage" },
    { id: "chair", title: "Dining Chair", brand: "B", category: "Seating" },
    { id: "table", title: "Dining Table", brand: "B", category: "Tables" },
  ]);
  assertEquals(ranked[0].id, "table");
  assertEquals(ranked.slice(0, 4).map(item => item.id).sort(), ["chair", "console", "storage", "table"]);
  assertEquals(ranked[0].anchorTitle, "Spider Mini");
});

Deno.test("specific non-lighting typologies are excluded without blocking other tables", () => {
  assertEquals(isFunctionalComplement([{ id: "table", title: "Side Table", brand: "A" }],
    { id: "repeat", title: "End Table", brand: "B" }), false);
  assertEquals(isFunctionalComplement([{ id: "table", title: "Side Table", brand: "A" }],
    { id: "coffee", title: "Coffee Table", brand: "B" }), true);
});

Deno.test("Yoma Console keeps its specific function despite a broad storage department", () => {
  const yoma = { id: "yoma", title: "Yoma CLW Console", brand: "Kerstens", category: "Storage", subcategory: "Buffets, Cabinets And Sideboards" };
  assertEquals(inferRole(yoma), "console");
  assertEquals(isFunctionalComplement([yoma], { id: "other", title: "Console", brand: "B", category: "Tables", subcategory: "Consoles" }), false);
});