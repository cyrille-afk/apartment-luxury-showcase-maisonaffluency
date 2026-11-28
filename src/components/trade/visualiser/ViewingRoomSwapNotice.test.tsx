import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import ViewingRoomExperience from "./ViewingRoomExperience";
import { VIEWING_ROOM_SWAP_NOTICE_BODY, VIEWING_ROOM_SWAP_NOTICE_TITLE } from "./ViewingRoomSwapNotice";

const { readChoices, lock } = vi.hoisted(() => ({ readChoices: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/viewingRoom.functions", () => ({ getViewingRoomChoices: readChoices, lockViewingRoomProposal: lock, getResidenceRoomRenders: async () => [], getResidenceVisualizationShells: vi.fn(), generateResidenceVisualization: vi.fn() }));
vi.mock("@/lib/viewingRoomBlenderScene.functions", () => ({ exportViewingRoomBlenderScene: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../Product3DViewer", () => ({ default: () => null }));
vi.mock("@/lib/viewingRoomProposal", () => ({ downloadViewingRoomProposal: vi.fn() }));

const base = { category: null, subcategory: null, image_url: null, dimensions: "W 140 cm", width_mm: 1400, depth_mm: 400, height_mm: 800, glb_url: null, lead_time: null, materials: {}, retail_price: 1000, retail_price_from: false, size_options: [], finish_options: [] };
const slot = (id: string, product_name: string, swappable: boolean) => ({ ...base, id, product_name, alternatives: [], is_swappable: swappable, allow_finish_customization: true });

const open = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ViewingRoomExperience token="room" packageId="package" baseTotal={150000} currency="USD" residence="Residence" developer="Developer" onTotal={() => {}} /></QueryClientProvider>);
  return screen.findByText("Console A");
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("explains the reload and republish rule when a piece cannot be swapped", async () => {
  readChoices.mockResolvedValue({ items: [slot("a", "Console A", true), slot("b", "Console B", false)], allow_alternatives: true });
  await open();
  const notice = await screen.findByText(VIEWING_ROOM_SWAP_NOTICE_TITLE);
  expect(notice).toBeInTheDocument();
  expect(screen.getByText(VIEWING_ROOM_SWAP_NOTICE_BODY)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Materials and finishes for Console B" }));
  const tab = await screen.findByRole("tab", { name: "Curated Alternatives" });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("This piece is part of the fixed collection.")).toBeInTheDocument();
  expect(screen.getAllByText(VIEWING_ROOM_SWAP_NOTICE_TITLE).length).toBe(2);
  expect(screen.getAllByText(VIEWING_ROOM_SWAP_NOTICE_BODY).length).toBe(2);
});

it("stays out of the way when every piece in the collection can be swapped", async () => {
  readChoices.mockResolvedValue({ items: [slot("a", "Console A", true), slot("b", "Console B", true)], allow_alternatives: true });
  await open();
  expect(screen.queryByText(VIEWING_ROOM_SWAP_NOTICE_TITLE)).not.toBeInTheDocument();
  expect(screen.queryByText(VIEWING_ROOM_SWAP_NOTICE_BODY)).not.toBeInTheDocument();
});

it("does not claim stale permissions while recommendations are unavailable", async () => {
  readChoices.mockRejectedValue(new Error("offline"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ViewingRoomExperience token="room" packageId="package" baseTotal={150000} currency="USD" residence="Residence" developer="Developer" onTotal={() => {}} fallbackItems={[{ ...base, id: "a", product_name: "Console A" }]} /></QueryClientProvider>);
  expect(await screen.findByText("Recommendations are temporarily unavailable")).toBeInTheDocument();
  expect(screen.queryByText(VIEWING_ROOM_SWAP_NOTICE_TITLE)).not.toBeInTheDocument();
});
