import { describe, expect, it } from "vitest";
import { ADMIN_EMAILS, alertCopy, pendingRecipients, isPublicAccountAlert, CUSTOMER_ACCOUNT_TEMPLATE_SID } from "../../supabase/functions/notify-new-registration/rules";
describe("registration alerts", () => {
  it("uses all three staff inboxes", () => {
    expect(ADMIN_EMAILS).toEqual(["concierge@maisonaffluency.com", "cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"]);
  });
  it("retries only unsuccessful recipients without duplicating successful sends", () => {
    expect(pendingRecipients(["a", "b", "b"], { a: true })).toEqual(["b"]);
    expect(pendingRecipients(["a", "b"], { a: true, b: "message-id" })).toEqual([]);
  });
  it("alerts only explicitly created public customer accounts", () => {
    expect(isPublicAccountAlert("new_account", "profiles", { registration_origin: "public_account", is_designer: false })).toBe(true);
    expect(isPublicAccountAlert("new_account", "profiles", { activation_lead_id: "lead" })).toBe(false);
    expect(isPublicAccountAlert("trade_application", "trade_accounts", { registration_origin: "public_account" })).toBe(false);
    expect(isPublicAccountAlert("trade_application", "trade_applications", { registration_origin: "public_account" })).toBe(false);
  });
  it("retains saved customer identity and uses a separate customer message", () => {
    expect(alertCopy({ email: "new@example.com", first_name: "New", last_name: "User" })).toMatchObject({ title: "New customer account created", name: "New User", email: "new@example.com" });
    expect(CUSTOMER_ACCOUNT_TEMPLATE_SID).toBe("HX360382e2838845956c4b82e94b31d829");
  });
});