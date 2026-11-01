import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { Link, useLocation, useSearchParams } from "./router-compat";

afterEach(cleanup);

describe("directory navigation ownership", () => {
  it("retains directory location and facets until a delayed profile commits", async () => {
    let finishLoading: (() => void) | undefined;
    const loading = new Promise<void>((resolve) => { finishLoading = resolve; });
    function Directory() {
      const location = useLocation();
      const [params] = useSearchParams();
      return <><output data-testid="directory-state">{location.pathname}|{params.get("country")}</output><Link to="/designers/apparatus-studio">Apparatus</Link></>;
    }
    function Shell() {
      const location = useLocation();
      return <><output data-testid="shell-path">{location.pathname}</output><Outlet /></>;
    }
    const root = createRootRoute({ component: Shell });
    const directory = createRoute({ getParentRoute: () => root, path: "/designers", component: Directory });
    const profile = createRoute({ getParentRoute: () => root, path: "/designers/$slug", loader: () => loading, component: () => <h1>Apparatus profile</h1> });
    const router = createRouter({ routeTree: root.addChildren([directory, profile]), history: createMemoryHistory({ initialEntries: ["/designers?country=Italy"] }), defaultPendingMs: 10000, defaultPendingMinMs: 0 });
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("link", { name: "Apparatus" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/designers/apparatus-studio"));
    expect(screen.getByTestId("directory-state")).toHaveTextContent("/designers|Italy");
    expect(screen.getByTestId("shell-path")).toHaveTextContent(/^\/designers$/);
    await act(async () => { finishLoading?.(); });
    await screen.findByRole("heading", { name: "Apparatus profile" });
    expect(screen.getByTestId("shell-path")).toHaveTextContent("/designers/apparatus-studio");
  });

  it("still applies same-directory filter changes immediately", async () => {
    function Directory() {
      const [params, setParams] = useSearchParams();
      return <><output data-testid="country">{params.get("country")}</output><button onClick={() => setParams({ country: "France" })}>Filter</button></>;
    }
    const root = createRootRoute({ component: Outlet });
    const directory = createRoute({ getParentRoute: () => root, path: "/designers", component: Directory });
    const router = createRouter({ routeTree: root.addChildren([directory]), history: createMemoryHistory({ initialEntries: ["/designers?country=Italy"] }) });
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("button", { name: "Filter" }));
    await waitFor(() => expect(screen.getByTestId("country")).toHaveTextContent("France"));
  });
});