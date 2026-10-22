import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TradeCopilotOnboarding, { canAdvanceOnboarding } from "./TradeCopilotOnboarding";

const mocks = vi.hoisted(() => ({ writes: [] as Array<{ table: string; values: any }>, setupComplete: true, failProfile: false, refresh: vi.fn(), roles: vi.fn(), selectStudio: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/router-compat", () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({ pathname: "/trade/settings" }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user" }, profile: { company: "Example Studio", has_seen_trade_intro: false }, loading: false, isTradeUser: true, refreshRoles: mocks.roles }) }));
vi.mock("@/hooks/useStudio", () => ({ useStudio: () => ({ currentStudio: { id: "studio", name: "Example Studio", logo_url: null }, loading: false, studioSetupLoading: false, isStudioSetupComplete: mocks.setupComplete, refresh: mocks.refresh, setCurrentStudioId: mocks.selectStudio }) }));
vi.mock("@/components/trade/conciergeGreeting", () => ({ DEFAULT_NAME: "Felix", sanitizeName: (s: string) => s, saveName: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const q: any = { update: (values: any) => { mocks.writes.push({ table, values }); return q; }, insert: (values: any) => { mocks.writes.push({ table, values }); return q; }, eq: () => q, select: () => q, single: async () => ({ data: { id: table === "projects" ? "project" : "studio" }, error: table === "profiles" && mocks.failProfile ? { message: "offline" } : null }) };
  return q;
} } }));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mocks.writes.length = 0; mocks.failProfile = false; mocks.setupComplete = true; vi.clearAllMocks(); });
afterEach(cleanup);
describe("inline trade onboarding setup", () => {
  it("requires a nonblank studio name at step 3", () => {
    expect(canAdvanceOnboarding(3, "  ", "Hamptons Project")).toBe(false);
    expect(canAdvanceOnboarding(3, "Example Studio", "")).toBe(true);
  });
  it("requires a nonblank project name at step 4", () => {
    expect(canAdvanceOnboarding(4, "Example Studio", " \n ")).toBe(false);
    expect(canAdvanceOnboarding(4, "Example Studio", "Singapore GCB Workflow")).toBe(true);
  });
  it("prefills studio, prevents empty navigation and saves both states before completing", async () => {
    render(<TradeCopilotOnboarding />);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const studio = screen.getByLabelText("Studio Name");
    expect(studio).toHaveValue("Example Studio");
    fireEvent.change(studio, { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(studio, { target: { value: "Hamptons Studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Let’s Go" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Name your first project folder/), { target: { value: " Hamptons Project " } });
    fireEvent.click(screen.getByRole("button", { name: "Let’s Go" }));
    await screen.findByRole("button", { name: "Open project folder" });
    expect(mocks.writes.find(w => w.table === "studios")?.values.name).toBe("Hamptons Studio");
    expect(mocks.writes.find(w => w.table === "projects")?.values).toMatchObject({ name: "Hamptons Project", user_id: "user", studio_id: "studio" });
    expect(localStorage.getItem("ma:copilot-onboarded")).toBe("1");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/settings/studio", { replace: true });
    fireEvent.click(screen.getByRole("button", { name: "Open project folder" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith("/trade/projects/project");
    expect(sessionStorage.getItem("ma:onboarding-project:user")).toBeNull();
  });
  it("keeps the tour open on failure and reuses the saved folder on retry", async () => {
    mocks.failProfile = true;
    render(<TradeCopilotOnboarding />);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText(/Name your first project folder/), { target: { value: "Singapore GCB Workflow" } });
    fireEvent.click(screen.getByRole("button", { name: "Let’s Go" }));
    await screen.findByRole("alert");
    expect(localStorage.getItem("ma:copilot-onboarded")).toBeNull();
    mocks.failProfile = false;
    fireEvent.click(screen.getByRole("button", { name: "Let’s Go" }));
    await screen.findByRole("button", { name: "Open project folder" });
    expect(mocks.writes.filter(w => w.table === "projects")[1]?.values).toEqual({ name: "Singapore GCB Workflow" });
  });
  it("defers the exact saved-folder shortcut until Studio Setup is saved, including after remount", async () => {
    mocks.setupComplete = false;
    localStorage.setItem("ma:copilot-onboarded", "1");
    sessionStorage.setItem("ma:onboarding-project:user", JSON.stringify({ id: "first-project", name: "Hamptons Project" }));
    const view = render(<TradeCopilotOnboarding />);
    expect(await screen.findByRole("button", { name: "Open project folder" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Complete Studio Setup" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    view.unmount();
    const restored = render(<TradeCopilotOnboarding />);
    expect(screen.queryByRole("dialog")).toBeNull();
    mocks.setupComplete = true;
    restored.rerender(<TradeCopilotOnboarding />);
    fireEvent.click(await screen.findByRole("button", { name: "Open project folder" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith("/trade/projects/first-project");
    expect(mocks.writes).toHaveLength(0);
  });
});