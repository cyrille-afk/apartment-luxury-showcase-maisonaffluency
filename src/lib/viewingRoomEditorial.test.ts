import { describe, expect, it } from "vitest";
import { viewingRoomSelection, viewingRoomTotal, type ViewingRoomSlot } from "./viewingRoom";
import { moodBudgetLedger } from "./moodBoardBudget";

const slot = { id: "sofa", product_name: "Sofa", retail_price: 10000, materials: {}, is_swappable: true, allow_finish_customization: true, finish_options: [{ key: "velvet", label: "Velvet / Oak", retail_price: 12500, materials: {} }], alternatives: [{ id: "chair", retail_price: 9000, materials: {}, finish_options: [] }] } as unknown as ViewingRoomSlot;
describe("client editorial selection", () => {
  it("commits the approved finish price to both item and allocation immediately", () => {
    const selected = viewingRoomSelection(slot, "sofa", "velvet");
    expect(selected.retail_price).toBe(12500);
    const ledger = moodBudgetLedger([{ id: "sofa" }], new Map([["sofa", { retail: selected.retail_price == null ? null : selected.retail_price * 100, trade: null }]]), { roomType: "living", totalEur: 150000, caps: {}, anchors: [] });
    expect(ledger.allocated).toBe(1250000); expect(ledger.remaining).toBe(13750000);
    expect(ledger.allocated / Number(ledger.total) * 100).toBeCloseTo(8.333333);
    expect(viewingRoomTotal(150000, [slot], { sofa: selected })).toBe(152500);
  });
  it("updates an approved alternative at its projected price, ignoring a supplied price", () => {
    const choice = viewingRoomSelection(slot, "chair");
    expect(choice.retail_price).toBe(9000);
    expect(viewingRoomTotal(150000, [slot], { sofa: { ...choice, retail_price: 1 } })).toBe(149000);
  });
  it("does not allow fixed finishes to change", () => { expect(() => viewingRoomSelection({ ...slot, allow_finish_customization: false }, "sofa", "velvet")).toThrow("Unapproved finish"); });
  it("does not allow fixed pieces to swap", () => { expect(() => viewingRoomSelection({ ...slot, is_swappable: false }, "chair")).toThrow("Unapproved choice"); });
  it("rejects unknown finish IDs rather than trusting browser prices", () => { expect(() => viewingRoomSelection(slot, "sofa", "invented")).toThrow("Unapproved finish"); });
});