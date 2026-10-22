import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveBankTransferTax } from "../_shared/bankTransferTax.ts";

Deno.test("bank transfer ignores a zero client tax and forged rate", async () => {
  const result = await resolveBankTransferTax({ country: "SG", currency: "usd", buyerType: "private", buyerTaxId: "", goodsCents: 10000, shippingCents: 1000, ...{ taxCents: 0, taxRate: 0 } });
  assertEquals(result.taxCents, 990);
  assertEquals(result.rate, 0.09);
});
Deno.test("bank transfer rejects missing destination", async () => {
  await assertRejects(() => resolveBankTransferTax({ country: "", currency: "gbp", buyerType: "private", buyerTaxId: "", goodsCents: 10000, shippingCents: 0 }));
});
Deno.test("bank transfer never zero-rates an unverified business tax ID", async () => {
  const result = await resolveBankTransferTax({ country: "GB", currency: "gbp", buyerType: "business", buyerTaxId: "GB123456789", goodsCents: 10000, shippingCents: 1000 }, async () => ({ valid: false, source: "unavailable" }));
  assertEquals(result.taxCents, 2200);
  assertEquals(result.clearanceFeeCents, 0); // £100 is below the existing £135 clearance threshold.
});
Deno.test("bank transfer uses verified business treatment", async () => {
  const result = await resolveBankTransferTax({ country: "GB", currency: "gbp", buyerType: "business", buyerTaxId: "GB123456789", goodsCents: 10000, shippingCents: 1000 }, async () => ({ valid: true, source: "aggregator" }));
  assertEquals(result.taxCents, 0);
  assertEquals(result.treatment, "reverse_charge");
});