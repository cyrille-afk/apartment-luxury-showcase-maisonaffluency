import { describe, expect, it } from "vitest";
import { viewingRoomSelection, viewingRoomSizeSelection, viewingRoomTotal, type ViewingRoomSlot } from "./viewingRoom";
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
    const ledger = moodBudgetLedger([{ id: slot.id }], new Map([[slot.id, { retail: Number(choice.retail_price) * 100, trade: null }]]), { roomType: "living", totalEur: 150000, caps: {}, anchors: [] });
    expect(ledger.allocated).toBe(900000); expect(ledger.remaining).toBe(14100000);
    expect(ledger.allocated / Number(ledger.total) * 100).toBe(6);
  });
  it("does not allow fixed finishes to change", () => { expect(() => viewingRoomSelection({ ...slot, allow_finish_customization: false }, "sofa", "velvet")).toThrow("Unapproved finish"); });
  it("does not allow fixed pieces to swap", () => { expect(() => viewingRoomSelection({ ...slot, is_swappable: false }, "chair")).toThrow("Unapproved choice"); });
  it("rejects unknown finish IDs rather than trusting browser prices", () => { expect(() => viewingRoomSelection(slot, "sofa", "invented")).toThrow("Unapproved finish"); });
});

const sizedSofa = { ...slot, size_options: [{ key: "190", label: "W 190 cm" }, { key: "250", label: "W 250 cm" }], finish_options: [
  { key: "1", size_key: "190", dimensions: "W 190 cm", label: "COM Fabric", retail_price: 7975, materials: {} },
  { key: "2", size_key: "250", dimensions: "W 250 cm", label: "COM Fabric", retail_price: 9812, materials: {} },
  { key: "3", size_key: "250", dimensions: "W 250 cm", label: "Fabric Cat. Opera", retail_price: 9520, materials: {} },
] } as unknown as ViewingRoomSlot;
describe("recorded sofa size pricing", () => {
  it("uses the exact size and retains its compatible finish", () => {
    const small = viewingRoomSizeSelection(sizedSofa, sizedSofa, "190");
    const large = viewingRoomSizeSelection(sizedSofa, small, "250");
    expect(small.retail_price).toBe(7975); expect(large.retail_price).toBe(9812);
    expect(large.finish_key).toBe("2"); expect(large.dimensions).toBe("W 250 cm");
  });
  it("updates card, allocation, remaining and package total from the exact size/finish", () => {
    const selected = viewingRoomSelection(sizedSofa, "sofa", "3", "250");
    const ledger = moodBudgetLedger([{ id: "sofa" }], new Map([["sofa", { retail: Number(selected.retail_price) * 100, trade: null }]]), { roomType: "living", totalEur: 150000, caps: {}, anchors: [] });
    expect(selected.retail_price).toBe(9520); expect(ledger.allocated).toBe(952000); expect(ledger.remaining).toBe(14048000);
    expect(viewingRoomTotal(150000, [sizedSofa], { sofa: selected })).toBe(149520);
  });
  it("rejects an unknown size", () => { expect(() => viewingRoomSizeSelection(sizedSofa, sizedSofa, "300")).toThrow("Unapproved size"); });
  it("rejects a finish belonging to a different size", () => { expect(() => viewingRoomSelection(sizedSofa, "sofa", "1", "250")).toThrow("Unapproved size"); });
  it("keeps fixed sizes unchanged", () => { expect(() => viewingRoomSizeSelection({ ...sizedSofa, allow_finish_customization: false }, sizedSofa, "250")).toThrow("Unapproved finish"); });
});