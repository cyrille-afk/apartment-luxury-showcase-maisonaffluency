import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, FolderKanban, Home, ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type BreadcrumbExtraSegment =
  | { kind: "link"; label: string; to: string; icon?: ReactNode }
  | { kind: "current"; label: string; icon?: ReactNode }
  | {
      kind: "dropdown";
      label: string;
      icon?: ReactNode;
      items: Array<{ label: string; onSelect: () => void; active?: boolean }>;
      emptyLabel?: string;
    };

/**
 * Breadcrumb trail for Trade workspace pages.
 *
 * Default shape: `Trade › [Projects ›] [Project name ›] Current section [› Extras…]`
 *
 * - When the URL carries `?project=<id>`, the project name is fetched and
 *   inserted as a link back to the project hub (`/trade/projects/<id>`).
 * - Pass `project={{ id, name }}` to force a project segment regardless of
 *   the URL (used on the project hub itself, where the project is implied
 *   by the route param rather than a query string).
 * - When `project` is provided without `current`, the project segment is
 *   the leaf (non-link). With `current`, the project becomes a link.
 * - `includeProjectsRoot` adds an extra `Projects` link before the project
 *   so users can jump back to the project list.
 * - `currentTo` makes the `current` segment a link (used when extras
 *   continue the trail beyond the page itself).
 * - `extraSegments` appends deeper levels — supports plain links, plain
 *   leaf labels, or a dropdown picker (for jumping between sibling
 *   sections like sub-folders inside a board).
 */
export default function TradeBreadcrumb({
  current,
  currentTo,
  project,
  includeProjectsRoot = false,
  extraSegments = [],
  className = "",
}: {
  current?: string;
  currentTo?: string;
  project?: { id: string; name: string };
  includeProjectsRoot?: boolean;
  extraSegments?: BreadcrumbExtraSegment[];
  className?: string;
}) {
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const [fetchedName, setFetchedName] = useState<string | null>(null);

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
  // The `current` segment is a leaf only when there is no link target AND no extras.
  const currentIsLeaf = !!current && !currentTo && extraSegments.length === 0;
  // The project segment is a leaf only when nothing else follows it.
  const projectIsLeaf = !!project && !current && extraSegments.length === 0;

  const linkCls = "inline-flex items-center gap-1 hover:text-foreground transition-colors";
  const leafCls = "inline-flex items-center gap-1 text-foreground";

  return (
    <nav
      aria-label="Breadcrumb"
      className={`mb-4 flex flex-wrap items-center gap-1.5 font-body text-[11px] text-muted-foreground ${className}`}
    >
      <Link to="/trade" className={linkCls}>
        <Home className="h-3 w-3" />
        Trade
      </Link>

      {includeProjectsRoot && (
        <>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <Link to="/trade/projects" className={linkCls}>Projects</Link>
        </>
      )}

      {projectId && projectName && (
        <>
          <ChevronRight className="h-3 w-3 opacity-60" />
          {projectIsLeaf ? (
            <span className={leafCls} aria-current="page">
              <FolderKanban className="h-3 w-3" />
              {projectName}
            </span>
          ) : (
            <Link to={`/trade/projects/${projectId}`} className={linkCls}>
              <FolderKanban className="h-3 w-3" />
              {projectName}
            </Link>
          )}
        </>
      )}

      {current && (
        <>
          <ChevronRight className="h-3 w-3 opacity-60" />
          {currentIsLeaf ? (
            <span className={leafCls} aria-current="page">{current}</span>
          ) : currentTo ? (
            <Link to={currentTo} className={linkCls}>{current}</Link>
          ) : (
            <span className={linkCls}>{current}</span>
          )}
        </>
      )}

      {extraSegments.map((seg, idx) => {
        const isLast = idx === extraSegments.length - 1;
        return (
          <span key={idx} className="inline-flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 opacity-60" />
            {seg.kind === "link" ? (
              <Link to={seg.to} className={linkCls}>
                {seg.icon}
                {seg.label}
              </Link>
            ) : seg.kind === "current" ? (
              <span className={leafCls} aria-current={isLast ? "page" : undefined}>
                {seg.icon}
                {seg.label}
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`${isLast ? leafCls : linkCls} rounded-sm px-1 -mx-1 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary`}
                >
                  {seg.icon}
                  {seg.label}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Jump to
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {seg.items.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs italic">
                      {seg.emptyLabel || "Nothing here yet"}
                    </DropdownMenuItem>
                  ) : (
                    seg.items.map((it, i) => (
                      <DropdownMenuItem
                        key={i}
                        onSelect={(e) => { e.preventDefault(); it.onSelect(); }}
                        className={`text-xs ${it.active ? "font-medium text-foreground" : ""}`}
                      >
                        {it.label}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </span>
        );
      })}
    </nav>
  );
}

