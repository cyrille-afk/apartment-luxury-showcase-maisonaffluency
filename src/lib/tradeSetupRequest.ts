export const PASSWORD_LINK_VALIDITY_HOURS = 24;

export function eligibleForSetupRequest(account: { status: string; user_id: string | null } | null) {
  return account?.status === 'approved' && !account.user_id;
}