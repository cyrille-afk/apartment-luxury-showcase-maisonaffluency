import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioSetupNavigationGate } from "./StudioSetupNavigationGate";
const mocks = vi.hoisted(() => ({ blocker: null as null | ((arg: { next: { pathname: string } }) => boolean), path: "/settings/studio", search: "", navigate: vi.fn(), toast: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useBlocker: (options: { shouldBlockFn: typeof mocks.blocker }) => { mocks.blocker = options.shouldBlockFn; } }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/router-compat", () => ({ useLocation: () => ({ pathname: mocks.path, search: mocks.search }), useNavigate: () => mocks.navigate, Navigate: ({ to }: { to: string }) => <span data-testid="redirect">{to}</span> }));
afterEach(cleanup);
beforeEach(() => { mocks.path = "/settings/studio"; mocks.search = ""; vi.clearAllMocks(); });
describe("studio navigation focus", () => {
  it("renders recipient acceptance while setup is locked or still loading", () => {
    mocks.path = "/trade/me"; mocks.search = "?studioInvite=11111111-1111-4111-8111-111111111111";
    render(<StudioSetupNavigationGate locked ready={false}><span>Invitation acceptance</span></StudioSetupNavigationGate>);
    expect(screen.getByText("Invitation acceptance")).toBeInTheDocument();
    expect(screen.queryByTestId("redirect")).toBeNull();
  });
  it.each(["?studioSetup=required", "??studioSetup=required"])("consumes direct-entry reminder marker %s", search => {
    mocks.search = search;
    render(<StudioSetupNavigationGate locked ready>Settings</StudioSetupNavigationGate>);
    expect(mocks.toast).toHaveBeenCalledWith("Felix", expect.objectContaining({ id: "studio-setup-reminder" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/settings/studio", { replace: true });
  });
  it("blocks Quotes until setup is saved", () => { render(<StudioSetupNavigationGate locked ready>Settings</StudioSetupNavigationGate>); expect(mocks.blocker?.({ next: { pathname: "/trade/quotes" } })).toBe(true); expect(mocks.toast).toHaveBeenCalled(); });
  it("allows studio settings while locked", () => { render(<StudioSetupNavigationGate locked ready>Settings</StudioSetupNavigationGate>); expect(mocks.blocker?.({ next: { pathname: "/settings/studio" } })).toBe(false); });
  it("allows Collection immediately after unlock", () => { render(<StudioSetupNavigationGate locked={false} ready>Settings</StudioSetupNavigationGate>); expect(mocks.blocker?.({ next: { pathname: "/trade/the-collection" } })).toBe(false); });
  it("does not mount direct-linked dashboard features while locked", () => { mocks.path = "/trade/visualiser"; render(<StudioSetupNavigationGate locked ready><span>Room layout</span></StudioSetupNavigationGate>); expect(screen.queryByText("Room layout")).toBeNull(); expect(screen.getByTestId("redirect")).toHaveTextContent("/settings/studio"); });
  it("waits for saved state before mounting features", () => { render(<StudioSetupNavigationGate locked={false} ready={false}><span>Room layout</span></StudioSetupNavigationGate>); expect(screen.queryByText("Room layout")).toBeNull(); });
});
