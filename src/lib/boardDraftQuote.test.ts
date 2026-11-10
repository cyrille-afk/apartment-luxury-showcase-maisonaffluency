import { expect, it } from "vitest";
import { compileBoardDraftQuote, latestBoardFinishRequests, type BoardDraftSource } from "./boardDraftQuote";
const item: BoardDraftSource = { id: "one", product_id: "table", product_name: "Madison", approval_status: "approved", quantity: 2, currency: "EUR", retailCents: 300000, finish: { label: "Onice Velluto Marble / Aged Brass", top: "Onice Velluto Marble", base: "Aged Brass", top_image: "stone.jpg", base_image: "metal.jpg" }, requested: true };
it("uses the latest saved client finish request without interpreting free comments", () => {
  expect(latestBoardFinishRequests([
    { id: "1", item_id: "one", comment: "Finish request: Pakistan Onyx / Aged Brass", created_at: "2026-11-10T04:00:00Z" },
    { id: "2", item_id: "one", comment: "Finish request: Onice Velluto Marble / Aged Brass", created_at: "2026-11-10T04:19:04Z" },
    { id: "3", item_id: "one", comment: "Please consider another stone", created_at: "2026-11-10T04:20:00Z" },
  ])).toEqual({ one: "Onice Velluto Marble / Aged Brass" });
});
it("compiles only Approved items and preserves requested swatches, quantity and tier price", () => {
  const draft = compileBoardDraftQuote([item, { ...item, id: "pending", approval_status: "pending" }, { ...item, id: "rejected", approval_status: "rejected" }], .1, 1);
  expect(draft.lines).toHaveLength(1);
  expect(draft.lines[0]).toMatchObject({ finish: item.finish, quantity: 2, netUnitCents: 270000, clientUnitCents: 300000, netTotalCents: 540000, clientTotalCents: 600000 });
  expect(draft.reviewOnly).toBe(true);
});
it("does not discount saved configured net prices twice", () => {
  expect(compileBoardDraftQuote([{ ...item, netCents: 270000 }], .1, 1.2).lines[0].netUnitCents).toBe(270000);
});
it("blocks sign-off for unpriced requested finishes rather than carrying baseline prices", () => {
  const result = compileBoardDraftQuote([{ ...item, retailCents: null }], .1, 1);
  expect(result.ready).toBe(false);
  expect(result.lines[0].netUnitCents).toBeNull();
});
it("removes a previously approved line when its approval is withdrawn", () => {
  expect(compileBoardDraftQuote([{ ...item, approval_status: "pending" }], .1, 1).lines).toEqual([]);
});