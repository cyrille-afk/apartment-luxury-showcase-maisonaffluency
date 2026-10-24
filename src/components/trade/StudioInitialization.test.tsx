import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioInitialization } from "./StudioInitialization";
const mocks = vi.hoisted(() => ({ writes: [] as Array<{ table: string; values: Record<string, unknown> }>, send: vi.fn(), refresh: vi.fn(), select: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user" }, profile: { company: "Delval Studio" } }) }));
vi.mock("@/hooks/useStudio", () => ({ useStudio: () => ({ currentStudio: { id: "studio", name: "Delval Studio", role: "owner", logo_url: null }, refresh: mocks.refresh, setCurrentStudioId: mocks.select }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.send }, from: (table: string) => {
  const query = { update: (values: Record<string, unknown>) => { mocks.writes.push({ table, values }); return query; }, insert: (values: Record<string, unknown>) => { mocks.writes.push({ table, values }); return query; }, eq: () => query, is: () => query, limit: () => query, select: () => query, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: { id: table === "projects" ? "project" : "invite" }, error: null }) }; return query;
} } }));
beforeEach(() => { mocks.writes.length = 0; vi.clearAllMocks(); mocks.send.mockResolvedValue({ data: { success: true }, error: null }); });
afterEach(cleanup);
describe("studio initialization saves", () => {
  it("creates an active studio-linked project without requiring a logo or invitations", async () => {
    const complete = vi.fn(); render(<StudioInitialization onComplete={complete} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Skip invitations" }));
    fireEvent.change(await screen.findByLabelText("Project folder name"), { target: { value: "New Residential Project" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Studio Dashboard" }));
    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith("project"));
    expect(mocks.writes.find(write => write.table === "projects")?.values).toMatchObject({ name: "New Residential Project", status: "active", studio_id: "studio", user_id: "user" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("retains a saved invitation and its email key when delivery fails and is retried", async () => {
    mocks.send.mockResolvedValueOnce({ data: { success: false }, error: null });
    render(<StudioInitialization onComplete={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(await screen.findByLabelText("Teammate email 1"), { target: { value: "teammate@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitations & Continue" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Send invitations & Continue" }));
    await screen.findByLabelText("Project folder name");
    expect(mocks.writes.filter(write => write.table === "studio_invites")).toHaveLength(1);
    expect(mocks.send.mock.calls[0]?.[1]).toEqual(mocks.send.mock.calls[1]?.[1]);
  });
  it("skipping from the initial overlay writes nothing", () => {
    const skip = vi.fn(); render(<StudioInitialization onComplete={vi.fn()} onSkip={skip} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip to Dashboard" }));
    expect(skip).toHaveBeenCalledOnce(); expect(mocks.writes).toHaveLength(0);
  });
});