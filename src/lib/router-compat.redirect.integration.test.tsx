import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { Link, Navigate, useLocation } from "./router-compat";
import { isTradeLoginPath, tradeLoginHref } from "./tradeLoginReturn";

afterEach(cleanup);
describe("Navigate repeat visits", () => {
  it("finishes protected-page sign-in navigation without wrapping the pending login URL", async () => {
    function SignedOutLayout() {
      const location = useLocation();
      if (isTradeLoginPath(location.pathname)) return null;
      return <Navigate to={tradeLoginHref(location.pathname, location.search)} replace />;
    }
    function Login() {
      const location = useLocation();
      return <h1>Sign in {location.search}</h1>;
    }
    const root = createRootRoute({ component: Outlet });
    const trade = createRoute({ getParentRoute: () => root, path: "/trade", component: SignedOutLayout });
    const protectedPage = createRoute({ getParentRoute: () => trade, path: "projects", component: () => <h1>Projects</h1> });
    const login = createRoute({ getParentRoute: () => root, path: "/trade/login", component: Login });
    const router = createRouter({ routeTree: root.addChildren([trade.addChildren([protectedPage]), login]), history: createMemoryHistory({ initialEntries: ["/trade/projects?room=living"] }), defaultPendingMinMs: 0 });
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Sign in ?next=%2Ftrade%2Fprojects%3Froom%3Dliving" });
    expect(router.state.location.href).toBe("/trade/login?next=%2Ftrade%2Fprojects%3Froom%3Dliving");
    expect(router.state.status).toBe("idle");
  });
  it("opens the same redirected product immediately after returning to its referring page", async () => {
    const root = createRootRoute({ component: Outlet });
    const home = createRoute({ getParentRoute: () => root, path: "/", component: () => <Link to="/public-piece">Open piece</Link> });
    const source = createRoute({ getParentRoute: () => root, path: "/public-piece", component: () => <Navigate to="/trade-piece" replace /> });
    const target = createRoute({ getParentRoute: () => root, path: "/trade-piece", component: () => <h1>Trade piece</h1> });
    const router = createRouter({ routeTree: root.addChildren([home, source, target]), history: createMemoryHistory({ initialEntries: ["/"] }), defaultPendingMinMs: 0 });
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("link", { name: "Open piece" }));
    await screen.findByRole("heading", { name: "Trade piece" });
    router.history.back();
    fireEvent.click(await screen.findByRole("link", { name: "Open piece" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/trade-piece"), { timeout: 1500 });
    expect(screen.getByRole("heading", { name: "Trade piece" })).toBeVisible();
  });
});