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
  intermediaryBic?: string;
  accountNumber?: string;
  iban?: string;
  referencePrefix: string;
  currency: string;
  transferNote?: string;
}

export const DEFAULT_BANK_WIRE_CONFIG: BankWireConfig = {
  beneficiaryName: "AFFLUENCY ETC PTE LTD",
  beneficiaryBank: "Revolut Technologies Singapore Pte. Ltd",
  beneficiaryBankAddress:
    "6 Battery Road, Floor 6-01, 049909, Singapore, Singapore",
  swiftBic: "REVOSGS2",
  intermediaryBic: "BARCGB22",
  accountNumber: "885111609218375",
  referencePrefix: "MAW-",
  currency: "USD",
  transferNote:
    "Please make your transfer in USD. Using a different currency may send the funds to the company's other account. Transfers may take 3–5 business days to arrive.",
};

export function buildPaymentReference(
  orderRef: string,
  config = DEFAULT_BANK_WIRE_CONFIG
): string {
  const clean = orderRef.replace(/^#/, "").trim();
  if (!clean) return `${config.referencePrefix}PENDING`;
  return clean.startsWith(config.referencePrefix)
    ? clean
    : `${config.referencePrefix}${clean}`;
}
