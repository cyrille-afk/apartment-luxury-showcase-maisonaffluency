import { ChevronLeft, PanelLeftOpen, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DIMENSIONS_PLACEHOLDER, formatDimensions, resolveDimensions } from "@/lib/productDimensions";
import { formatGap, type ClearanceLevel } from "@/lib/layoutGuides";
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
  onRestore,
  nearestClearance,
  sidebarActions,
  children,
}: {
  onRemove: (instanceId: string) => void;
  onScale: (instanceId: string, scale: number) => void;
  onRestore?: (instanceId: string) => void;
  /** Nearest gap from the selected piece to another piece or wall. */
  nearestClearance?: { distance: number; level: ClearanceLevel; targetName: string } | null;
  children?: ReactNode;
  sidebarActions?: ReactNode;
}) => {
  const { selected } = useVisualiserSelection();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        data-testid="visualiser-inspector-pill"
        aria-label="Open piece inspector"
        onClick={() => setCollapsed(false)}
        className={cn(panelClass, "w-auto gap-2 rounded-full border px-4 py-2 shadow-md")}
      >
        <PanelLeftOpen className="h-4 w-4" />
        <span className="text-xs">Piece Inspector{selected ? ` · ${selected.product_name}` : ""}</span>
      </Button>
    );
  }
  const header = (
    <div className="-mx-5 -mt-4 mb-4 flex items-center justify-between gap-2 border-b border-foreground/10 px-5 py-2">
      <p className={cn(microLabel, "truncate text-foreground")} title={selected?.product_name}>{selected ? selected.product_name : "Piece Inspector"}</p>
      <Button variant="ghost" size="icon-sm" aria-label="Hide inspector" title="Hide inspector" onClick={() => setCollapsed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );

  if (!selected) {
    return (
      <aside aria-label="Object inspector" data-testid="visualiser-inspector" className={panelClass}>
        {header}
        {sidebarActions && <div className="mb-4">{sidebarActions}</div>}
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
      className={cn(panelClass, "max-h-[calc(100vh-260px)] overflow-y-auto")}
    >
      {header}
      {sidebarActions && <div className="mb-4">{sidebarActions}</div>}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(microLabel, "text-muted-foreground")}>{selected.brand_name}</p>
          <p className="mt-1 font-serif text-base leading-tight text-foreground">{selected.product_name}</p>
        </div>
        <Button variant="ghost" size="icon-sm"
          aria-label="Remove object"
          onClick={() => onRemove(selected.instanceId)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className={cn(microLabel, "mt-3 text-muted-foreground")}>
        {formatDimensions(resolveDimensions(selected)) ?? DIMENSIONS_PLACEHOLDER}
      </p>

      {nearestClearance && (
        <p
          data-testid="nearest-clearance"
          className={cn(
            microLabel,
            "mt-2",
            nearestClearance.level === "comfortable" && "text-success",
            nearestClearance.level === "tight" && "text-warning",
            nearestClearance.level === "blocked" && "text-destructive",
          )}
        >
          Clearance · {formatGap(nearestClearance.distance)} to {nearestClearance.targetName}
        </p>
      )}

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

      {onRestore && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full text-xs"
          title="Piece invisible? Rebuilds its mesh and materials, keeping position, size and finishes."
          onClick={() => onRestore(selected.instanceId)}
        >
          Restore piece
        </Button>
      )}


      {children}
    </aside>
  );
};

export default VisualiserInspector;
