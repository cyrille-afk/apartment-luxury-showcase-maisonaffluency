import { describe, expect, it } from "vitest";
import { ADMIN_EMAILS, alertCopy, pendingRecipients } from "../../supabase/functions/notify-new-registration/rules";
describe("registration alerts", () => {
  it("uses all three staff inboxes", () => {
    expect(ADMIN_EMAILS).toEqual(["concierge@maisonaffluency.com", "cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"]);
  });
  it("retries only unsuccessful recipients without duplicating successful sends", () => {
    expect(pendingRecipients(["a", "b", "b"], { a: true })).toEqual(["b"]);
    expect(pendingRecipients(["a", "b"], { a: true, b: "message-id" })).toEqual([]);
  });
  it("distinguishes real account and application events using saved values", () => {
    expect(alertCopy("new_account", { email: "new@example.com", first_name: "New", last_name: "User" })).toMatchObject({ title: "New account registration", name: "New User", email: "new@example.com" });
    expect(alertCopy("trade_application", { studio_name: "Saved Studio", phone_number: "+6512345678" })).toMatchObject({ title: "New Trade application", studio: "Saved Studio", phone: "+6512345678" });
  });
});