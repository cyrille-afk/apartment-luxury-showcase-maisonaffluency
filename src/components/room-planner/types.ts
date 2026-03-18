export interface Point2D {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: Point2D;
  end: Point2D;
}

export interface Room {
  id: string;
  name: string;
  corners: Point2D[]; // closed polygon
  color: string;
}

export interface PlacedProduct {
  id: string;
  productId: string;
  productName: string;
  brandName: string;
  imageUrl: string | null;
  position: { x: number; y: number; z: number };
  rotation: number; // y-axis rotation in radians
  scale: number;
}

export interface PlannerState {
  planImageUrl: string | null;
  walls: Wall[];
  rooms: Room[];
  placedProducts: PlacedProduct[];
  wallHeight: number; // in meters
  pixelsPerMeter: number;
}

export const ROOM_COLORS = [
  "hsl(210 40% 90%)",
  "hsl(150 40% 90%)",
  "hsl(30 40% 90%)",
  "hsl(270 40% 90%)",
  "hsl(0 40% 90%)",
  "hsl(180 40% 90%)",
  "hsl(60 40% 90%)",
  "hsl(330 40% 90%)",
];
