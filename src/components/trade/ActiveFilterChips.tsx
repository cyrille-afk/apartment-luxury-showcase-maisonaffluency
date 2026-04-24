import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { useDesignerDisplayName } from "@/hooks/useDesignerDisplayName";
import { supabase } from "@/integrations/supabase/client";

/**
 * Renders the currently-active project + designer filters as removable chips.
 * Used in the hub header (TradeProjectDetail) and on TradeQuotes / TradeBoards.
 *
 * Each chip clears just its own filter; "Clear all" wipes both.
 * Renders nothing when no filter is active.
 */
export default function ActiveFilterChips({ className = "" }: { className?: string }) {
  const {
    projectFilter,
    designerFilter,
    clearProjectFilter,
    clearDesignerFilter,
    clearAllFilters,
  } = useProjectFilter();
  const designerLabel = useDesignerDisplayName(designerFilter);
  const [projectName, setProjectName] = useState<string | null>(null);

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

  if (!projectFilter && !designerFilter) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 ${className}`}
    >
      <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
        Filters:
      </span>

      {projectFilter && (
        <Chip
          label="Project"
          value={projectName || "…"}
          onClear={clearProjectFilter}
        />
      )}

      {designerFilter && (
        <Chip
          label="Designer"
          value={designerLabel || designerFilter}
          onClear={clearDesignerFilter}
        />
      )}

      {projectFilter && designerFilter && (
        <button
          onClick={clearAllFilters}
          className="ml-auto font-body text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function Chip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-body text-xs text-foreground">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground"
        aria-label={`Clear ${label.toLowerCase()} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
