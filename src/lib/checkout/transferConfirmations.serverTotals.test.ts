import { describe, it, expect } from "vitest";
import { applyServerTotals, type TransferConfirmation } from "./transferConfirmations";

const base: TransferConfirmation = {
  reference: "MA-1234", issuedAt: "2026-10-18T10:00:00Z", method: "instant", currency: "gbp",
  lines: [{ title: "Console", quantity: 2, unitCents: 870000 }], deliveryCents: 0,
  taxCents: 348000, taxLabel: "UK VAT 20%", totalCents: 2088000, rails: [], paymentIntentId: "pi_123456789012",
};

describe("applyServerTotals", () => {
  it("applies a team VAT correction to the saved total", () => {
    const next = applyServerTotals(base, { discount_cents: 0, tax_cents: 0, tax_label: "Reverse charge", total_cents: 1740000, updated_at: "2026-10-19T09:00:00Z" });
    expect(next?.taxCents).toBe(0);
    expect(next?.totalCents).toBe(1740000);
    expect(next?.taxLabel).toBe("Reverse charge");
    expect(next?.taxUpdatedAt).toBe("2026-10-19T09:00:00Z");
  });
  it("leaves the record alone when nothing changed or it's a wire order", () => {
    const same = { discount_cents: 0, tax_cents: 348000, tax_label: "UK VAT 20%", total_cents: 2088000, updated_at: "x" };
    expect(applyServerTotals(base, same)).toBeNull();
    expect(applyServerTotals({ ...base, method: "wire" }, { ...same, total_cents: 1 })).toBeNull();
  });
});
