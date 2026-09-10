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

export const USD_BANK_WIRE_CONFIG: BankWireConfig = {
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
    "Please make your transfer in USD. Using a different currency may send the funds to the company's other account. International SWIFT transfers may take 3–5 business days to arrive.",
};

export const GBP_BANK_WIRE_CONFIG: BankWireConfig = {
  beneficiaryName: "AFFLUENCY ETC PTE LTD",
  beneficiaryBank: "Revolut Technologies Singapore Pte. Ltd",
  beneficiaryBankAddress:
    "6 Battery Road, Floor 6-01, 049909, Singapore, Singapore",
  swiftBic: "REVOSGS2",
  intermediaryBic: "BARCGB22",
  accountNumber: "885111609218375",
  referencePrefix: "MAW-",
  currency: "GBP",
  transferNote:
    "Please make your transfer in GBP. Using a different currency may send the funds to the company's other account. International SWIFT transfers may take 3–5 business days to arrive.",
};

export const EUR_BANK_WIRE_CONFIG: BankWireConfig = {
  beneficiaryName: "AFFLUENCY ETC PTE LTD",
  beneficiaryBank: "Revolut Bank UAB",
  beneficiaryBankAddress: "Konstitucijos ave. 21B, 08130, Vilnius, Lithuania",
  swiftBic: "REVOLT21",
  iban: "LT73 3250 0692 1856 8740",
  referencePrefix: "MAW-",
  currency: "EUR",
  transferNote:
    "Please make your transfer in EUR. Using a different currency may send the funds to the company's other account. Transfers from European banks may arrive instantly or within 2 business days.",
};

export const DEFAULT_BANK_WIRE_CONFIG = USD_BANK_WIRE_CONFIG;

const CURRENCY_CONFIG_MAP: Record<string, BankWireConfig> = {
  USD: USD_BANK_WIRE_CONFIG,
  EUR: EUR_BANK_WIRE_CONFIG,
  GBP: GBP_BANK_WIRE_CONFIG,
};

export function getBankWireConfigForCurrency(currency: string): BankWireConfig {
  return CURRENCY_CONFIG_MAP[currency?.toUpperCase() || "USD"] ?? USD_BANK_WIRE_CONFIG;
}

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
