import type { AICuratedSceneSchema, CuratedAsset, Vec3 } from "@/types/aiCuratedScene";

/**
 * Client-side mock of the AI layout pipeline. GLBs are real catalogue models;
 * prices are MOCK figures for testing the R3F loop only — never display as RRP.
 */
export interface LayoutBrief {
  roomType: "living" | "lounge" | "salon";
  totalBudget: number;
  style: "quiet-luxury" | "sculptural" | "warm-minimal";
  roomDimensions: AICuratedSceneSchema["roomDimensions"];
}

const GLB = "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/glb-models";

type CatalogueItem = Omit<CuratedAsset, "position" | "rotation" | "scale"> & { name: string; role: "anchor" | "seat" | "table" | "accent" | "light" };

export const MOCK_CATALOGUE: CatalogueItem[] = [
  { sku: "MOP-SANDY-COVE-SOFA", componentId: "ffd33487-bb3d-4d18-80ee-1e35b858738e", name: "Sandy Cove Sofa", role: "anchor", priceAtCuration: 18400, glbUrl: `${GLB}/ffd33487-bb3d-4d18-80ee-1e35b858738e/w-190-d-108-h-70-sh-40-cm-com-fabric-1783390163774.glb` },
  { sku: "MOP-PRAIA-GRANJA-CT", componentId: "f198902d-aa9e-41d8-8630-bad4226aaa45", name: "Praia da Granja Coffee Table", role: "table", priceAtCuration: 9600, glbUrl: `${GLB}/f198902d-aa9e-41d8-8630-bad4226aaa45/rectangle---w-128-x-d-83-x-h-34-cm-1783392485221.glb` },
  { sku: "MOP-RUA-LEBLON", componentId: "cd3c22d9-cd6c-488a-aff0-d6776c8a742f", name: "Rua Leblon Lounge Chair", role: "seat", priceAtCuration: 8900, glbUrl: `${GLB}/cd3c22d9-cd6c-488a-aff0-d6776c8a742f/1783386690528.glb` },
  { sku: "MOP-FRENCHMEN-ST-AC", componentId: "353547c3-ea0c-4d59-b79a-21b761bfb291", name: "Frenchmen Street Armchair", role: "seat", priceAtCuration: 6200, glbUrl: `${GLB}/353547c3-ea0c-4d59-b79a-21b761bfb291/1783389210646.glb` },
  { sku: "MOP-MADISON-AVE-ST", componentId: "8a072491-e699-44ee-ac6b-51838d7514ed", name: "Madison Avenue Side Table", role: "accent", priceAtCuration: 3400, glbUrl: `${GLB}/8a072491-e699-44ee-ac6b-51838d7514ed/default-1783392434931.glb` },
  { sku: "MOP-BOND-ST-STOOL", componentId: "938efe1a-8744-47e9-9d1d-dbd00634ab1a", name: "Bond Street Stool", role: "accent", priceAtCuration: 2800, glbUrl: `${GLB}/938efe1a-8744-47e9-9d1d-dbd00634ab1a/1783389292330.glb` },
  { sku: "MOP-CINNAMON-GDN-FL", componentId: "163af529-08b9-4391-9a48-03663261c085", name: "Cinnamon Gardens Floor Lamp", role: "light", priceAtCuration: 4700, glbUrl: `${GLB}/163af529-08b9-4391-9a48-03663261c085/-55-h-156-cm-1783393125349.glb` },
];

export const catalogueName = (sku: string) => MOCK_CATALOGUE.find((c) => c.sku === sku)?.name ?? sku;

export const DEFAULT_BRIEF: LayoutBrief = {
  roomType: "living",
  totalBudget: 60000,
  style: "quiet-luxury",
  roomDimensions: { width: 7.2, length: 6.0, height: 3.2 },
};

const UNIT: Vec3 = [1, 1, 1];
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Places the conversation group around the room centre, then fills by priority within budget. */
export async function generateRoomLayout(brief: LayoutBrief, seed = Date.now()): Promise<AICuratedSceneSchema> {
  await new Promise((r) => setTimeout(r, 900)); // simulate inference latency
  const rnd = rand(Math.max(1, Math.floor(seed) % 2147483646));
  const { width: W, length: L, height: H } = brief.roomDimensions;
  const jitter = () => (rnd() - 0.5) * 0.3;
  const by = (sku: string) => MOCK_CATALOGUE.find((c) => c.sku === sku)!;

  const lounge = brief.style === "sculptural" ? "MOP-RUA-LEBLON" : "MOP-FRENCHMEN-ST-AC";
  const plan: Array<{ sku: string; position: Vec3; rotation: Vec3 }> = [
    { sku: "MOP-SANDY-COVE-SOFA", position: [jitter(), 0, -L * 0.22], rotation: [0, 0, 0] },
    { sku: "MOP-PRAIA-GRANJA-CT", position: [jitter(), 0, 0.15], rotation: [0, 0, 0] },
    { sku: lounge, position: [-1.7, 0, 0.9 + jitter()], rotation: [0, Math.PI * 0.75, 0] },
    { sku: lounge, position: [1.7, 0, 0.9 + jitter()], rotation: [0, -Math.PI * 0.75, 0] },
    { sku: "MOP-MADISON-AVE-ST", position: [1.55, 0, -L * 0.22], rotation: [0, 0, 0] },
    { sku: "MOP-CINNAMON-GDN-FL", position: [-W / 2 + 0.6, 0, -L / 2 + 0.6], rotation: [0, Math.PI / 4, 0] },
    { sku: "MOP-BOND-ST-STOOL", position: [W / 2 - 0.9, 0, L / 2 - 1.1], rotation: [0, rnd() * Math.PI, 0] },
  ];

  let spend = 0;
  const curatedAssets: CuratedAsset[] = [];
  for (const p of plan) {
    const item = by(p.sku);
    if (spend + item.priceAtCuration > brief.totalBudget) continue; // honour the ceiling
    spend += item.priceAtCuration;
    curatedAssets.push({ sku: item.sku, componentId: item.componentId, glbUrl: item.glbUrl, priceAtCuration: item.priceAtCuration, position: p.position, rotation: p.rotation, scale: UNIT });
  }

  return {
    roomDimensions: { width: W, length: L, height: H },
    architecturalAnchors: [
      { type: "window", position: [0, 1.5, -L / 2], rotation: [0, 0, 0], scale: [2.4, 1.8, 0.1] },
      { type: "door", position: [W / 2, 1.1, L / 4], rotation: [0, -Math.PI / 2, 0], scale: [1.0, 2.2, 0.1] },
      { type: "wall_opening", position: [-W / 2, 1.3, L / 5], rotation: [0, Math.PI / 2, 0], scale: [1.6, 2.6, 0.1] },
    ],
    curatedAssets,
    financialSummary: { totalBudget: brief.totalBudget, allocatedSpend: spend, remainingBuffer: brief.totalBudget - spend },
  };
}

/** Recomputes the ledger after edits so it never drifts from curatedAssets. */
export const summarise = (scene: AICuratedSceneSchema): AICuratedSceneSchema["financialSummary"] => {
  const allocatedSpend = scene.curatedAssets.reduce((s, a) => s + a.priceAtCuration, 0);
  return { totalBudget: scene.financialSummary.totalBudget, allocatedSpend, remainingBuffer: scene.financialSummary.totalBudget - allocatedSpend };
};
