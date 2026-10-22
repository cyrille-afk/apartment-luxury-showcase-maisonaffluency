import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioSetupNavigationGate } from "./StudioSetupNavigationGate";
const mocks = vi.hoisted(() => ({ blocker: null as null | ((arg: { next: { pathname: string } }) => boolean), path: "/settings/studio", toast: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useBlocker: (options: { shouldBlockFn: typeof mocks.blocker }) => { mocks.blocker = options.shouldBlockFn; } }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/router-compat", () => ({ useLocation: () => ({ pathname: mocks.path }), useNavigate: () => vi.fn(), Navigate: ({ to }: { to: string }) => <span data-testid="redirect">{to}</span> }));
afterEach(cleanup);
beforeEach(() => { mocks.path = "/settings/studio"; vi.clearAllMocks(); });
describe("studio navigation focus", () => {
  it("blocks Quotes until setup is saved", () => { render(<StudioSetupNavigationGate locked ready>Settings</StudioSetupNavigationGate>); expect(mocks.blocker?.({ next: { pathname: "/trade/quotes" } })).toBe(true); expect(mocks.toast).toHaveBeenCalled(); });
  it("allows studio settings while locked", () => { render(<StudioSetupNavigationGate locked ready>Settings</StudioSetupNavigationGate>); expect(mocks.blocker?.({ next: { pathname: "/settings/studio" } })).toBe(false); });
  it("allows Collection immediately after unlock", () => { render(<StudioSetupNavigationGate locked={false} ready>Settings</StudioSetupNavigationGate>); expect(mocks.blocker?.({ next: { pathname: "/trade/the-collection" } })).toBe(false); });
  it("does not mount direct-linked dashboard features while locked", () => { mocks.path = "/trade/visualiser"; render(<StudioSetupNavigationGate locked ready><span>Room layout</span></StudioSetupNavigationGate>); expect(screen.queryByText("Room layout")).toBeNull(); expect(screen.getByTestId("redirect")).toHaveTextContent("/settings/studio"); });
  it("waits for saved state before mounting features", () => { render(<StudioSetupNavigationGate locked={false} ready={false}><span>Room layout</span></StudioSetupNavigationGate>); expect(screen.queryByText("Room layout")).toBeNull(); });
});
