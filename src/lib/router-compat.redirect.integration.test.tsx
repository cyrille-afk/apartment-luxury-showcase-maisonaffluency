import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { Link, Navigate } from "./router-compat";

afterEach(cleanup);
describe("Navigate repeat visits", () => {
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