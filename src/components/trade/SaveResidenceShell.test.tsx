import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import SaveResidenceShell from "./SaveResidenceShell";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/residenceShells.functions", () => ({ listResidenceShellLayouts: mocks.list, saveResidenceShell: mocks.save }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each(["shell", "proposal"])("saves the explicitly selected %s image to the chosen residence", async view => {
  mocks.list.mockResolvedValue([{ id: "residence-one", name: "Bayfront", floorplan_url: null }]);
  mocks.save.mockResolvedValue({ saved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SaveResidenceShell url="https://example.com/empty.jpg" proposalUrl="https://example.com/staged.jpg" disabled={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Save to Residence Viewing Room" }));
  if (view === "proposal") {
    fireEvent.click(screen.getByRole("combobox", { name: "View to save" }));
    fireEvent.click(await screen.findByRole("option", { name: "Staged Eye-Level Proposal" }));
  }
  await waitFor(() => expect(mocks.list).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("combobox", { name: "Residence floor plan" }));
  fireEvent.click(await screen.findByRole("option", { name: /Bayfront/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Camera angle name" }), { target: { value: "Living Room View" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Residence View" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ data: { layoutId: "residence-one", shell: { label: "Living Room View", url: view === "proposal" ? "https://example.com/staged.jpg" : "https://example.com/empty.jpg" } } }));
  expect(await screen.findByRole("status")).toHaveTextContent("Saved to Bayfront.");
});