import { describe, expect, it } from "vitest";
import { invitationEmailState, latestInvitationEmail } from "./invitationEmailStatus";

describe("collaborator email status", () => {
  it("does not claim delivery for an accepted send", () => {
    expect(invitationEmailState("sent").status).toBe("sent");
    expect(invitationEmailState("delivered").status).toBe("delivered");
  });
  it("retains pending and bounced as distinct email states", () => {
    expect(invitationEmailState("pending").status).toBe("pending");
    expect(invitationEmailState("bounced").status).toBe("bounced");
  });
  it("uses the newest invitation attempt even when an older invitation is joined", () => {
    expect(latestInvitationEmail(["joined", "new"], [
      { invite_id: "joined", email_status: "sent", updated_at: "2026-11-09T00:00:00Z" },
      { invite_id: "other-folder", email_status: "delivered", updated_at: "2026-11-11T00:00:00Z" },
      { invite_id: "new", email_status: "pending", updated_at: "2026-11-10T00:00:00Z" },
    ])?.email_status).toBe("pending");
  });
  it("keeps missing or failed lookup evidence unconfirmed instead of pending or delivered", () => {
    expect(invitationEmailState(latestInvitationEmail(["missing"], [])?.email_status).status).toBe("unconfirmed");
  });
});