import { X } from "lucide-react";
import { useEffect, useState } from "react";
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
    // Reset shortly after so re-clearing the same thing re-announces.
    window.setTimeout(() => setAnnouncement(""), 1000);
  };

  const handleClearProject = () => { clearProjectFilter(); announceCleared(`Project ${projectName || ""}`.trim()); };
  const handleClearDesigner = () => { clearDesignerFilter(); announceCleared(`Designer ${designerLabel || designerFilter || ""}`.trim()); };
  const handleClearAll = () => { clearAllFilters(); announceCleared("All"); };

  if (!projectFilter && !designerFilter) return null;

  return (
    <div
      role="region"
      aria-label="Active filters"
      className={`flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 ${className}`}
    >
      <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
        Filters:
      </span>

      {projectFilter && (
        <Chip
          label="Project"
          value={projectName || "…"}
          onClear={handleClearProject}
        />
      )}

      {designerFilter && (
        <Chip
          label="Designer"
          value={designerLabel || designerFilter}
          onClear={handleClearDesigner}
        />
      )}

      {projectFilter && designerFilter && (
        <button
          type="button"
          onClick={() => (confirmClearAll ? setConfirmOpen(true) : handleClearAll())}
          className="ml-auto font-body text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Clear all
        </button>
      )}

      {/* SR-only live region announces clear actions */}
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

function Chip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-body text-xs text-foreground">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label.toLowerCase()} filter: ${value}`}
        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}
