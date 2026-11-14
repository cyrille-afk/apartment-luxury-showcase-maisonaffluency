import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { rankCatalogCandidates, selectPairingReferences } from "./relevance.ts";
Deno.test("all explicit anchors override automatic furniture references", () => {
  const board = [
    { id: "sofa", title: "Sofa", brand: "Maker" },
    { id: "bed", title: "Bed", brand: "Maker", pinnedAnchor: true },
    { id: "desk", title: "Desk", brand: "Maker", pinnedAnchor: true },
  ];
  assertEquals(selectPairingReferences(board).map(i => i.id), ["bed", "desk"]);
  const ranked = rankCatalogCandidates(board, [{ id: "night", title: "Bedside Table", brand: "Maker" }]);
  assertEquals(ranked[0]?.anchorTitle, "Bed");
});