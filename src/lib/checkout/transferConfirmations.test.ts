import { beforeEach, describe, expect, it } from "vitest";
import { getTransferConfirmation, listTransferConfirmations, saveTransferConfirmation, type TransferConfirmation } from "./transferConfirmations";

const rec = (reference: string, issuedAt = new Date().toISOString(), totalCents = 100): TransferConfirmation => ({
  reference, issuedAt, method: "wire", currency: "gbp", lines: [{ title: "Console", quantity: 1, unitCents: 100 }],
  deliveryCents: 0, taxCents: 0, totalCents, rails: [{ label: "Wire", rows: [{ label: "SWIFT", value: "X" }] }],
});

describe("transfer confirmations", () => {
  beforeEach(() => localStorage.clear());
  it("reopens a saved confirmation by reference", () => {
    saveTransferConfirmation(rec("TRADE-ORDER-#10001"));
    expect(getTransferConfirmation("TRADE-ORDER-#10001")?.rails[0].rows[0].value).toBe("X");
  });
  it("re-issuing the same reference replaces it, newest first", () => {
    saveTransferConfirmation(rec("A")); saveTransferConfirmation(rec("B")); saveTransferConfirmation(rec("A", undefined, 999));
    expect(listTransferConfirmations().map(c => c.reference)).toEqual(["A", "B"]);
    expect(getTransferConfirmation("A")?.totalCents).toBe(999);
  });
  it("keeps at most 10 and drops records older than 90 days", () => {
    for (let i = 0; i < 12; i++) saveTransferConfirmation(rec(`R${i}`));
    expect(listTransferConfirmations()).toHaveLength(10);
    localStorage.clear();
    saveTransferConfirmation(rec("old", new Date(Date.now() - 91 * 86400000).toISOString()));
    expect(getTransferConfirmation("old")).toBeNull();
  });
});
