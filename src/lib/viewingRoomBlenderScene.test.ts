import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  blenderSceneFilename,
  buildBlenderSceneManifest,
  type LockedProposalItemSnapshot,
} from "./viewingRoomBlenderScene";

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

import { exportViewingRoomBlenderScene } from "./viewingRoomBlenderScene.functions";

const stoneSwatch = {
  id: "sw-stone",
  name: "Brown Travertine",
  category: "Stone",
  brand_name: "Kerstens",
  image_url: "https://res.cloudinary.com/demo/travertine.jpg",
  material_type: "Stone",
  color_family: null,
};
const woodSwatch = {
  id: "sw-wood",
  name: "Ebonized Oak",
  category: "Wood",
  brand_name: "Kerstens",
  image_url: "https://res.cloudinary.com/demo/oak.jpg",
  material_type: "Wood",
  color_family: null,
};
const supplierDefaultSwatch = {
  id: "sw-default",
  name: "Aged Brass",
  category: "Metal",
  brand_name: "Man Of Parts",
  image_url: "https://res.cloudinary.com/demo/brass.jpg",
  material_type: "Metal",
  color_family: null,
};

function makeItem(overrides: Partial<LockedProposalItemSnapshot> = {}): LockedProposalItemSnapshot {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slot_id: "11111111-1111-4111-8111-111111111111",
    product_name: "Rift CTS",
    brand_name: "Kerstens",
    category: "Tables",
    subcategory: "Coffee Tables",
    image_url: "https://example.com/rift.jpg",
    dimensions: "W 108 × D 108 × H 28 cm",
    width_mm: 1080,
    depth_mm: 1080,
    height_mm: 280,
    glb_url: "https://assets.example/rift-raw.glb",
    lead_time: "16 weeks",
    materials: {
      top: stoneSwatch,
      base: woodSwatch,
      "default-brass": supplierDefaultSwatch,
    },
    retail_price: 32398.3,
    retail_price_from: false,
    finish_options: [],
    size_options: [],
    ...overrides,
  };
}

