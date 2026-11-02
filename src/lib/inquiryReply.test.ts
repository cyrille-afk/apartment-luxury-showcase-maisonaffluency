import { describe, expect, it } from "vitest";
import { validInquiryReply, inquiryReplyRecipient } from "../../supabase/functions/_shared/inquiryReply";
const id = "bdfceae0-c0ad-43d4-9d4d-367fd9c3cf31";
const key = `inquiry-reply-${id}-bdfceae0-c0ad-43d4-9d4d-367fd9c3cf32`;
const input = { inquiryId: id, subjectText: "Re: Your inquiry", bodyText: "Thank you for contacting us." };
describe("Inquiry replies", () => {
  it("accepts a bounded reply with a submission-specific retry key", () => expect(validInquiryReply(input, key)).toBe(true));
  it("rejects blank replies and injected subject headers", () => {
    expect(validInquiryReply({ ...input, bodyText: " " }, key)).toBe(false);
    expect(validInquiryReply({ ...input, subjectText: "Reply\r\nBcc: other@example.com" }, key)).toBe(false);
  });
  it("rejects a retry key belonging to another inquiry", () => expect(validInquiryReply(input, key.replace(id, "bdfceae0-c0ad-43d4-9d4d-367fd9c3cf33"))).toBe(false));
  it("always uses the saved inquiry recipient and strips caller HTML and recipient overrides", () => {
    expect(inquiryReplyRecipient({ email: "saved@example.com", name: "Saved visitor" }, { ...input, recipientEmail: "other@example.com", html: "<script>bad</script>" })).toEqual({
      recipientEmail: "saved@example.com", templateData: { name: "Saved visitor", subjectText: input.subjectText, bodyText: input.bodyText },
    });
  });
});