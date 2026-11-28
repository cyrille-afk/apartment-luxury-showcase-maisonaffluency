import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Crosshair, Trash2 } from "lucide-react";
import { planPoint, type EyeLevelCamera, type PlanPoint } from "@/lib/proposalRenderDraft";
import type { RoomZone } from "@/lib/roomZone";

export function EyeLevelCameraPlan({ imageUrl, camera, onChange, disabled, zone, onZoneChange }: { imageUrl: string; camera: EyeLevelCamera | null; onChange: (camera: EyeLevelCamera | null) => void; disabled: boolean; zone?: RoomZone | null; onZoneChange?: (box: Pick<RoomZone,"x"|"y"|"width"|"height">) => void }) {
  const [mode,setMode] = useState<"camera"|"crop">("camera");
  const cropStart = useRef<PlanPoint | null>(null);
  const drag = useRef<"position" | "target" | null>(null);
  const move = (point: PlanPoint, part: "position" | "target") => {
    if (camera) onChange({ ...camera, [part]: point });
    else onChange({ position: point, target: { x: point.x, y: Math.max(0, point.y - 20) } });
  };
  return <div className="space-y-2">
    {onZoneChange && <div role="group" aria-label="Plan editing mode" className="flex gap-2"><Button size="sm" variant={mode === "crop" ? "default" : "outline"} disabled={disabled} onClick={() => setMode("crop")}>Draw Room Crop</Button><Button size="sm" variant={mode === "camera" ? "default" : "outline"} disabled={disabled} onClick={() => setMode("camera")}>Camera &amp; Sightline</Button></div>}
    <div className="relative overflow-hidden rounded-md border border-border bg-muted/10">
      <img src={imageUrl} alt="Empty room camera plan" className="block w-full" draggable={false} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full touch-none text-primary" aria-label="Eye-level camera plan"
        onPointerDown={e => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); const point = planPoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect()); if (mode === "crop" && onZoneChange) { cropStart.current = point; return; } const part = (e.target as Element).getAttribute("data-camera-part"); drag.current = part === "target" ? "target" : "position"; move(point, drag.current); }}
        onPointerMove={e => { if (disabled) return; const point = planPoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect()); if (cropStart.current && onZoneChange) { const start = cropStart.current; onZoneChange({ x: Math.min(start.x,point.x),y: Math.min(start.y,point.y),width: Math.abs(point.x-start.x),height: Math.abs(point.y-start.y) }); } else if (drag.current) move(point, drag.current); }}
        onPointerUp={() => { drag.current = null; cropStart.current = null; }} onPointerCancel={() => { drag.current = null; cropStart.current = null; }}>
        {zone && <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="var(--primary)" fillOpacity="0.08" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 0.5" pointerEvents="none" />}
        <defs><marker id="eye-level-sightline" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="currentColor" /></marker></defs>
        {camera && <>
          <line x1={camera.position.x} y1={camera.position.y} x2={camera.target.x} y2={camera.target.y} stroke="currentColor" strokeWidth="0.6" markerEnd="url(#eye-level-sightline)" />
          {(["position", "target"] as const).map(part => <circle key={part} data-camera-part={part} cx={camera[part].x} cy={camera[part].y} r={part === "position" ? 2 : 1.6} fill="currentColor" stroke="var(--background)" strokeWidth="0.5" tabIndex={disabled ? -1 : 0} role="slider" aria-label={part === "position" ? "Camera position" : "Camera sightline target"} aria-valuetext={`${Math.round(camera[part].x)}%, ${Math.round(camera[part].y)}%`} className="cursor-move focus:outline-none"
            onKeyDown={e => { if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault(); const p = camera[part]; move({ x: Math.max(0, Math.min(100, p.x + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0))), y: Math.max(0, Math.min(100, p.y + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0))) }, part); }} />)}
        </>}
      </svg>
    </div>
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1"><Camera className="size-3.5" />1.5 m · 24 mm</span>
      <span className="inline-flex items-center gap-1"><Crosshair className="size-3.5" />{camera ? `${Math.round(camera.position.x)}%, ${Math.round(camera.position.y)}% → ${Math.round(camera.target.x)}%, ${Math.round(camera.target.y)}%` : "Camera not placed"}</span>
      {camera && <Button variant="ghost" size="icon" aria-label="Remove camera pin" title="Remove camera pin" disabled={disabled} onClick={() => onChange(null)}><Trash2 className="size-3.5" /></Button>}
    </div>
  </div>;
}