import { describe, expect, it } from "vitest";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import {
  CLEARANCE_COMFORTABLE_M,
  CLEARANCE_TIGHT_M,
  clearanceLevel,
  footprintClearance,
  footprintOf,
  nearestClearance,
  pieceClearances,
  tightestGap,
  wallClearances,
} from "@/lib/layoutGuides";

const bounds = { width: 12, depth: 8, height: 3 };

const piece = (instanceId: string, x: number, y: number, wMm = 1000, dMm = 1000, rotY = 0): PlacedObject =>
  ({
    instanceId,
    id: instanceId,
    product_name: instanceId,
    brand_name: "Test",
    image_url: "",
    category: "",
    dimensions: `${wMm} × ${dMm} × 800 mm`,
    position: [x, 0, y],
    rotation: [0, rotY, 0],
    scale: 1,
  }) as unknown as PlacedObject;

describe("clearanceLevel", () => {
  it("classifies comfortable, tight and blocked gaps", () => {
    expect(clearanceLevel(CLEARANCE_COMFORTABLE_M)).toBe("comfortable");
    expect(clearanceLevel(CLEARANCE_COMFORTABLE_M - 0.01)).toBe("tight");
    expect(clearanceLevel(CLEARANCE_TIGHT_M)).toBe("tight");
    expect(clearanceLevel(CLEARANCE_TIGHT_M - 0.01)).toBe("blocked");
    expect(clearanceLevel(0)).toBe("blocked");
  });
});

describe("footprintClearance", () => {
  it("measures the edge-to-edge gap between two pieces", () => {
    const a = footprintOf(piece("a", 0, 0));
    const b = footprintOf(piece("b", 2.4, 0));
    const span = footprintClearance(a, b);
    expect(span.distance).toBeCloseTo(1.4, 5);
    expect(span.from[0]).toBeCloseTo(0.5, 5);
    expect(span.to[0]).toBeCloseTo(1.9, 5);
  });

  it("returns zero when footprints overlap", () => {
    const a = footprintOf(piece("a", 0, 0));
    const b = footprintOf(piece("b", 0.4, 0.4));
    expect(footprintClearance(a, b).distance).toBe(0);
  });

  it("accounts for rotation", () => {
    const a = footprintOf(piece("a", 0, 0, 1000, 1000));
    // 1 m × 2 m piece rotated 90°: its 2 m axis now lies along x, so its
    // left edge sits at 2.2 − 1.0 = 1.2 and the gap to a (right edge 0.5) is 0.7.
    const b = footprintOf(piece("b", 2.2, 0, 1000, 2000, Math.PI / 2));
    const span = footprintClearance(a, b);
    expect(span.distance).toBeCloseTo(0.7, 5);
  });
});

describe("wallClearances", () => {
  it("measures the gap to each wall", () => {
    const f = footprintOf(piece("a", 0, 0));
    const walls = wallClearances(f, bounds);
    expect(walls.find((w) => w.side === "right")?.distance).toBeCloseTo(5.5, 5);
    expect(walls.find((w) => w.side === "top")?.distance).toBeCloseTo(3.5, 5);
  });
});

describe("pieceClearances / tightestGap / nearestClearance", () => {
  const objects = [piece("a", 0, 0), piece("b", 2.4, 0), piece("c", -3, 3)];

  it("lists a clearance span per other piece", () => {
    const spans = pieceClearances(objects, "a");
    expect(spans).toHaveLength(2);
    expect(spans.map((s) => s.otherId).sort()).toEqual(["b", "c"]);
  });

  it("finds the tightest gap in the room", () => {
    // c sits 0.5 m off the bottom wall — tighter than the 1.4 m a–b gap.
    const gap = tightestGap(objects, bounds);
    expect(gap).not.toBeNull();
    expect(gap!.distance).toBeCloseTo(0.5, 5);
  });

  it("reports the nearest neighbour for a piece", () => {
    const nearest = nearestClearance(objects, bounds, "a");
    expect(nearest?.targetName).toBe("b");
    expect(nearest?.distance).toBeCloseTo(1.4, 5);
  });

  it("falls back to a wall when the piece is alone", () => {
    const nearest = nearestClearance([piece("a", 0, 0)], bounds, "a");
    // Top and bottom walls tie at 3.5 m; bottom is evaluated first.
    expect(nearest?.targetName).toBe("bottom wall");
    expect(nearest?.distance).toBeCloseTo(3.5, 5);
  });
});
