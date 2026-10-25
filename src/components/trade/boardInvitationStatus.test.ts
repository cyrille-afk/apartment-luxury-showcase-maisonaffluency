import { describe, expect, it } from "vitest";
import { boardInvitationPermission, boardInvitationStatus } from "./boardInvitationStatus";

const now = Date.parse("2026-10-25T07:51:00Z");
const invite = { status: "pending", expires_at: "2026-10-27T07:51:00Z", last_seen_at: null };
describe("board invitation access status", () => {
  it("counts an unexpired invitation as able to view before acceptance", () => {
    expect(boardInvitationStatus(invite, now)).toEqual({ label: "Invited", canView: true });
  });
  it("revocation wins even after a board has been viewed", () => {
    expect(boardInvitationStatus({ ...invite, status: "revoked", last_seen_at: "2026-10-24T00:00:00Z" }, now)).toEqual({ label: "Revoked", canView: false });
  });
  it("expiry wins over acceptance at the exact expiry time", () => {
    expect(boardInvitationStatus({ ...invite, status: "accepted", expires_at: "2026-10-25T07:51:00Z" }, now)).toEqual({ label: "Expired", canView: false });
  });
  it("distinguishes acceptance from a recorded view", () => {
    expect(boardInvitationStatus({ ...invite, status: "accepted" }, now).label).toBe("Accepted");
    expect(boardInvitationStatus({ ...invite, last_seen_at: "2026-10-24T00:00:00Z" }, now).label).toBe("Viewed");
  });
  it("does not confirm access with an invalid expiry", () => {
    expect(boardInvitationStatus({ ...invite, expires_at: "invalid" }, now).canView).toBe(false);
  });
  it("keeps view-only permissions distinct from existing client and contractor access", () => {
    expect(boardInvitationPermission({ view_only: true, role: "client" })).toBe("View only");
    expect(boardInvitationPermission({ view_only: false, role: "client" })).toBe("Can comment / approve");
    expect(boardInvitationPermission({ view_only: false, role: "contractor" })).toBe("Can edit / add pieces");
  });
});