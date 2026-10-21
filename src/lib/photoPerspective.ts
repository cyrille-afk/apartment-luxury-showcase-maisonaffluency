import { Matrix, solve, inverse } from "ml-matrix";
import type { RoomBounds } from "./activeProjectLayout";

export type PhotoPoint = [number, number];
export type PhotoCalibration = { corners: [PhotoPoint, PhotoPoint, PhotoPoint, PhotoPoint]; locked: boolean; aspect: number };
export const defaultPhotoCalibration = (aspect = 1.5): PhotoCalibration => ({ corners: [[0.32, 0.52], [0.68, 0.52], [0.92, 0.92], [0.08, 0.92]], locked: false, aspect });

export function validPhotoCorners(points: PhotoPoint[]): boolean {
  if (points.length !== 4 || points.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1))) return false;
  const cross = points.map((p, i) => {
    const q = points[(i + 1) % 4], r = points[(i + 2) % 4];
    return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
  });
  const area = Math.abs(points.reduce((a, p, i) => { const q = points[(i + 1) % 4]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  return area > 0.005 && cross.every(v => v > 0.00001);
}

export function floorHomography(corners: PhotoCalibration["corners"], bounds: RoomBounds): Matrix {
  if (!validPhotoCorners(corners)) throw new Error("Floor corners must form a clockwise, non-crossing quadrilateral.");
  const world = [[-bounds.width / 2, -bounds.depth / 2], [bounds.width / 2, -bounds.depth / 2], [bounds.width / 2, bounds.depth / 2], [-bounds.width / 2, bounds.depth / 2]];
  const a: number[][] = [], b: number[][] = [];
  world.forEach(([x, z], i) => {
    const [u, v] = corners[i];
    a.push([x, z, 1, 0, 0, 0, -u * x, -u * z], [0, 0, 0, x, z, 1, -v * x, -v * z]);
    b.push([u], [v]);
  });
  const h = solve(new Matrix(a), new Matrix(b)).to1DArray();
  return new Matrix([[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]]);
}

export function photoFloorPoint(point: PhotoPoint, calibration: PhotoCalibration, bounds: RoomBounds): [number, number] | null {
  try {
    const p = inverse(floorHomography(calibration.corners, bounds)).mmul(Matrix.columnVector([...point, 1])).to1DArray();
    if (Math.abs(p[2]) < 1e-8) return null;
    const x = p[0] / p[2], z = p[1] / p[2];
    return Math.abs(x) <= bounds.width / 2 && Math.abs(z) <= bounds.depth / 2 ? [x, z] : null;
  } catch { return null; }
}

/** Exact floor projection; vertical scale assumes centred principal point and a 60° lens. */
export function photoCameraProjection(calibration: PhotoCalibration, bounds: RoomBounds) {
  const h = floorHomography(calibration.corners, bounds);
  const f = 0.5 / Math.tan(Math.PI / 6);
  const k = new Matrix([[f / calibration.aspect, 0, 0.5], [0, -f, 0.5], [0, 0, 1]]);
  const pose = inverse(k).mmul(h);
  const x = pose.getColumn(0), z = pose.getColumn(1);
  const norm = (v: number[]) => Math.hypot(...v);
  let y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const scale = (norm(x) + norm(z)) / (2 * norm(y));
  y = y.map(v => v * scale);
  const hy = k.mmul(Matrix.columnVector(y)).to1DArray();
  const p = new Matrix([[h.get(0, 0), hy[0], h.get(0, 1)], [h.get(1, 0), hy[1], h.get(1, 1)], [h.get(2, 0), hy[2], h.get(2, 1)]]);
  const center = solve(p, Matrix.columnVector(h.getColumn(2).map(v => -v))).to1DArray();
  const near = 0.001, far = 200, a = (far + near) / (far - near), b = -2 * far * near / (far - near);
  const clip = [
    ...p.getRow(0).map((v, i) => 2 * v - p.get(2, i)), 2 * h.get(0, 2) - h.get(2, 2),
    ...p.getRow(1).map((v, i) => p.get(2, i) - 2 * v), h.get(2, 2) - 2 * h.get(1, 2),
    ...p.getRow(2).map(v => a * v), a * h.get(2, 2) + b,
    ...p.getRow(2), h.get(2, 2),
  ];
  if (![...center, ...clip].every(Number.isFinite)) throw new Error("Invalid camera calibration");
  return { center: center as [number, number, number], clip };
}