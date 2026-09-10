/**
 * Region-specific B2B payment channels for the Maison Affluency Trade Program.
 *
 * All trade settlements route through the live Revolut corporate SWIFT account.
 * Legacy DBS dummy coordinates have been removed.
 */

export type RegionTier = "ASEAN" | "GCC" | "ROW";

export type PaymentChannelId = "swift";

export interface PaymentDetailRow {
  label: string;
  value: string;
  /** Show a one-click copy button (account numbers, IBAN, SWIFT, UEN…). */
  copyable?: boolean;
}

export interface TradePaymentChannel {
  id: PaymentChannelId;
  label: string;
  hint: string;
  rows: PaymentDetailRow[];
  /** Extra routing guidance rendered below the details grid. */
  instructions: string[];
}

const BENEFICIARY = "AFFLUENCY ETC PTE LTD";
const CORPORATE_UEN = "201717288Z";
const BANK_NAME = "Revolut Technologies Singapore Pte. Ltd";
const BANK_ADDRESS = "6 Battery Road, Floor 6-01, 049909, Singapore, Singapore";
const SWIFT_CODE = "REVOSGS2";
const ACCOUNT_NUMBER = "885111609218375";
const INTERMEDIARY_BIC = "BARCDEFF";

export const SWIFT: TradePaymentChannel = {
  id: "swift",
  label: "International Wire Transfer (SWIFT)",
  hint: "3–5 business days · all charges OUR",
  rows: [
    { label: "Beneficiary Name", value: BENEFICIARY },
    { label: "Beneficiary Bank", value: BANK_NAME },
    { label: "Bank Address", value: BANK_ADDRESS },
    { label: "Account Number", value: ACCOUNT_NUMBER, copyable: true },
    { label: "SWIFT / BIC", value: SWIFT_CODE, copyable: true },
    { label: "Intermediary BIC", value: INTERMEDIARY_BIC, copyable: true },
    { label: "Corporate UEN", value: CORPORATE_UEN, copyable: true },
  ],
  instructions: [
    "Please make your transfer in the invoiced currency. Using a different currency may send the funds to the company's other account.",
    "Instruct your bank to send charges as OUR so the invoiced amount arrives in full.",
    "Quote the Order ID in field 70 (remittance information).",
  ],
};

export function channelsForRegion(_region: RegionTier): TradePaymentChannel[] {
  return [SWIFT];
}

/** Regional tax treatment shown on the pro-forma invoice. */
export function taxConfigForRegion(region: RegionTier, country?: string | null) {
  const isSingapore = /singapore|^sg$/i.test((country || "").trim());
  if (region === "ASEAN" && isSingapore) {
    return { rate: 0.09, label: "GST (Singapore, 9%)" };
  }
  if (region === "GCC") {
    return { rate: 0, label: "Zero-rated export — GCC import VAT/duty payable on landing" };
  }
  if (region === "ASEAN") {
    return { rate: 0, label: "Zero-rated export — local import duty payable on landing" };
  }
  return { rate: 0, label: "Zero-rated export — destination duties and taxes payable on import" };
}

export const CORPORATE_IDENTITY = {
  beneficiary: BENEFICIARY,
  uen: CORPORATE_UEN,
  bank: BANK_NAME,
  bankAddress: BANK_ADDRESS,
  swift: SWIFT_CODE,
  accountNumber: ACCOUNT_NUMBER,
  intermediaryBic: INTERMEDIARY_BIC,
};
