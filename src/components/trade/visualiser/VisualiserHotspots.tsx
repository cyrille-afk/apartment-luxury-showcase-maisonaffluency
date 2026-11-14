import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { resolveDimensions } from "@/lib/productDimensions";
import {
  layoutVisualiserHotspots,
  VISUALISER_HOTSPOT_HIT_SIZE,
  type VisualiserHotspotRect,
} from "@/lib/visualiserHotspots";
import type { PlacedObject } from "./SceneObject";

const OBSTACLE_SELECTOR = [
  ".visualiser-canvas-heading",
  ".visualiser-palette",
  ".visualiser-assets-position",
  '[data-testid="visualiser-inspector"]',
  '[data-testid="visualiser-inspector-pill"]',
  "[data-visualiser-hotspot-obstacle]",
].join(",");

function readPanelRects(canvas: HTMLCanvasElement): VisualiserHotspotRect[] {
  const workspace = canvas.closest(".visualiser-workspace") ?? canvas.parentElement;
  if (!workspace) return [];
  const canvasRect = canvas.getBoundingClientRect();
  return Array.from(workspace.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR)).flatMap(element => {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [];
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return [];
    return [{
      left: rect.left - canvasRect.left,
      top: rect.top - canvasRect.top,
      right: rect.right - canvasRect.left,
      bottom: rect.bottom - canvasRect.top,
    }];
  });
}

/** Screen-space, panel-aware pins. The 3D furniture and canvas stay mounted. */
export default function VisualiserHotspots({ objects, onFindAlternatives }: {
  objects: PlacedObject[];
  onFindAlternatives: (instanceId: string) => void;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const pinRefs = useRef(new Map<string, HTMLDivElement>());
  const overlayRoot = useRef<Root | null>(null);
  const [overlayElement] = useState(() => document.createElement("div"));
  const world = useMemo(() => new THREE.Vector3(), []);
  const cameraSpace = useMemo(() => new THREE.Vector3(), []);
  const host = gl.domElement.parentElement;

  useEffect(() => {
    const workspace = gl.domElement.closest(".visualiser-workspace") ?? host;
    if (!workspace) return;
    const resizeObserver = new ResizeObserver(() => invalidate());
    const observePanels = () => {
      resizeObserver.disconnect();
      workspace.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR).forEach(panel => resizeObserver.observe(panel));
    };
    observePanels();
    const mutationObserver = new MutationObserver(() => {
      observePanels();
      invalidate();
    });
    mutationObserver.observe(workspace, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    const onResize = () => invalidate();
    window.addEventListener("resize", onResize);
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [gl, host, invalidate]);

  useFrame(() => {
    if (!host) return;
    camera.updateMatrixWorld();
    const visible = objects.flatMap(object => {
      const height = Math.max(0.45, (resolveDimensions(object)?.h ?? 900) / 1000) * object.scale + 0.18;
      world.set(object.position[0], height, object.position[2]);
      cameraSpace.copy(world).applyMatrix4(camera.matrixWorldInverse);
      // A pin behind the camera has no meaningful screen position. All pieces
      // in front remain reachable, including anchors just beyond an edge.
      if (cameraSpace.z >= -camera.near) return [];
      world.project(camera);
      if (world.z < -1 || world.z > 1) return [];
      return [{
        id: object.instanceId,
        x: (world.x * 0.5 + 0.5) * size.width,
        y: (-world.y * 0.5 + 0.5) * size.height,
      }];
    });
    const placements = layoutVisualiserHotspots(visible, size, readPanelRects(gl.domElement));
    const placedIds = new Set(placements.map(placement => placement.id));
    for (const object of objects) {
      const pin = pinRefs.current.get(object.instanceId);
      if (!pin || placedIds.has(object.instanceId)) continue;
      pin.style.visibility = "hidden";
      pin.style.pointerEvents = "none";
    }
    for (const placement of placements) {
      const pin = pinRefs.current.get(placement.id);
      if (!pin) continue;
      pin.style.visibility = "visible";
      pin.style.pointerEvents = "auto";
      pin.style.transform = `translate3d(${placement.x - VISUALISER_HOTSPOT_HIT_SIZE / 2}px, ${placement.y - VISUALISER_HOTSPOT_HIT_SIZE / 2}px, 0)`;
      pin.dataset.tooltipSide = placement.tooltipSide;
      pin.dataset.displaced = String(placement.displaced);
    }
  });

  const content = (
    <div data-visualiser-hotspots className="pointer-events-none absolute inset-0 z-[34] overflow-hidden" aria-label="Furniture alternatives">
      {objects.map(object => (
        <div
          key={object.instanceId}
          ref={node => {
            if (node) pinRefs.current.set(object.instanceId, node);
            else pinRefs.current.delete(object.instanceId);
          }}
          data-hotspot-id={object.instanceId}
          data-tooltip-side="right"
          className="visualiser-hotspot group invisible absolute left-0 top-0 size-10 will-change-transform"
        >
          <button
            type="button"
            aria-label={`Find alternatives to ${object.product_name}`}
            className="group/button pointer-events-auto flex size-10 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onPointerDown={event => event.stopPropagation()}
            onPointerOver={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); onFindAlternatives(object.instanceId); }}
          >
            <span className="relative flex size-6 items-center justify-center rounded-full border border-background/70 bg-background/90 text-foreground shadow-md transition-transform duration-200 group-hover/button:scale-110">
              <span aria-hidden className="absolute h-px w-2.5 bg-current" />
              <span aria-hidden className="absolute h-2.5 w-px bg-current" />
            </span>
          </button>
          <span aria-hidden className="visualiser-hotspot-label pointer-events-none absolute top-1/2 hidden w-max max-w-64 -translate-y-1/2 flex-col whitespace-nowrap rounded-md border border-border/60 bg-background/95 px-4 py-2.5 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 md:flex">
            <span className="font-display text-[13px] font-normal leading-snug text-foreground">{object.product_name}</span>
            <span className="mt-0.5 font-body text-[9px] font-light uppercase tracking-[0.22em] text-muted-foreground">by {object.brand_name}</span>
          </span>
        </div>
      ))}
    </div>
  );

  // A separate DOM root is required here: rendering DOM through the R3F
  // reconciler treats a plain div as an unknown Three object and crashes.
  useLayoutEffect(() => {
    if (!host) return;
    host.appendChild(overlayElement);
    const root = createRoot(overlayElement);
    overlayRoot.current = root;
    return () => {
      overlayRoot.current = null;
      root.unmount();
      overlayElement.remove();
    };
  }, [host, overlayElement]);

  useLayoutEffect(() => {
    overlayRoot.current?.render(content);
  });

  return null;
}
