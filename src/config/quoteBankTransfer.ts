import { GBP_BANK_WIRE_CONFIG } from "@/config/bankWire";

export interface QuoteBankBlock {
  title: string;
  rows: Array<{ label: string; value: string }>;
}

/** Shared bank instructions for the quote screen and generated document. */
export function getQuoteBankTransfer(currency: string): { blocks: QuoteBankBlock[]; note: string } {
  if (currency.toUpperCase() === "GBP") {
    const bank = GBP_BANK_WIRE_CONFIG;
    return {
      blocks: [{
        title: "GBP · Global SWIFT",
        rows: [
          { label: "Account", value: bank.accountNumber ?? "" },
          { label: "SWIFT/BIC", value: bank.swiftBic },
          { label: "Intermediary BIC", value: bank.intermediaryBic ?? "" },
          { label: "Bank", value: bank.beneficiaryBank },
          { label: "Address", value: bank.beneficiaryBankAddress ?? "" },
        ],
      }],
      note: `Please reference the quote number on your transfer. ${bank.transferNote}`,
    };
  }
  return {
    blocks: [
      {
        title: "Option A: EUR SEPA Transfers (Revolut Lithuania)",
        rows: [
          { label: "IBAN", value: "LT73 3250 0692 1856 8740" },
          { label: "BIC", value: "REVOLT21" },
          { label: "Bank", value: "Revolut Bank UAB" },
          { label: "Address", value: "Konstitucijos ave. 21B, 08130, Vilnius, Lithuania" },
        ],
      },
      {
        title: "Option B: Global SWIFT Wires (Revolut Singapore)",
        rows: [
          { label: "Account", value: "885111609218375" },
          { label: "SWIFT/BIC", value: "REVOSGS2" },
          { label: "Intermediary BIC", value: "BARCDEFF" },
          { label: "Bank", value: "Revolut Technologies Singapore Pte. Ltd" },
          { label: "Address", value: "6 Battery Road, Floor 6-01, 049909, Singapore" },
        ],
      },
    ],
    note: "Please reference the quote number on your transfer. EUR transfers preferred to avoid FX conversion.",
  };
}