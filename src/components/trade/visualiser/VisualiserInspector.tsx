import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DIMENSIONS_PLACEHOLDER, formatDimensions, resolveDimensions } from "@/lib/productDimensions";
import { useVisualiserSelection } from "./VisualiserSelectionContext";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

const panelClass =
  "absolute right-4 sm:right-8 top-24 z-[60] w-64 max-w-[calc(100%-2rem)] border-t border-foreground/15 bg-background/90 px-5 py-4 backdrop-blur-sm";

/**
 * Right-hand inspector sidebar. Reads the shared selection context: when an
 * object is clicked on the canvas it shows Brand, Product Name, Dimensions
 * and the current Scale; otherwise it shows a blank-state placeholder.
 * Extra per-object controls (orientation, finishes) are passed as children
 * and only render while an object is selected.
 */
const VisualiserInspector = ({
  onRemove,
  onScale,
  children,
}: {
  onRemove: (instanceId: string) => void;
  onScale: (instanceId: string, scale: number) => void;
  children?: ReactNode;
}) => {
  const { selected } = useVisualiserSelection();

  if (!selected) {
    return (
      <aside aria-label="Object inspector" data-testid="visualiser-inspector" className={panelClass}>
        <p className={cn(microLabel, "text-muted-foreground")}>Inspector</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Select an object on the canvas to view its details.
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Object inspector"
      data-testid="visualiser-inspector"
      className={cn(panelClass, "max-h-[calc(100%-14rem)] overflow-y-auto")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(microLabel, "text-muted-foreground")}>{selected.brand_name}</p>
          <p className="mt-1 font-serif text-base leading-tight text-foreground">{selected.product_name}</p>
        </div>
        <button
          aria-label="Remove object"
          onClick={() => onRemove(selected.instanceId)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className={cn(microLabel, "mt-3 text-muted-foreground")}>
        {formatDimensions(resolveDimensions({ dimensions: selected.dimensions })) ?? DIMENSIONS_PLACEHOLDER}
      </p>

      <label className={cn(microLabel, "mt-5 block text-muted-foreground")}>
        Scale · {Math.round(selected.scale * 100)}%
      </label>
      <input
        type="range"
        aria-label="Scale object"
        min={MIN_SCALE * 100}
        max={MAX_SCALE * 100}
        value={Math.round(selected.scale * 100)}
        onChange={(event) => onScale(selected.instanceId, Number(event.target.value) / 100)}
        className="mt-2 w-full accent-foreground"
      />

      {children}
    </aside>
  );
};

export default VisualiserInspector;
