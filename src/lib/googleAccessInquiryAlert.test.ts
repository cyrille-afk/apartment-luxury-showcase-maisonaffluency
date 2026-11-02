import { describe, expect, it } from "vitest";
import { googleAccessInquiry } from "./googleAccessRequest";
import { googleAccessInquiryAlert } from "../../supabase/functions/_shared/googleAccessInquiryAlert";

describe("Google-access inquiry notification classification", () => {
  const inquiry = googleAccessInquiry({ name: "Jane Tan", email: "jane@example.com" });
  it("alerts for a new fixed Google-access request using its submitted identity", () => {
    expect(googleAccessInquiryAlert(inquiry)).toMatchObject({
      event: "google_access_inquiry",
      contentVariables: { "1": "Jane Tan", "2": "jane@example.com" },
    });
  });
  it("does not classify Trade applications as Google-access inquiries", () => {
    expect(googleAccessInquiryAlert({ ...inquiry, source: "trade_application" })).toBeNull();
  });
  it("does not alert for ordinary contact inquiries", () => {
    expect(googleAccessInquiryAlert({ ...inquiry, subject: "Gallery appointment" })).toBeNull();
    expect(googleAccessInquiryAlert({ ...inquiry, message: "Please contact me regarding an appointment." })).toBeNull();
  });
  it("does not classify product requests as Google-access inquiries", () => {
    expect(googleAccessInquiryAlert({ ...inquiry, source: "public_product" })).toBeNull();
  });
});