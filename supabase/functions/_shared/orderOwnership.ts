export type BankTransferOrderOwner = {
  user_id: string | null;
};

/** Existing orders can only be reused by their authenticated owner. */
export function canReuseBankTransferOrder(
  existing: BankTransferOrderOwner | null,
  userId: string | null,
): boolean {
  if (!existing) return true;
  return userId !== null && existing.user_id === userId;
}
