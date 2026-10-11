export const CONCIERGE_INBOX = "concierge@maisonaffluency.com";
export const STUCK_PENDING_MINUTES = 20;

/** Inquiry, quote and concierge-copy emails, or anything sent to the concierge inbox. */
export function isConciergeEmail(template: string | null, recipient: string | null): boolean {
  const t = (template ?? "").toLowerCase();
  if ((recipient ?? "").toLowerCase() === CONCIERGE_INBOX) return true;
  return t.startsWith("inquiry-") || t.startsWith("quote-") || t.endsWith("-concierge")
    || t === "cn-director-brief" || t === "client-quote-payment";
}

export function isDeliveryFailure(status: string, createdAt: string, now: Date): boolean {
  if (["dlq", "failed", "bounced", "complained", "suppressed"].includes(status)) return true;
  if (status === "pending") return now.getTime() - new Date(createdAt).getTime() > STUCK_PENDING_MINUTES * 60_000;
  return false;
}
