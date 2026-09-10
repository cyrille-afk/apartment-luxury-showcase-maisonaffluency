/**
 * Consumer bank-wire settlement details.
 * These are rendered on /bank-wire-instructions after a checkout selects
 * wire transfer. Update this file with the live treasury coordinates.
 */

export interface BankWireConfig {
  beneficiaryName: string;
  beneficiaryBank: string;
  beneficiaryBankAddress?: string;
  swiftBic: string;
  iban: string;
  referencePrefix: string;
}

export const DEFAULT_BANK_WIRE_CONFIG: BankWireConfig = {
  beneficiaryName: "Maison Affluency Pte. Ltd.",
  beneficiaryBank: "Banque Neuflize OBC",
  beneficiaryBankAddress: "3 avenue Hoche, 75008 Paris, France",
  swiftBic: "NOFBFRPPXXX",
  iban: "FR76 3000 3017 4500 0007 8901 234",
  referencePrefix: "MAW-",
};

export function buildPaymentReference(orderRef: string, config = DEFAULT_BANK_WIRE_CONFIG): string {
  const clean = orderRef.replace(/^#/, "").trim();
  if (!clean) return `${config.referencePrefix}PENDING`;
  return clean.startsWith(config.referencePrefix) ? clean : `${config.referencePrefix}${clean}`;
}
