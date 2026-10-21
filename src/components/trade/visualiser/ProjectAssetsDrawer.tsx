import { useState } from "react";
import { Box, ChevronLeft, GripVertical, PackageOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectInventory, type ProjectInventoryItem } from "@/contexts/ProjectInventoryContext";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { cn } from "@/lib/utils";

export const PROJECT_ASSET_DRAG_TYPE = "application/x-ma-project-asset";

/**
 * Collapsible left-side drawer on the 2D Layout Plan (Axonometric Studio)
 * listing every product added to the Co-Pilot Workspace from product pages.
 * Items can be dragged onto the layout or placed with a click (touch).
 */
export default function ProjectAssetsDrawer({
  onPlace,
  anchorClassName = "left-3 top-24 sm:left-6",
}: {
  onPlace: (item: ProjectInventoryItem) => void;
  /** Positioning classes for the floating drawer within its relative parent. */
  anchorClassName?: string;
}) {
  const { projectInventory, removeFromInventory } = useProjectInventory();
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Open project assets"
        className={cn("absolute z-30 gap-1.5 bg-background/95 backdrop-blur-md", anchorClassName)}
      >
        <PackageOpen className="h-4 w-4" />
        Project Assets
        {projectInventory.length > 0 && (
          <span className="ml-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] tabular-nums text-background">
            {projectInventory.length}
          </span>
        )}
      </Button>
    );
  }

  return (
    <aside
      aria-label="Project Assets"
      className={cn("absolute z-30 flex max-h-[calc(100%-2rem)] w-72 max-w-[80vw] flex-col rounded-sm border border-border bg-background/95 shadow-sm backdrop-blur-md", anchorClassName)}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="font-body text-xs font-semibold uppercase tracking-widest text-foreground">
          Project Assets
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Collapse project assets"
          onClick={() => setOpen(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </header>

      <div className="overflow-y-auto p-2">
        {projectInventory.length === 0 ? (
          <p className="px-2 py-6 text-center font-body text-xs leading-relaxed text-muted-foreground">
            No pieces yet. Use "Add to Co-Pilot Workspace" on any product page and it will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {projectInventory.map((item) => {
              const key = `${item.id}::${item.variantLabel ?? ""}`;
              return (
                <li
                  key={key}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(PROJECT_ASSET_DRAG_TYPE, key);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn(
                    "group flex items-center gap-3 rounded-sm border border-transparent p-2",
                    "cursor-grab transition-colors hover:border-border hover:bg-muted/50 active:cursor-grabbing",
                  )}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {item.imageUrl ? (
                      <img
                        src={optimizeImageUrl(item.imageUrl, "w_200,c_limit,q_auto,f_auto")}
                        alt={item.productName}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Box className="mx-auto h-full w-6 text-muted-foreground" />
                    )}
                    {item.glbUrl && (
                      <span className="absolute bottom-0 right-0 flex items-center gap-0.5 bg-background/90 px-1 text-[9px] text-foreground">
                        <Box className="h-2.5 w-2.5" />3D
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                      {item.brandName}
                    </p>
                    <p className="break-words text-xs text-foreground">{item.productName}</p>
                    {item.selectedUpholstery && <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">Upholstery: {item.selectedUpholstery}</p>}
                    {item.selectedFrameFinish && <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">Frame Finish: {item.selectedFrameFinish}</p>}
                    {(item.variantLabel || item.dimensions) && (
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                        {[item.dimensions, !item.selectedUpholstery && !item.selectedFrameFinish ? item.variantLabel : null].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      type="button"
                      onClick={() => onPlace(item)}
                      aria-label={`Drag ${item.productName} to layout`}
                      title="Drag to Layout — or click to place"
                      className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <GripVertical className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => removeFromInventory(item.id, item.variantLabel)}
                      aria-label={`Remove ${item.productName} from project assets`}
                      className="flex h-6 w-8 items-center justify-center text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
