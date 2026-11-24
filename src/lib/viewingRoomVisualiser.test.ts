import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildVisualiserProposalStaging,
  sharedProposalPath,
  visualiserProposalPath,
  type VisualiserProposalPayload,
} from "./viewingRoomVisualiser";

const { setResponseHeaderMock } = vi.hoisted(() => ({ setResponseHeaderMock: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain: Record<string, unknown> = {};
    chain["middleware"] = () => chain;
    chain["inputValidator"] = () => chain;
    chain["handler"] = (fn: unknown) => fn;
    return chain;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: setResponseHeaderMock }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { getViewingRoomProposalForVisualiser, publishVisualiserToProposal } from "./viewingRoomVisualiser.functions";

const fabricSwatch = {
  id: "sw-delft",
  name: "Opera Delft",
  category: "Fabric",
  brand_name: "Kerstens",
  image_url: "https://res.cloudinary.com/demo/delft.jpg",
  material_type: "Fabric",
  color_family: "blue",
};
const leatherSwatch = {
  id: "sw-tundra",
  name: "Tundra Cognac",
  category: "Leather",
  brand_name: "Delcourt",
  image_url: "https://res.cloudinary.com/demo/tundra.jpg",
  material_type: "Leather",
  color_family: "brown",
};
const woodSwatch = {
  id: "sw-oak",
  name: "Ebonized Oak",
  category: "Wood",
  brand_name: "Kerstens",
  image_url: "https://res.cloudinary.com/demo/oak.jpg",
  material_type: "Wood",
  color_family: "black",
};

const samplePayload: VisualiserProposalPayload = {
  proposalId: "7ce69b58-fff5-42a7-b7ee-ecccb2baa50a",
  projectId: "f6068253-c046-44f6-a29d-2efe2fedfb31",
  developerName: "Cipriani Residences Miami",
  tierName: "Bespoke",
  currency: "USD",
  total: 700505.66,
  lockedAt: "2026-11-24T06:50:13.000Z",
  shareToken: "0123456789abcdef0123456789abcdef",
  axonometricRenderUrl: null,
  walkthroughUrl: null,
  walkthroughLayoutId: null,
  visualiserPublishedAt: null,
  layout: {
    id: "layout-1",
    name: "2-Bedroom Residence",
    floorplan_url: "https://res.cloudinary.com/demo/floorplan.png",
    specs_label: "2 Bed · 1,850 sq ft",
  },
  items: [
    {
      id: "slot-gum",
      slot_id: "slot-gum",
      product_id: "prod-gum",
      product_name: "GUM Armchair",
      brand_name: "Delcourt Collection",
      category: "Seating",
      subcategory: "Armchairs",
      image_url: "https://res.cloudinary.com/demo/gum.jpg",
      dimensions: "W 90 × D 77 × H 75 cm",
      width_mm: 900,
      depth_mm: 770,
      height_mm: 750,
      glb_url: "https://assets.example/gum.glb",
      material_roles: { seat_mesh: "fabric", back_mesh: "backrest", legs_mesh: "base" },
      lead_time: "16 weeks",
      materials: { upholstery: fabricSwatch, backrest: leatherSwatch, base: woodSwatch },
      retail_price: 9500,
      retail_price_from: false,
      finish_options: [],
      size_options: [],
    },
  ],
};

describe("buildVisualiserProposalStaging", () => {
  it("pre-loads the residence floor plan and locked pieces with selected finishes across 2D, Sandbox, and Walkthrough", () => {
    const staged = buildVisualiserProposalStaging(samplePayload);

    expect(staged.floorPlanUrl).toBe("https://res.cloudinary.com/demo/floorplan.png");
    expect(visualiserProposalPath(samplePayload.proposalId)).toBe("/trade/visualiser?proposalId=7ce69b58-fff5-42a7-b7ee-ecccb2baa50a");
    expect(sharedProposalPath(samplePayload.shareToken)).toBe("/viewing-room/proposal/0123456789abcdef0123456789abcdef");

    expect(staged.objects).toHaveLength(1);
    expect(staged.objects[0]).toMatchObject({
      id: "prod-gum",
      product_name: "GUM Armchair",
      glb_url: "https://assets.example/gum.glb",
      selectedUpholstery: "Opera Delft",
      selectedFrameFinish: "Ebonized Oak",
      savedMaterialRoles: { seat_mesh: "upholstery", back_mesh: "backrest", legs_mesh: "frame" },
    });
    expect(staged.objects[0]?.partMaterials?.["backrest"]?.name).toBe("Tundra Cognac");

    expect(staged.sharedRoomLayout.source).toBe("visualiser");
    expect(staged.sharedRoomLayout.items).toHaveLength(1);
    const appearance = staged.sharedRoomLayout.items[0]?.appearance as {
      upholsteryMaterial?: { name?: string };
      partMaterials?: Record<string, { name?: string } | null>;
    } | undefined;
    expect(appearance?.upholsteryMaterial?.name).toBe("Opera Delft");
    expect(appearance?.partMaterials?.["backrest"]?.name).toBe("Tundra Cognac");
  });
});

describe("viewingRoomVisualiser server admin checks", () => {
  beforeEach(() => { setResponseHeaderMock.mockReset(); });

  it("blocks non-admins from staging or publishing proposal visuals", async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const getHandler = getViewingRoomProposalForVisualiser as unknown as (args: {
      data: { proposalId: string };
      context: { userId: string; supabase: { rpc: typeof rpc; from: typeof from } };
    }) => Promise<unknown>;
    const pubHandler = publishVisualiserToProposal as unknown as (args: {
      data: { proposalId: string; axonometricRenderUrl?: string; walkthroughUrl?: string };
      context: { userId: string; supabase: { rpc: typeof rpc; from: typeof from } };
    }) => Promise<unknown>;

    await expect(getHandler({
      data: { proposalId: samplePayload.proposalId },
      context: { userId: "buyer", supabase: { rpc, from } },
    })).rejects.toThrow("Admin access required.");
    await expect(pubHandler({
      data: { proposalId: samplePayload.proposalId, axonometricRenderUrl: "https://example.com/axo.png" },
      context: { userId: "buyer", supabase: { rpc, from } },
    })).rejects.toThrow("Admin access required.");
    expect(from).not.toHaveBeenCalled();
  });

  it("patches only the published visual field without wiping the sibling asset", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: samplePayload.proposalId,
        share_token: samplePayload.shareToken,
        axonometric_render_url: "https://example.com/axo.png",
        walkthrough_url: "https://maisonaffluency.com/layout/existing",
        walkthrough_layout_id: null,
        visualiser_published_at: "2026-11-24T14:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    const pubHandler = publishVisualiserToProposal as unknown as (args: {
      data: { proposalId: string; axonometricRenderUrl?: string };
      context: { userId: string; supabase: { rpc: typeof rpc; from: typeof from } };
    }) => Promise<{ axonometricRenderUrl: string | null; walkthroughUrl: string | null }>;

    const res = await pubHandler({
      data: { proposalId: samplePayload.proposalId, axonometricRenderUrl: "https://example.com/axo.png" },
      context: { userId: "admin-1", supabase: { rpc, from } },
    });
    const sentPatch = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sentPatch["axonometric_render_url"]).toBe("https://example.com/axo.png");
    expect("walkthrough_url" in sentPatch).toBe(false);
    expect(res.walkthroughUrl).toBe("https://maisonaffluency.com/layout/existing");
  });
});