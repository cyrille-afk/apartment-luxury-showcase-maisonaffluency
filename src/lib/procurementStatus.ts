export type ProcurementState = "DRAFT" | "PROCUREMENT_REVIEW";

export function procurementState(issuedAt: string | null | undefined): ProcurementState {
  return issuedAt ? "PROCUREMENT_REVIEW" : "DRAFT";
}

export function quoteDocumentEditable(issuedAt: string | null | undefined, status: string, superAdmin = false) {
  return !issuedAt && (status === "draft" || superAdmin);
}

export const procurementStatusLabel = (state: ProcurementState) =>
  state === "PROCUREMENT_REVIEW" ? "IN PROCUREMENT REVIEW" : "QUOTE IN DRAFT";