import { describe, expect, it } from "vitest";
import { buildOrderDeliveryMessage } from "../../supabase/functions/_shared/orderDeliveryMessaging";

describe("destination-aware order delivery messaging", () => {
  it("marks London DDP charges as prepaid", () => {
    const result = buildOrderDeliveryMessage({
      shippingCountry: "GB",
      deliveryTerm: "DDP",
      importTotalCents: 1_071_400,
    });
    expect(result.destination).toBe("United Kingdom");
    expect(result.customsStatement).toContain("prepaid by Maison Affluency");
    expect(result.customsStatement).toContain("no further listed customs charges");
  });

  it("marks London DDU charges as excluded and buyer-paid", () => {
    const result = buildOrderDeliveryMessage({
      shippingCountry: "GB",
      deliveryTerm: "DDU",
      deferredImportCents: 1_055_000,
    });
    expect(result.customsStatement).toContain("excluded from the order total");
    expect(result.customsStatement).toContain("payable by the buyer");
  });

  it.each(["CH", "AE", "SG"])("uses the real %s destination", (country) => {
    const result = buildOrderDeliveryMessage({ shippingCountry: country, deliveryTerm: "DDU" });
    expect(result.destination).toBeTruthy();
    expect(result.customsStatement).not.toContain("United Kingdom");
  });

  it("uses neutral wording when no destination rule exists", () => {
    const result = buildOrderDeliveryMessage({ shippingCountry: "US" });
    expect(result.destination).toBe("United States");
    expect(result.deliveryTerm).toBeNull();
    expect(result.customsStatement).toBeNull();
  });
});