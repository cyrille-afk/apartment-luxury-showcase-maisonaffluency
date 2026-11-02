export function validInquiryReply(input: Record<string, unknown>, key: string): boolean {
  const id = String(input.inquiryId ?? "");
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return new RegExp(`^${uuid}$`, "i").test(id) &&
    new RegExp(`^inquiry-reply-${id}-${uuid}$`, "i").test(key) &&
    typeof input.subjectText === "string" && !!input.subjectText.trim() &&
    input.subjectText.length <= 200 && !/[\r\n]/.test(input.subjectText) &&
    typeof input.bodyText === "string" && !!input.bodyText.trim() && input.bodyText.length <= 20000;
}

export function inquiryReplyRecipient(row: { email: string; name: string }, input: Record<string, unknown>) {
  return { recipientEmail: row.email, templateData: {
    name: row.name, subjectText: String(input.subjectText).trim(), bodyText: String(input.bodyText).trim(),
  } };
}