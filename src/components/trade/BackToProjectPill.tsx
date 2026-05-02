import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Renders a "Back to project" pill at the top of any Trade workspace page
 * when the URL carries a `?project=<id>` filter. Lets users drill into
 * quotes / boards / tearsheets / FF&E from a project hub and return.
 */
export default function BackToProjectPill({ className = "" }: { className?: string }) {
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

  if (!projectId) return null;

  return (
    <div className={`mb-3 ${className}`}>
      <Link
        to={`/trade/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted/60 px-3 py-1 font-body text-[11px] text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        <FolderKanban className="h-3 w-3 text-muted-foreground" />
        Back to project{name ? `: ${name}` : ""}
      </Link>
    </div>
  );
}
