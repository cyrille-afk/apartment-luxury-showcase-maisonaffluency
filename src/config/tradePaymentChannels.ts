/**
 * Region-specific B2B payment channels for the Maison Affluency Trade Program.
 *
 * ASEAN (Singapore-hubbed) buyers settle locally through Corporate PayNow or a
 * FAST bank transfer; GCC and Rest-of-World buyers settle by international
 * SWIFT wire with intermediary routing.
 */

export type RegionTier = "ASEAN" | "GCC" | "ROW";

export type PaymentChannelId = "paynow" | "fast" | "swift";

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

const BENEFICIARY = "Maison Affluency Pte. Ltd.";
const CORPORATE_UEN = "202441283K";
const BANK_NAME = "DBS Bank Ltd";
const BANK_ADDRESS = "12 Marina Boulevard, Marina Bay Financial Centre Tower 3, Singapore 018982";
const SWIFT_CODE = "DBSSSGSGXXX";
const ACCOUNT_NUMBER = "072-905-8841";
const IBAN = "SG72DBSS0729058841";

export const PAYNOW: TradePaymentChannel = {
  id: "paynow",
  label: "Corporate PayNow",
  hint: "Instant settlement · Singapore corporate accounts",
  rows: [
    { label: "PayNow UEN", value: CORPORATE_UEN, copyable: true },
    { label: "Registered Entity", value: BENEFICIARY },
    { label: "Bank", value: BANK_NAME },
  ],
  instructions: [
    "Open your corporate banking app and choose PayNow → UEN.",
    "Enter the UEN above; the registered entity name must read “Maison Affluency Pte. Ltd.” before you approve.",
    "Quote the Order ID in the transfer reference so our treasury can match the payment instantly.",
  ],
};

export const FAST: TradePaymentChannel = {
  id: "fast",
  label: "Local Bank Transfer (FAST)",
  hint: "Same-day clearing within Singapore",
  rows: [
    { label: "Beneficiary Name", value: BENEFICIARY },
    { label: "Bank", value: BANK_NAME },
    { label: "Account Number", value: ACCOUNT_NUMBER, copyable: true },
    { label: "Corporate UEN", value: CORPORATE_UEN, copyable: true },
    { label: "Bank Address", value: BANK_ADDRESS },
  ],
  instructions: [
    "Select FAST (not GIRO) for same-day clearing.",
    "Payments above your bank's FAST ceiling should be sent by MEPS or split across two transfers.",
    "Quote the Order ID in the transfer reference field.",
  ],
};

export const SWIFT: TradePaymentChannel = {
  id: "swift",
  label: "International Wire Transfer (SWIFT)",
  hint: "2–3 business days · all charges OUR",
  rows: [
    { label: "Beneficiary Name", value: BENEFICIARY },
    { label: "Beneficiary Bank", value: BANK_NAME },
    { label: "Bank Address", value: BANK_ADDRESS },
    { label: "IBAN", value: IBAN, copyable: true },
    { label: "Account Number", value: ACCOUNT_NUMBER, copyable: true },
    { label: "SWIFT / BIC", value: SWIFT_CODE, copyable: true },
    { label: "Corporate UEN", value: CORPORATE_UEN, copyable: true },
  ],
  instructions: [
    "Intermediary bank (USD): JPMorgan Chase Bank N.A., New York — SWIFT CHASUS33.",
    "Intermediary bank (EUR): Deutsche Bank AG, Frankfurt — SWIFT DEUTDEFF.",
    "Instruct your bank to send charges as OUR so the invoiced amount arrives in full.",
    "Quote the Order ID in field 70 (remittance information).",
  ],
};

export function channelsForRegion(region: RegionTier): TradePaymentChannel[] {
  return region === "ASEAN" ? [PAYNOW, FAST] : [SWIFT];
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
  iban: IBAN,
  accountNumber: ACCOUNT_NUMBER,
};
