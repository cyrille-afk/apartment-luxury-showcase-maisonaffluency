import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, FolderKanban, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Breadcrumb trail for Trade workspace pages.
 *
 * Shape: Trade › [Project name ›] Current section
 *
 * When the URL carries `?project=<id>`, the project segment is inserted as
 * a link back to the project hub (`/trade/projects/<id>`). Project-aware
 * pages (Quotes, Boards, Tearsheets, FF&E, Order timeline, Board builder)
 * mount this at the top so users can always jump back to the hub.
 */
export default function TradeBreadcrumb({
  current,
  className = "",
}: {
  /** Label of the current page, e.g. "Quotes", "Board builder". */
  current: string;
  className?: string;
}) {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) { setName(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle();
      if (!cancelled) setName((data as any)?.name ?? null);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <nav
      aria-label="Breadcrumb"
      className={`mb-4 flex flex-wrap items-center gap-1.5 font-body text-[11px] text-muted-foreground ${className}`}
    >
      <Link
        to="/trade"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3 w-3" />
        Trade
      </Link>

      {projectId && (
        <>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <Link
            to={`/trade/projects/${projectId}`}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <FolderKanban className="h-3 w-3" />
            {name || "Project"}
          </Link>
        </>
      )}

      <ChevronRight className="h-3 w-3 opacity-60" />
      <span className="text-foreground" aria-current="page">{current}</span>
    </nav>
  );
}
