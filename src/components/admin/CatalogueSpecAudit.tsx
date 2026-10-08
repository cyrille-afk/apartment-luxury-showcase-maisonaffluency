import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { auditCatalogueSpec, SPEC_ISSUE_LABEL, type SpecIssue } from "@/lib/catalogueSpecAudit";

export default function CatalogueSpecAudit() {
  const [filter, setFilter] = useState<SpecIssue | "all">("all");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["catalogue-spec-audit"],
    queryFn: async () => {
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("designer_curator_picks")
          .select("id, title, dimensions, materials, size_variants, designer_id, designers(name)")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
    staleTime: 60_000,
  });

  const flagged = useMemo(
    () =>
      rows
        .map((r) => ({ r, issues: auditCatalogueSpec(r) }))
        .filter((x) => x.issues.length)
        .sort((a, b) => String(a.r.designers?.name ?? "").localeCompare(String(b.r.designers?.name ?? ""))),
    [rows],
  );
  const count = (i: SpecIssue) => flagged.filter((f) => f.issues.includes(i)).length;
  const shown = filter === "all" ? flagged : flagged.filter((f) => f.issues.includes(filter));

  return (
    <Collapsible className="mb-6 border border-border rounded-md">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-sm font-medium">
        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        <AlertTriangle className="h-4 w-4 text-destructive" />
        Catalogue spec check {isLoading ? "…" : `— ${flagged.length} products flagged`}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All ({flagged.length})</Button>
          {(Object.keys(SPEC_ISSUE_LABEL) as SpecIssue[]).map((i) => (
            <Button key={i} size="sm" variant={filter === i ? "default" : "outline"} onClick={() => setFilter(i)}>
              {SPEC_ISSUE_LABEL[i]} ({count(i)})
            </Button>
          ))}
        </div>
        <ul className="divide-y divide-border max-h-96 overflow-auto text-sm">
          {shown.map(({ r, issues }) => (
            <li key={r.id} className="py-2 flex flex-wrap justify-between gap-2">
              <span><span className="text-muted-foreground">{r.designers?.name ?? "—"} · </span>{r.title || "Untitled"}</span>
              <span className="text-xs text-destructive">{issues.map((i) => SPEC_ISSUE_LABEL[i]).join(" · ")}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