describe("buildBlenderSceneManifest", () => {
  it("outputs layout and locked items with catalog metadata, resized dimensions, swapped piece isolation, and selected finishes without defaults", () => {
    const slotRift = "11111111-1111-4111-8111-111111111111";
    const productRift = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const slotSofa = "22222222-2222-4222-8222-222222222222";
    const productSofa = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const slotChair = "33333333-3333-4333-8333-333333333333";
    const swappedChairProduct = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const slotShelf = "44444444-4444-4444-8444-444444444444";
    const productShelf = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    const manifest = buildBlenderSceneManifest({
      proposalId: "prop-1",
      lockedAt: "2026-11-24T12:00:00.000Z",
      exportedAt: "2026-11-24T13:00:00.000Z",
      packageTier: "Bespoke",
      layout: {
        name: "Canaletto Penthouse",
        floorplan_url: "/__l5e/assets-v1/abc/floorplan.png",
      },
      items: [
        makeItem({ id: slotRift, slot_id: slotRift }),
        makeItem({
          id: slotSofa,
          slot_id: slotSofa,
          product_name: "Sandy Cove Sofa",
          category: "Seating",
          subcategory: "Sofas",
          size_key: "W 220 × D 108 × H 70 cm",
          dimensions: "W 220 × D 108 × H 70 cm",
          width_mm: null,
          depth_mm: null,
          height_mm: null,
          materials: { upholstery: woodSwatch },
        }),
        makeItem({
          id: swappedChairProduct,
          slot_id: slotChair,
          product_name: "Frenchmen Street Lounge Chair",
          category: "Seating",
          subcategory: "Armchairs",
          dimensions: null,
          width_mm: null,
          depth_mm: null,
          height_mm: null,
          materials: {},
          label: "Customer's own material",
        }),
        makeItem({
          id: slotShelf,
          slot_id: slotShelf,
          product_name: "ORS Bookshelf",
          category: "Storage",
          subcategory: "Bookcases",
          dimensions: "W 275 x D 59 x H 230 cm",
          width_mm: null,
          depth_mm: null,
          height_mm: null,
          glb_url: "https://assets.example/ors.glb",
          materials: {},
        }),
      ],
      boardItemProducts: new Map([
        [slotRift, productRift],
        [slotSofa, productSofa],
        [slotChair, "99999999-9999-4999-8999-999999999999"],
        [slotShelf, productShelf],
      ]),
      catalogById: new Map([
        [productRift, {
          id: productRift,
          sku: "KER-RIFT-108",
          name: "Rift CTS",
          category_role: "coffee_table",
          width_m: 1.08,
          depth_m: 1.08,
          height_m: 0.28,
          glb_url_compressed: "https://assets.example/rift-compressed.glb",
        }],
        [productSofa, {
          id: productSofa,
          sku: "MOP-SANDY-190",
          name: "Sandy Cove Sofa",
          category_role: "sofa",
          width_m: 1.9,
          depth_m: 1.08,
          height_m: 0.7,
          glb_url_compressed: "https://assets.example/sandy-compressed.glb",
        }],
        [swappedChairProduct, {
          id: swappedChairProduct,
          sku: "MOP-FRENCHMEN",
          name: "Frenchmen Street Lounge Chair",
          category_role: "lounge_chair",
          width_m: 0.82,
          depth_m: 0.77,
          height_m: 0.73,
          glb_url_compressed: "https://assets.example/frenchmen-compressed.glb",
        }],
      ]),
      productsById: new Map([
        [productShelf, {
          id: productShelf,
          sku: "DEL-ORS-275",
          product_name: "ORS Bookshelf",
          category: "Storage",
          subcategory: "Bookcases",
          dimensions: "W 275 x D 59 x H 230 cm",
          width_mm: null,
          depth_mm: null,
          height_mm: null,
          glb_url: "https://assets.example/ors.glb",
        }],
      ]),
      slotRulesByBoardItemId: new Map([
        [slotChair, {
          board_item_id: slotChair,
          category_role_override: "lounge_chair",
          width_m_override: 0.99,
          depth_m_override: 0.99,
          height_m_override: 0.99,
        }],
      ]),
    });

    expect(manifest.residence_layout).toEqual({
      name: "Canaletto Penthouse",
      floorplan_url: "https://www.maisonaffluency.com/__l5e/assets-v1/abc/floorplan.png",
    });
    expect(blenderSceneFilename(manifest)).toBe("blender-scene-canaletto-penthouse-bespoke.json");

    expect(manifest.items[0]).toEqual({
      sku: "KER-RIFT-108",
      name: "Rift CTS",
      category_role: "coffee_table",
      width_m: 1.08,
      depth_m: 1.08,
      height_m: 0.28,
      glb_url_compressed: "https://assets.example/rift-compressed.glb",
      selected_finishes: [
        {
          axis: "top",
          label: "Tabletop",
          id: "sw-stone",
          name: "Brown Travertine",
          category: "Stone",
          brand_name: "Kerstens",
          texture_url: "https://res.cloudinary.com/demo/travertine.jpg",
        },
        {
          axis: "base",
          label: "Frame / base",
          id: "sw-wood",
          name: "Ebonized Oak",
          category: "Wood",
          brand_name: "Kerstens",
          texture_url: "https://res.cloudinary.com/demo/oak.jpg",
        },
      ],
    });

    // Selected 220 cm sofa size overrides base 1.9 m catalog width.
    expect(manifest.items[1]).toMatchObject({
      sku: "MOP-SANDY-190",
      category_role: "sofa",
      width_m: 2.2,
      depth_m: 1.08,
      height_m: 0.7,
      glb_url_compressed: "https://assets.example/sandy-compressed.glb",
    });

    // Swapped chair uses alternative catalog dimensions (0.82), not original slot override (0.99), and keeps COM finish label.
    expect(manifest.items[2]).toMatchObject({
      sku: "MOP-FRENCHMEN",
      name: "Frenchmen Street Lounge Chair",
      category_role: "lounge_chair",
      width_m: 0.82,
      depth_m: 0.77,
      height_m: 0.73,
      glb_url_compressed: "https://assets.example/frenchmen-compressed.glb",
      selected_finishes: [{
        axis: "finish",
        label: "Selected finish",
        id: null,
        name: "Customer's own material",
        category: null,
        brand_name: null,
        texture_url: null,
      }],
    });

    // Item absent from catalog_items falls back to trade_products dimensions and GLB.
    expect(manifest.items[3]).toMatchObject({
      sku: "DEL-ORS-275",
      name: "ORS Bookshelf",
      category_role: "storage",
      width_m: 2.75,
      depth_m: 0.59,
      height_m: 2.3,
      glb_url_compressed: "https://assets.example/ors.glb",
      selected_finishes: [],
    });
  });
});

describe("exportViewingRoomBlenderScene admin access", () => {
  beforeEach(() => { setResponseHeaderMock.mockReset(); });

  it("rejects non-admin callers before querying proposal records", async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const handler = exportViewingRoomBlenderScene as unknown as (args: {
      data: { packageId: string; requestKey: string };
      context: { userId: string; supabase: { rpc: typeof rpc; from: typeof from } };
    }) => Promise<unknown>;

    await expect(handler({
      data: { packageId: "67019498-6238-40e5-9c48-3cf48ae3e99c", requestKey: "a3063da0-6278-481f-b8e5-457ba32f496c" },
      context: { userId: "buyer-user", supabase: { rpc, from } },
    })).rejects.toThrow("Admin access required.");
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "buyer-user", _role: "admin" });
    expect(from).not.toHaveBeenCalled();
    expect(setResponseHeaderMock).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
});