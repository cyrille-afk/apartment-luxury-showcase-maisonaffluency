import { X } from "lucide-react";
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { useDesignerDisplayName } from "@/hooks/useDesignerDisplayName";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Renders the currently-active project + designer filters as removable chips.
 * Used in the hub header (TradeProjectDetail) and on TradeQuotes / TradeBoards.
 *
 * Each chip clears just its own filter; "Clear all" wipes both.
 * Renders nothing when no filter is active.
 *
 * Keyboard: chips form a roving-focus group — ArrowLeft/ArrowRight move
 * focus between the clear buttons (including "Clear all"), Home/End jump
 * to the first/last, and Enter/Space activate.
 */
export default function ActiveFilterChips({
  className = "",
  confirmClearAll = false,
}: {
  className?: string;
  /** When true, "Clear all" prompts the user before wiping both filters. */
  confirmClearAll?: boolean;
}) {
  const {
    projectFilter,
    designerFilter,
    clearProjectFilter,
    clearDesignerFilter,
    clearAllFilters,
  } = useProjectFilter();
  const designerLabel = useDesignerDisplayName(designerFilter);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!projectFilter) { setProjectName(null); return; }
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectFilter)
        .maybeSingle();
      setProjectName((data as any)?.name || "Project");
    })();
  }, [projectFilter]);

  // Track the most recently cleared filter so we can announce it to screen readers.
  const [announcement, setAnnouncement] = useState("");
  const announceCleared = (what: string) => {
    setAnnouncement(`${what} filter cleared`);
    window.setTimeout(() => setAnnouncement(""), 1000);
  };

  // Roving focus across the chip clear buttons + "Clear all".
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const regionRef = useRef<HTMLDivElement | null>(null);
  // After a clear, restore focus to a sensible next target on re-render.
  const pendingFocusRef = useRef<"project" | "designer" | "region" | null>(null);

  const focusableCount =
    (projectFilter ? 1 : 0) +
    (designerFilter ? 1 : 0) +
    (projectFilter && designerFilter ? 1 : 0);

  const handleClearProject = () => {
    pendingFocusRef.current = designerFilter ? "designer" : "region";
    clearProjectFilter();
    announceCleared(`Project ${projectName || ""}`.trim());
  };
  const handleClearDesigner = () => {
    pendingFocusRef.current = projectFilter ? "project" : "region";
    clearDesignerFilter();
    announceCleared(`Designer ${designerLabel || designerFilter || ""}`.trim());
  };
  const handleClearAll = () => {
    pendingFocusRef.current = "region";
    clearAllFilters();
    announceCleared("All");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
    const items = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = items.findIndex((el) => el === active);
    let nextIndex = currentIndex;
    if (key === "ArrowRight") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    else if (key === "ArrowLeft") nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    else if (key === "Home") nextIndex = 0;
    else if (key === "End") nextIndex = items.length - 1;
    e.preventDefault();
    items[nextIndex]?.focus();
  };

  // Resolve pending focus once the filter set has changed and refs are reattached.
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;

    let s = 0;
    const projectSlot = projectFilter ? s++ : -1;
    const designerSlot = designerFilter ? s++ : -1;

    if (target === "project" && projectSlot >= 0) {
      itemsRef.current[projectSlot]?.focus();
    } else if (target === "designer" && designerSlot >= 0) {
      itemsRef.current[designerSlot]?.focus();
    } else if (regionRef.current) {
      regionRef.current.focus();
    }
  }, [projectFilter, designerFilter]);

  if (!projectFilter && !designerFilter) return null;

  // Reset slots when filter set changes.
  itemsRef.current = new Array(focusableCount).fill(null);

  let slot = 0;
  const projectSlot = projectFilter ? slot++ : -1;
  const designerSlot = designerFilter ? slot++ : -1;
  const clearAllSlot = projectFilter && designerFilter ? slot++ : -1;

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label="Active filters"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={`flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 outline-none ${className}`}
    >
      <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
        Filters:
      </span>

      {projectFilter && (
        <Chip
          label="Project"
          value={projectName || "…"}
          onClear={handleClearProject}
          buttonRef={(el) => { itemsRef.current[projectSlot] = el; }}
        />
      )}

      {designerFilter && (
        <Chip
          label="Designer"
          value={designerLabel || designerFilter}
          onClear={handleClearDesigner}
          buttonRef={(el) => { itemsRef.current[designerSlot] = el; }}
        />
      )}

      {projectFilter && designerFilter && (
        <button
          ref={(el) => { itemsRef.current[clearAllSlot] = el; }}
          type="button"
        onClick={() => (confirmClearAll ? setConfirmOpen(true) : handleClearAll())}
          className="ml-auto font-body text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-sm px-1.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:bg-primary focus-visible:text-primary-foreground"
        >
          Clear all
        </button>
      )}

      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all filters?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove both the project and designer filters across the Trade portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleClearAll(); setConfirmOpen(false); }}>
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Chip({
  label,
  value,
  onClear,
  buttonRef,
}: {
  label: string;
  value: string;
  onClear: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-body text-xs text-foreground">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label.toLowerCase()} filter: ${value}`}
        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:scale-110"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}
