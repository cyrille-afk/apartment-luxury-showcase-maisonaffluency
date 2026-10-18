import { describe, it, expect } from "vitest";
import { acceptRecoveredPrice, parseRecovery } from "./checkoutRecovery";

const lines = [
  { pickId: "pendant", pairing: null, unitCents: 5700000, finishLabel: "Brass", quantity: 1 },
  { pickId: "console", pairing: { ruleId: "r1", optionId: "ivory-brass" }, unitCents: 870000, finishLabel: "Ivory Lacquer / Aged Brass", quantity: 2 },
];

describe("checkout recovery", () => {
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
