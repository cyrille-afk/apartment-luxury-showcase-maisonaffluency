import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import ViewingRoomExperience from "./ViewingRoomExperience";
const { readChoices, lock } = vi.hoisted(() => ({ readChoices: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/viewingRoom.functions", () => ({ getViewingRoomChoices: readChoices, lockViewingRoomProposal: lock }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../Product3DViewer", () => ({ default: () => null }));
vi.mock("@/lib/viewingRoomProposal", () => ({ downloadViewingRoomProposal: vi.fn() }));
const base = { id: "sofa", product_name: "Original Sofa", category: null, subcategory: null, image_url: null, dimensions: "W 190 cm", width_mm: 1900, depth_mm: 900, height_mm: 800, glb_url: null, lead_time: null, materials: {}, retail_price: 10000, retail_price_from: false, size_options: [{ key: "250", label: "W 250 cm" }], finish_options: [{ key: "velvet-250", size_key: "250", label: "Velvet", dimensions: "W 250 cm", retail_price: 12500, materials: {}, image_url: null, lead_time: null }] };
const alternative = { ...base, id: "alternative", product_name: "Alternative Sofa", retail_price: 9000, size_options: [], finish_options: [] };
const second = { ...alternative, id: "second", product_name: "Second Sofa", retail_price: 8000 };
const slot = { ...base, alternatives: [alternative, second], is_swappable: true, allow_finish_customization: true };
afterEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState({}, "", "/"); });
async function mount() {
  readChoices.mockResolvedValue({ items: [slot], allow_alternatives: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ViewingRoomExperience token="room" packageId="package" baseTotal={150000} currency="USD" residence="Residence" developer="Developer" onTotal={() => {}} /></QueryClientProvider>);
  await screen.findByRole("button", { name: "Swap piece — Original Sofa", hidden: true });
}
async function selectAlternative(name: string) {
  const tab = screen.getByRole("tab", { name: "Curated Alternatives" });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
  const heading = await within(screen.getByRole("dialog")).findByRole("heading", { name, level: 3 });
  const article = heading.closest("article");
  if (!article) throw new Error("Alternative absent");
  fireEvent.click(within(article).getByRole("button", { name: "Select Alternative" }));
}
it("restores the QR upholstery and size as a private-room preview without changing the collection or locking", async () => {
  const handoff = { kind: "viewing-room", id: "sofa", context: "package", product: "sofa", size: "250", finish: "velvet-250" };
  window.history.replaceState({}, "", `/?arPreview=${encodeURIComponent(JSON.stringify(handoff))}`);
  await mount();
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Upholstery" })).toHaveTextContent("Velvet"));
  expect(screen.getByRole("combobox", { name: "Sofa size" })).toHaveTextContent("W 250 cm");
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("150,000.00");
  expect(lock).not.toHaveBeenCalled();
});
it("restores the previous sofa's exact size, finish and retail total", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Materials and finishes for Original Sofa" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Sofa size" }));
  fireEvent.click(await screen.findByRole("option", { name: "W 250 cm" }));
  fireEvent.click(screen.getByRole("button", { name: "UPDATE SELECTION" }));
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("152,500.00");
  fireEvent.click(screen.getByRole("button", { name: "Swap piece — Original Sofa" }));
  await selectAlternative("Alternative Sofa");
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("149,000.00");
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Undo swap — restore Original Sofa" }));
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("152,500.00");
  expect(screen.getByRole("combobox", { name: "Sofa size" })).toHaveTextContent("W 250 cm");
  expect(screen.getByRole("combobox", { name: "Upholstery" })).toHaveTextContent("Velvet");
});
it("restores the immediately previous alternative, not always the original piece", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Swap piece — Original Sofa" }));
  await selectAlternative("Alternative Sofa");
  await selectAlternative("Second Sofa");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo swap — restore Alternative Sofa" }));
  expect(screen.getByRole("article", { name: "Alternative Sofa" })).toBeInTheDocument();
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("149,000.00");
  expect(screen.queryByRole("button", { name: /Undo swap/ })).not.toBeInTheDocument();
});
it("does not allow undo after the proposal locks", async () => {
  lock.mockResolvedValue({ items: [] });
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Swap piece — Original Sofa" }));
  await selectAlternative("Alternative Sofa");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Review & Lock Proposal" }));
  expect(lock).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lock & Download Proposal" }));
  await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("button", { name: /Undo swap/ })).not.toBeInTheDocument());
  expect(screen.getByLabelText("Collection Total")).toHaveTextContent("149,000.00");
});