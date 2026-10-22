import { normaliseBuyerTaxId, resolveTaxTreatment } from "./taxRules.ts";
import { verifyVatNumber } from "./vatValidation.ts";
import { applyIossEnv } from "./iossConfig.ts";

export async function resolveBankTransferTax(
  input: { country: string; currency: string; buyerType: unknown; buyerTaxId: unknown; goodsCents: number; shippingCents: number },
  verify: typeof verifyVatNumber = verifyVatNumber,
) {
  if (!/^[A-Z]{2}$/.test(input.country)) throw new Error("A delivery destination country is required.");
  const buyerType = input.buyerType === "business" ? "business" : "private";
  const buyerTaxId = normaliseBuyerTaxId(typeof input.buyerTaxId === "string" ? input.buyerTaxId : "");
  const verification = buyerType === "business" && buyerTaxId ? await verify(buyerTaxId, input.country) : null;
  applyIossEnv();
  return resolveTaxTreatment({ ...input, buyerType, buyerTaxId, buyerTaxIdVerified: verification?.valid === true, shipFromCountry: null });
}