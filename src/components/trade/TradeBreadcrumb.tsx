import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, FolderKanban, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Breadcrumb trail for Trade workspace pages.
 *
 * Default shape: `Trade › [Project name ›] Current section`
 *
 * - When the URL carries `?project=<id>`, the project name is fetched and
 *   inserted as a link back to the project hub (`/trade/projects/<id>`).
 * - Pass `project={{ id, name }}` to force a project segment regardless of
 *   the URL (used on the project hub itself, where the project is implied
 *   by the route param rather than a query string).
 * - When `project` is provided, the project segment becomes the current
 *   page (non-link) UNLESS `current` is also provided, in which case the
 *   project becomes a link and `current` is the leaf segment.
 * - `includeProjectsRoot` adds an extra `Projects` link before the project
 *   so users can jump back to the project list.
 */
export default function TradeBreadcrumb({
  current,
  project,
  includeProjectsRoot = false,
  className = "",
}: {
  /** Label of the current page, e.g. "Quotes", "Board builder". Optional when `project` is the leaf. */
  current?: string;
  /** Explicit project segment. Overrides `?project=` lookup. */
  project?: { id: string; name: string };
  /** Insert a "Projects" link between Trade and the project segment. */
  includeProjectsRoot?: boolean;
  className?: string;
}) {
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [fetchedName, setFetchedName] = useState<string | null>(null);

  // Only fetch when we don't already have an explicit project prop.
  const shouldFetch = !project && !!queryProjectId;

  useEffect(() => {
    if (!shouldFetch) { setFetchedName(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("projects")
        .select("name")
        .eq("id", queryProjectId)
        .maybeSingle();
      if (!cancelled) setFetchedName((data as any)?.name ?? null);
    })();
    return () => { cancelled = true; };
  }, [shouldFetch, queryProjectId]);

  const projectId = project?.id ?? queryProjectId ?? null;
  const projectName = project?.name ?? fetchedName ?? (projectId ? "Project" : null);
  // If the explicit project is the leaf (no `current`), don't link it.
  const projectIsLeaf = !!project && !current;

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

      {includeProjectsRoot && (
        <>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <Link
            to="/trade/projects"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Projects
          </Link>
        </>
      )}

      {projectId && projectName && (
        <>
          <ChevronRight className="h-3 w-3 opacity-60" />
          {projectIsLeaf ? (
            <span className="inline-flex items-center gap-1 text-foreground" aria-current="page">
              <FolderKanban className="h-3 w-3" />
              {projectName}
            </span>
          ) : (
            <Link
              to={`/trade/projects/${projectId}`}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <FolderKanban className="h-3 w-3" />
              {projectName}
            </Link>
          )}
        </>
      )}

      {current && (
        <>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <span className="text-foreground" aria-current="page">{current}</span>
        </>
      )}
    </nav>
  );
}
