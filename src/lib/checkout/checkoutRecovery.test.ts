import { describe, it, expect } from "vitest";
import { acceptRecoveredPrice, parseRecovery, readFunctionFailure } from "./checkoutRecovery";

const lines = [
  { pickId: "pendant", pairing: null, unitCents: 5700000, finishLabel: "Brass", quantity: 1 },
  { pickId: "console", pairing: { ruleId: "r1", optionId: "ivory-brass" }, unitCents: 870000, finishLabel: "Ivory Lacquer / Aged Brass", quantity: 2 },
];

describe("checkout recovery", () => {
  it("handles the Saint Honoré unavailable 409 without throwing or changing its price", async () => {
    const pickId = "54d04665-4ce2-45b5-8a76-77e5bb57fe95";
    const message = "Saint Honoré Sofa is not available for direct purchase — please send an enquiry.";
    const failure = await readFunctionFailure({ context: new Response(JSON.stringify({ error: message, recovery: { pickId, reason: "unavailable" } }), { status: 409 }) }, null, "Unable to start checkout.");
    expect(failure.message).toBe(message);
    expect(failure.recovery?.reason).toBe("unavailable");
    expect(failure.recovery?.pickId).toBe(pickId);
    if (!failure.recovery) throw new Error("Missing recovery");
    expect(acceptRecoveredPrice([{ pickId, unitCents: 2050000 }], failure.recovery)).toBeNull();
  });
  it("accepting a changed pairing price keeps the pairing, finish and quantity", () => {
    const next = acceptRecoveredPrice(lines, parseRecovery({ pickId: "console", reason: "price_changed", currentUnitCents: 910000, pairing: { ruleId: "r1", optionId: "ivory-brass" } })!)!;
    expect(next[1]).toEqual({ ...lines[1], unitCents: 910000 });
    expect(next[0]).toBe(lines[0]);
  });
  it("does not reprice when no unambiguous current price is given", () => {
    expect(acceptRecoveredPrice(lines, parseRecovery({ pickId: "console", reason: "price_changed", pairing: { ruleId: "r1", optionId: "ivory-brass" } })!)).toBeNull();
  });
  it("does not reprice an unavailable finish", () => {
    expect(acceptRecoveredPrice(lines, parseRecovery({ pickId: "console", reason: "finish_unavailable", currentUnitCents: 1 })!)).toBeNull();
  });
  it("does not reprice a line whose pairing option differs", () => {
    expect(acceptRecoveredPrice(lines, parseRecovery({ pickId: "console", reason: "price_changed", currentUnitCents: 910000, pairing: { ruleId: "r1", optionId: "other" } })!)).toBeNull();
  });
});

describe("choosing among several valid prices", () => {
  const rec = parseRecovery({ pickId: "console", reason: "price_changed", pairing: { ruleId: "r1", optionId: "ivory-brass" }, priceOptions: [{ label: "Small", unitCents: 800000 }, { label: "Large", unitCents: 950000 }] })!;
  it("leaves the line untouched until a price is chosen", () => {
    expect(acceptRecoveredPrice(lines, rec)).toBeNull();
  });
  it("rejects a price that was not offered", () => {
    expect(acceptRecoveredPrice(lines, rec, 123)).toBeNull();
  });
  it("applies the chosen offered price and keeps the pairing", () => {
    expect(acceptRecoveredPrice(lines, rec, 950000)![1]).toEqual({ ...lines[1], unitCents: 950000 });
  });
});
