import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import ViewingRoomExperience from "./ViewingRoomExperience";

const { readChoices } = vi.hoisted(() => ({ readChoices: vi.fn() }));
vi.mock("@/lib/viewingRoom.functions", () => ({ getViewingRoomChoices: readChoices, lockViewingRoomProposal: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../Product3DViewer", () => ({ default: () => null }));
vi.mock("@/lib/viewingRoomProposal", () => ({ downloadViewingRoomProposal: vi.fn() }));
const item = { id: "sofa", product_name: "Saved Sofa", category: null, subcategory: null, image_url: null, dimensions: "W 190 cm", width_mm: 1900, depth_mm: 900, height_mm: 800, glb_url: null, lead_time: null, materials: {} };
const slot = { ...item, retail_price: 10000, retail_price_from: false, finish_options: [{ key: "velvet", label: "Velvet", retail_price: 12500, materials: {}, image_url: null, lead_time: null }], size_options: [], alternatives: [], is_swappable: true, allow_finish_customization: true };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ViewingRoomExperience token="room" packageId="package" baseTotal={150000} currency="USD" residence="Residence" developer="Developer" fallbackItems={[item]} onTotal={() => {}} /></QueryClientProvider>);
  return client;
}
it("keeps original pieces inspectable without permitting unconfirmed changes or prices, then recovers", async () => {
  readChoices.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ items: [slot], allow_alternatives: true });
  mount();
  await waitFor(() => expect(readChoices).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry recommendations" })).toBeEnabled());
  expect(screen.getByRole("article", { name: "Saved Sofa" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Review & Lock Proposal" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Materials and finishes for Saved Sofa" }));
  expect(screen.queryByRole("button", { name: "UPDATE SELECTION" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Retry recommendations" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Review & Lock Proposal" })).toBeEnabled());
  expect(readChoices).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("150,000.00");
});
it("retains a committed finish and total through a failed refresh and successful retry", async () => {
  readChoices.mockResolvedValueOnce({ items: [slot], allow_alternatives: true }).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ items: [slot], allow_alternatives: true });
  const client = mount();
  await screen.findByRole("button", { name: "Swap piece — Saved Sofa" });
  fireEvent.click(screen.getByRole("button", { name: "Materials and finishes for Saved Sofa" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Upholstery" }));
  fireEvent.click(await screen.findByRole("option", { name: /Velvet/ }));
  fireEvent.click(screen.getByRole("button", { name: "UPDATE SELECTION" }));
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("152,500.00");
  await client.refetchQueries({ queryKey: ["viewing-room-choices", "room", "package"] });
  await screen.findByRole("button", { name: "Retry recommendations" });
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("152,500.00");
  fireEvent.click(screen.getByRole("button", { name: "Retry recommendations" }));
  await waitFor(() => expect(readChoices).toHaveBeenCalledTimes(3));
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("152,500.00");
});