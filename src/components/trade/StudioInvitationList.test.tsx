import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canResendInvitation, StudioInvitationList, type StudioInvitation } from "./StudioInvitationList";
afterEach(cleanup);
const invite = (status: StudioInvitation["status"]): StudioInvitation => ({ id: status, email: `${status}@example.com`, role: "editor", created_at: "2026-10-24T00:00:00Z", expires_at: "2026-11-07T00:00:00Z", accepted_at: status === "accepted" ? "2026-10-24T01:00:00Z" : null, status, email_status: status === "failed" ? "dlq" : "sent" });
describe("studio invitation actions", () => {
  it("permits failed and pending resends but never accepted invitations", () => {
    expect(canResendInvitation(invite("failed"))).toBe(true);
    expect(canResendInvitation(invite("pending"))).toBe(true);
    expect(canResendInvitation(invite("accepted"))).toBe(false);
  });
  it("resends the exact failed invitation and omits accepted actions", () => {
    const resend = vi.fn();
    render(<StudioInvitationList invites={[invite("pending"), invite("accepted"), invite("failed")]} loading={false} failed={false} sendingId={null} disabled={false} onRefresh={vi.fn()} onResend={resend} onCopy={vi.fn()} onRevoke={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend failed invitation" }));
    expect(resend).toHaveBeenCalledWith(invite("failed"));
    expect(screen.getAllByRole("button", { name: /Resend/ })).toHaveLength(2);
  });
  it("prevents duplicate resends while a send is in flight", () => {
    render(<StudioInvitationList invites={[invite("failed")]} loading={false} failed={false} sendingId="failed" disabled={false} onRefresh={vi.fn()} onResend={vi.fn()} onCopy={vi.fn()} onRevoke={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
});