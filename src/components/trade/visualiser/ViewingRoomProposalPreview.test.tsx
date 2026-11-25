import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import ViewingRoomExperience from "./ViewingRoomExperience";
import type { ViewingRoomSlot } from "@/lib/viewingRoom";

const { readChoices, lock, download, exportBlender, downloadBlender } = vi.hoisted(() => ({
  readChoices: vi.fn(),
  lock: vi.fn(),
  download: vi.fn(),
  exportBlender: vi.fn(),
  downloadBlender: vi.fn(),
}));
vi.mock("@/lib/viewingRoom.functions", () => ({ getViewingRoomChoices: readChoices, lockViewingRoomProposal: lock }));
vi.mock("@/lib/viewingRoomBlenderScene.functions", () => ({ exportViewingRoomBlenderScene: exportBlender }));
vi.mock("@/lib/viewingRoomBlenderScene", () => ({ downloadBlenderSceneManifest: downloadBlender }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../Product3DViewer", () => ({ default: () => null }));
vi.mock("@/lib/viewingRoomProposal", () => ({ downloadViewingRoomProposal: download }));

const fabricSwatch = { id: "sw-delft", name: "Opera Delft", category: "Fabric", brand_name: "Kerstens", image_url: "https://example.com/delft.jpg", material_type: "fabric", color_family: "blue" };
const woodSwatch = { id: "sw-elm", name: "Brushed Elm", category: "Wood", brand_name: "Delcourt", image_url: "https://example.com/elm.jpg", material_type: "wood", color_family: "brown" };

const sofaSlot: ViewingRoomSlot = {
  id: "11111111-1111-4111-8111-111111111111",
  product_name: "Sandy Cove Sofa",
  brand_name: "Kerstens",
  category: "Seating",
  subcategory: "Sofas",
  image_url: "https://example.com/sofa.jpg",
  dimensions: "W 240 × D 98 × H 76 cm",
  width_mm: 2400,
  depth_mm: 980,
  height_mm: 760,
  glb_url: null,
  lead_time: "14 weeks",
  materials: { upholstery: fabricSwatch },
  retail_price: 18500,
  retail_price_from: false,
  is_swappable: true,
  allow_finish_customization: true,
  size_options: [],
  finish_options: [],
  alternatives: [],
};

const gumSlot: ViewingRoomSlot = {
  id: "22222222-2222-4222-8222-222222222222",
  product_name: "GUM Armchair",
  brand_name: "Delcourt Collection",
  category: "Seating",
  subcategory: "Armchairs",
  image_url: "https://example.com/gum.jpg",
  dimensions: "W 90 × D 88 × H 75 cm",
  width_mm: 900,
  depth_mm: 880,
  height_mm: 750,
  glb_url: null,
  lead_time: "16 weeks",
  materials: { upholstery: fabricSwatch, base: woodSwatch },
  retail_price: 9500,
  retail_price_from: false,
  is_swappable: true,
  allow_finish_customization: true,
  size_options: [],
  finish_options: [{
    key: "gum-tundra",
    label: "Opera / Tundra / Brushed Elm",
    retail_price: 9500,
    materials: { upholstery: fabricSwatch, base: woodSwatch },
    colourways: [],
    axes: [
      { role: "seat", label: "Seat upholstery", value: "Opera", colours: [fabricSwatch] },
      { role: "backrest", label: "Backrest upholstery", value: "Tundra leather range", colours: [] },
      { role: "frame", label: "Frame finish", value: "Brushed Elm", colours: [woodSwatch] },
    ],
    image_url: null,
    lead_time: null,
  }],
  alternatives: [],
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

function mount(slots: ViewingRoomSlot[], tierName = "Signature", canExportBlenderScene = false) {
  readChoices.mockResolvedValue({ items: slots, allow_alternatives: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ViewingRoomExperience token="cipriani" packageId="pkg-sig" tierName={tierName} baseTotal={350000} currency="USD" residence="2-Bedroom Residence" developer="Cipriani Residences Miami" canExportBlenderScene={canExportBlenderScene} onTotal={() => {}} />
    </QueryClientProvider>,
  );
}

describe("Proposal preview step before locking", () => {
  it("previews tier, pieces, finishes, and live total without locking until confirmed", async () => {
    lock.mockResolvedValue({ package: "Signature", currency: "USD", total: 350000, items: [sofaSlot, gumSlot] });
    download.mockResolvedValue(undefined);
    mount([sofaSlot, gumSlot]);
    await screen.findByRole("button", { name: "Review & Lock Proposal" });

    fireEvent.click(screen.getByRole("button", { name: "Review & Lock Proposal" }));
    const dialog = await screen.findByRole("dialog");
    expect(lock).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("heading", { name: "Signature Collection" })).toBeInTheDocument();
    expect(within(dialog).getByText(/2-Bedroom Residence · Cipriani Residences Miami · 2 pieces/)).toBeInTheDocument();
    expect(within(dialog).getByRole("article", { name: "Sandy Cove Sofa" })).toBeInTheDocument();
    expect(within(dialog).getByRole("article", { name: "GUM Armchair" })).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Opera Delft/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Tundra leather range \(colour on request\)/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Preview Collection Total")).toHaveTextContent("350,000.00");

    fireEvent.click(within(dialog).getByRole("button", { name: "Back to Collection" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(lock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Review & Lock Proposal" }));
    const confirmDialog = await screen.findByRole("dialog");
    fireEvent.change(within(confirmDialog).getByLabelText("Client name (optional)"), { target: { value: "  Elena Rossi  " } });
    fireEvent.change(within(confirmDialog).getByLabelText("Project notes (optional)"), { target: { value: "Prefer warm oak tones for Q4 move-in." } });
    expect(within(confirmDialog).getByText("Prepared for Elena Rossi")).toBeInTheDocument();
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Lock & Download Proposal" }));
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ package: "Signature" }),
      "2-Bedroom Residence",
      "Cipriani Residences Miami",
      expect.objectContaining({ clientName: "  Elena Rossi  ", projectNotes: "Prefer warm oak tones for Q4 move-in." }),
    ));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Download Locked Proposal" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export Blender Scene JSON" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Stage in Visualiser" })).not.toBeInTheDocument();
  });

  it("shows Export Blender Scene JSON only to admins after locking and downloads the manifest", async () => {
    const manifest = {
      schema_version: 1,
      exported_at: "2026-11-24T13:00:00.000Z",
      proposal_id: "prop-1",
      locked_at: "2026-11-24T12:55:00.000Z",
      package_tier: "Signature",
      residence_layout: { name: "2-Bedroom Residence", floorplan_url: "https://example.com/plan.png" },
      items: [],
    };
    lock.mockResolvedValue({
      package: "Signature",
      currency: "USD",
      total: 350000,
      items: [sofaSlot, gumSlot],
      proposal_id: "7ce69b58-fff5-42a7-b7ee-ecccb2baa50a",
    });
    download.mockResolvedValue(undefined);
    exportBlender.mockResolvedValue(manifest);
    mount([sofaSlot, gumSlot], "Signature", true);

    await screen.findByRole("button", { name: "Review & Lock Proposal" });
    expect(screen.queryByRole("button", { name: "Export Blender Scene JSON" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review & Lock Proposal" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Export Blender Scene JSON" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Lock & Download Proposal" }));

    const exportButton = await screen.findByRole("button", { name: "Export Blender Scene JSON" });
    const stageLink = screen.getByRole("link", { name: "Stage in Visualiser" });
    expect(stageLink).toHaveAttribute("href", "/trade/visualiser?proposalId=7ce69b58-fff5-42a7-b7ee-ecccb2baa50a");
    fireEvent.click(exportButton);
    await waitFor(() => expect(exportBlender).toHaveBeenCalledWith({
      data: { packageId: "pkg-sig", requestKey: expect.any(String) },
    }));
    expect(downloadBlender).toHaveBeenCalledWith(manifest);
    expect(await screen.findByText("Blender scene JSON downloaded.")).toBeInTheDocument();
  });

  it("allows locking when a piece is awaiting price confirmation, noting the exclusion", async () => {
    const unpricedSofa = { ...sofaSlot, retail_price: null };
    lock.mockResolvedValue({ package: "Essential", currency: "USD", total: 350000, items: [unpricedSofa] });
    download.mockResolvedValue(undefined);
    mount([unpricedSofa], "Essential");
    await screen.findByRole("button", { name: "Review & Lock Proposal" });
    fireEvent.click(screen.getByRole("button", { name: "Review & Lock Proposal" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Essential Collection" })).toBeInTheDocument();
    expect(within(dialog).getByText("Price to be confirmed")).toBeInTheDocument();
    expect(within(dialog).getByText(/excluded from the total/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Lock & Download Proposal" });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(download).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Download Locked Proposal" })).toBeInTheDocument();
  });
});