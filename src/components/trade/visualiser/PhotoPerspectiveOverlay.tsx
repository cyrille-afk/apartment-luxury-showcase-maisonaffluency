import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Lock, ScanLine, X } from "lucide-react";
import { photoCameraProjection, validPhotoCorners, type PhotoCalibration, type PhotoPoint } from "@/lib/photoPerspective";
import type { RoomBounds } from "@/lib/activeProjectLayout";

export default function PhotoPerspectiveOverlay({ calibration, bounds, onChange }: { calibration: PhotoCalibration; bounds: RoomBounds; onChange: (value: PhotoCalibration | null) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  let top: PhotoPoint[] = [];
  try {
    const { clip } = photoCameraProjection(calibration, bounds);
    top = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => {
      const v = [x * bounds.width / 2, bounds.height, z * bounds.depth / 2, 1];
      const row = (i: number) => v.reduce((sum, n, j) => sum + clip[i * 4 + j] * n, 0);
      return [(row(0) / row(3) + 1) / 2, (1 - row(1) / row(3)) / 2];
    });
  } catch { /* Keep the last valid ground outline while corners are edited. */ }
  const move = (index: number, x: number, y: number) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    const corners = calibration.corners.map((p, i) => i === index ? [Math.max(0.01, Math.min(0.99, (x - rect.left) / rect.width)), Math.max(0.01, Math.min(0.99, (y - rect.top) / rect.height))] as PhotoPoint : p) as PhotoCalibration["corners"];
    if (validPhotoCorners(corners)) onChange({ ...calibration, corners });
  };
  return <div className="pointer-events-none absolute inset-0 z-40">
    {!calibration.locked && <svg ref={svg} viewBox="0 0 1000 1000" preserveAspectRatio="none" className="h-full w-full overflow-hidden" aria-label="Room perspective alignment">
      <polygon points={calibration.corners.map(p => `${p[0] * 1000},${p[1] * 1000}`).join(" ")} className="fill-primary/10 stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {top.length === 4 && <g className="stroke-primary/60" fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke"><polygon points={top.map(p => `${p[0] * 1000},${p[1] * 1000}`).join(" ")} />{top.map((p, i) => <line key={i} x1={p[0] * 1000} y1={p[1] * 1000} x2={calibration.corners[i][0] * 1000} y2={calibration.corners[i][1] * 1000} />)}</g>}
      {calibration.corners.map((p, i) => <circle key={i} role="slider" tabIndex={0} aria-label={["Rear left floor corner", "Rear right floor corner", "Front right floor corner", "Front left floor corner"][i]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p[0] * 100)} cx={p[0] * 1000} cy={p[1] * 1000} r="12" className="pointer-events-auto cursor-move touch-none fill-background stroke-primary" strokeWidth="3" vectorEffect="non-scaling-stroke" onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(i, e.clientX, e.clientY); }} onPointerUp={e => e.currentTarget.releasePointerCapture(e.pointerId)} onKeyDown={e => { const delta = e.shiftKey ? 0.01 : 0.002; const directions: Record<string, PhotoPoint> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }; const d = directions[e.key]; const rect = svg.current?.getBoundingClientRect(); if (d && rect) { e.preventDefault(); move(i, rect.left + (p[0] + d[0]) * rect.width, rect.top + (p[1] + d[1]) * rect.height); } }} />)}
    </svg>}
    <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-border bg-background/90 p-2 backdrop-blur-sm">
      <Button variant="outline" size="sm" onClick={() => onChange({ ...calibration, locked: !calibration.locked })}>{calibration.locked ? <ScanLine className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{calibration.locked ? "Adjust Perspective" : "Lock Ground Plane"}</Button>
      <Button variant="ghost" size="icon" aria-label="Remove room perspective match" onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>
    </div>
  </div>;
}