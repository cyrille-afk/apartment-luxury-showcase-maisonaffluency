import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { RoomBounds } from "@/lib/activeProjectLayout";
import { resolveDimensions } from "@/lib/productDimensions";
import { PROJECT_ASSET_DRAG_TYPE } from "@/components/trade/visualiser/ProjectAssetsDrawer";
import { cn } from "@/lib/utils";

const FALLBACK_FOOTPRINT_M = 0.6;
const GRID_STEP_M = 1;

/**
 * Interactive top-down 2D floor plan. Renders the room bounds with a 1 m grid
 * and every placed piece as a true-footprint rectangle at its layout (x, y).
 * Accepts drag-and-drop from the Project Assets drawer (drop point becomes the
 * piece's layout coordinates) and supports pointer-dragging placed pieces to
 * reposition them. Coordinates are room metres, origin at the room centre —
 * the same space the 3D scene uses (x = position[0], y = position[2]).
 */
export default function LayoutPlanCanvas({
  objects,
  bounds,
  floorPlanUrl,
  selectedId,
  onSelect,
  onMove,
  onDropAssetKey,
}: {
  objects: PlacedObject[];
  bounds: RoomBounds;
  floorPlanUrl?: string | null;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
  onMove: (instanceId: string, x: number, y: number) => void;
  onDropAssetKey: (key: string, x: number, y: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ instanceId: string; moved: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const clientToRoom = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const el = wrapRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      // The SVG uses preserveAspectRatio="xMidYMid meet": uniform scale, centred.
      const scale = Math.min(rect.width / bounds.width, rect.height / bounds.depth);
      const offsetX = (rect.width - bounds.width * scale) / 2;
      const offsetY = (rect.height - bounds.depth * scale) / 2;
      const x = (clientX - rect.left - offsetX) / scale - bounds.width / 2;
      const y = (clientY - rect.top - offsetY) / scale - bounds.depth / 2;
      const clamp = (v: number, half: number) => Math.max(-half, Math.min(half, v));
      return [clamp(x, bounds.width / 2), clamp(y, bounds.depth / 2)];
    },
    [bounds.width, bounds.depth],
  );

  const startPointerDrag = (event: ReactPointerEvent, instanceId: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = { instanceId, moved: false };
    const onPointerMove = (move: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = clientToRoom(move.clientX, move.clientY);
      if (!point) return;
      drag.moved = true;
      onMove(drag.instanceId, point[0], point[1]);
    };
    const onPointerUp = (up: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (drag && !drag.moved) onSelect(drag.instanceId);
      else if (drag) {
        // Final settle so the release point is the stored coordinate.
        const point = clientToRoom(up.clientX, up.clientY);
        if (point) onMove(drag.instanceId, point[0], point[1]);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const gridLines: ReactNode[] = [];
  for (let x = Math.ceil(-bounds.width / 2); x <= bounds.width / 2; x += GRID_STEP_M) {
    gridLines.push(
      <line key={`v${x}`} x1={x} y1={-bounds.depth / 2} x2={x} y2={bounds.depth / 2} className="stroke-border" strokeWidth={0.02} />,
    );
  }
  for (let y = Math.ceil(-bounds.depth / 2); y <= bounds.depth / 2; y += GRID_STEP_M) {
    gridLines.push(
      <line key={`h${y}`} x1={-bounds.width / 2} y1={y} x2={bounds.width / 2} y2={y} className="stroke-border" strokeWidth={0.02} />,
    );
  }

  return (
    <div
      ref={wrapRef}
      data-testid="layout-plan-canvas"
      className={cn(
        "absolute inset-0 touch-none select-none",
        dragOver && "ring-2 ring-inset ring-primary",
      )}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(PROJECT_ASSET_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        setDragOver(false);
        const key = event.dataTransfer.getData(PROJECT_ASSET_DRAG_TYPE);
        if (!key) return;
        event.preventDefault();
        const point = clientToRoom(event.clientX, event.clientY);
        if (point) onDropAssetKey(key, point[0], point[1]);
      }}
    >
      <svg
        className="h-full w-full"
        viewBox={`${-bounds.width / 2} ${-bounds.depth / 2} ${bounds.width} ${bounds.depth}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="2D floor plan with placed pieces"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
      >
        <rect
          x={-bounds.width / 2}
          y={-bounds.depth / 2}
          width={bounds.width}
          height={bounds.depth}
          className="fill-muted/30 stroke-foreground/40"
          strokeWidth={0.04}
        />
        {floorPlanUrl && (
          <image
            href={floorPlanUrl}
            x={-bounds.width / 2}
            y={-bounds.depth / 2}
            width={bounds.width}
            height={bounds.depth}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.45}
          />
        )}
        {gridLines}
        {objects.map((object) => {
          const dims = resolveDimensions(object);
          const scale = object.scale || 1;
          const w = ((dims?.w ?? FALLBACK_FOOTPRINT_M * 1000) / 1000) * scale;
          const d = ((dims?.d ?? FALLBACK_FOOTPRINT_M * 1000) / 1000) * scale;
          const deg = (object.rotation[1] * 180) / Math.PI;
          const selected = object.instanceId === selectedId;
          const label = object.product_name.length > 26 ? `${object.product_name.slice(0, 25)}…` : object.product_name;
          return (
            <g
              key={object.instanceId}
              transform={`translate(${object.position[0]} ${object.position[2]})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => startPointerDrag(event, object.instanceId)}
            >
              <g transform={`rotate(${deg})`}>
                <rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d}
                  rx={0.03}
                  className={cn(
                    selected
                      ? "fill-primary/25 stroke-primary"
                      : "fill-background/80 stroke-foreground/60 hover:fill-primary/10",
                  )}
                  strokeWidth={selected ? 0.05 : 0.03}
                />
              </g>
              {/* Generous invisible hit area so small pieces stay grabbable. */}
              <rect
                x={-Math.max(w, 0.5) / 2}
                y={-Math.max(d, 0.5) / 2}
                width={Math.max(w, 0.5)}
                height={Math.max(d, 0.5)}
                fill="transparent"
              />
              <text
                y={Math.max(d, 0.5) / 2 + 0.22}
                textAnchor="middle"
                fontSize={0.16}
                className={cn("pointer-events-none", selected ? "fill-primary" : "fill-foreground")}
              >
                {label}
              </text>
              <text
                y={Math.max(d, 0.5) / 2 + 0.42}
                textAnchor="middle"
                fontSize={0.12}
                className="pointer-events-none fill-muted-foreground"
              >
                {`${w.toFixed(2)} × ${d.toFixed(2)} m`}
              </text>
            </g>
          );
        })}
        {objects.length === 0 && !floorPlanUrl && (
          <text textAnchor="middle" y={0} fontSize={0.28} className="fill-muted-foreground">
            Drag pieces here from Project Assets
          </text>
        )}
      </svg>
    </div>
  );
}
