/** Data contract for the AI Curatorial Assistant layout pipeline. Units: metres, radians, EUR. */
export type Vec3 = [number, number, number];

export interface AICuratedSceneSchema {
  roomDimensions: { width: number; length: number; height: number };
  architecturalAnchors: Array<{
    type: "window" | "door" | "wall_opening";
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
  }>;
  curatedAssets: Array<{
    sku: string;
    componentId: string;
    glbUrl: string;
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
    priceAtCuration: number;
  }>;
  financialSummary: { totalBudget: number; allocatedSpend: number; remainingBuffer: number };
}

export type CuratedAsset = AICuratedSceneSchema["curatedAssets"][number];
export type ArchitecturalAnchor = AICuratedSceneSchema["architecturalAnchors"][number];
