import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PendingInvitesBanner } from "./PendingInvitesBanner";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn(), select: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "member", email: "member@example.com" } }) }));
vi.mock("@/hooks/useStudio", () => ({ useStudio: () => ({ refresh: mocks.refresh, setCurrentStudioId: mocks.select }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/router-compat", () => ({ useSearchParams: () => [new URLSearchParams()] }));
vi.mock("@/contexts/RealtimeMultiplexerContext", () => ({ useRealtimeTables: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
const invitation = { id: "invite", studio_id: "stale-studio", studio_name: "Member Studio", role: "viewer", is_expired: false, expires_at: null };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockImplementation(async (name: string) => name === "get_my_pending_invites" ? { data: [invitation], error: null } : { data: { studio_id: "saved-studio", role: "editor" }, error: null }); });
afterEach(cleanup);

describe("explicit studio invitation acceptance", () => {
  it("does not accept on load and selects the server-confirmed studio and role after Accept", async () => {
    render(<PendingInvitesBanner />);
    const accept = await screen.findByRole("button", { name: "Accept" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("accept_studio_invite", expect.anything());
    fireEvent.click(accept);
    await vi.waitFor(() => expect(mocks.select).toHaveBeenCalledWith("saved-studio"));
    expect(mocks.rpc).toHaveBeenCalledWith("accept_studio_invite", { _invite_id: "invite" });
    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Joined studio", description: "You're now a Editor of Member Studio." })));
  });
  it("does not announce membership or select a studio when acceptance is refused", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "get_my_pending_invites" ? { data: [invitation], error: null } : { data: null, error: new Error("Invitation has expired") });
    render(<PendingInvitesBanner />); fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Could not accept invitation" })));
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("offers retry after an invitation lookup failure rather than treating it as no invitations", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("offline") });
    render(<PendingInvitesBanner />); fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: "Accept" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});