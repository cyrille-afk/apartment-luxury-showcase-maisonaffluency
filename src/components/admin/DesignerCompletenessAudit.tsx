import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, CheckCircle2, AlertCircle, Circle, Search } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

interface DesignerStatus {
  id: string;
  name: string;
  slug: string;
  hasBio: boolean;
  hasPhilosophy: boolean;
  hasHero: boolean;
  
  picksCount: number;
  hasHeritageSlides: boolean;
  hasInstagram: boolean;
  score: number;
  maxScore: number;
}

type FilterMode = "all" | "complete" | "almost" | "incomplete";

export default function DesignerCompletenessAudit() {
  const [filter, setFilter] = useState<FilterMode>("incomplete");
  const [search, setSearch] = useState("");

  const { data: designers } = useQuery({
    queryKey: ["designers-list-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designers")
        .select("id, name, slug, biography, philosophy, hero_image_url, logo_url, instagram_handle, is_published")
        .eq("is_published", true)
        .order("name");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: pickCounts } = useQuery({
    queryKey: ["picks-counts-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designer_curator_picks")
        .select("designer_id");
      if (!data) return {};
      const counts: Record<string, number> = {};
      data.forEach((r: any) => {
        counts[r.designer_id] = (counts[r.designer_id] || 0) + 1;
      });
      return counts;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: heritageIds } = useQuery({
    queryKey: ["heritage-ids-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designer_heritage_slides")
        .select("designer_id");
      if (!data) return new Set<string>();
      return new Set(data.map((r: any) => r.designer_id));
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: instagramPostIds } = useQuery({
    queryKey: ["instagram-post-ids-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designer_instagram_posts")
        .select("designer_id")
        .eq("hidden", false);
      if (!data) return new Set<string>();
      return new Set(data.map((r: any) => r.designer_id));
    },
    staleTime: 1000 * 60 * 5,
  });

  const statuses = useMemo<DesignerStatus[]>(() => {
    if (!designers || !pickCounts || !heritageIds || !instagramPostIds) return [];
    return designers.map((d: any) => {
      const hasBio = !!(d.biography && d.biography.trim());
      const hasPhilosophy = !!(d.philosophy && d.philosophy.trim());
      const hasHero = !!(d.hero_image_url && d.hero_image_url.trim());
      
      const picksCount = pickCounts[d.id] || 0;
      const hasPicks = picksCount > 0;
      const hasHeritageSlides = heritageIds.has(d.id);
      const hasInstagram = !!(d.instagram_handle && d.instagram_handle.trim()) || instagramPostIds.has(d.id);

      let score = 0;
      const maxScore = 6;
      if (hasBio) score++;
      if (hasPhilosophy) score++;
      if (hasHero) score++;
      
      if (hasPicks) score++;
      if (hasHeritageSlides) score++;
      if (hasInstagram) score++;

      return { id: d.id, name: d.name, slug: d.slug, hasBio, hasPhilosophy, hasHero, picksCount, hasHeritageSlides, hasInstagram, score, maxScore };
    });
  }, [designers, pickCounts, heritageIds, instagramPostIds]);

  const summary = useMemo(() => {
    const total = statuses.length;
    const complete = statuses.filter((s) => s.score === s.maxScore).length;
    const hasPicks = statuses.filter((s) => s.picksCount > 0).length;
    const hasHero = statuses.filter((s) => s.hasHero).length;
    const hasBio = statuses.filter((s) => s.hasBio).length;
    const hasPhilosophy = statuses.filter((s) => s.hasPhilosophy).length;
    return { total, complete, hasPicks, hasHero, hasBio, hasPhilosophy };
  }, [statuses]);

  const filtered = useMemo(() => {
    let list = statuses;
    if (filter === "complete") list = list.filter((s) => s.score === s.maxScore);
    if (filter === "incomplete") list = list.filter((s) => s.score < s.maxScore);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [statuses, filter, search]);

  if (!designers) return null;

  const Dot = ({ ok }: { ok: boolean }) =>
    ok ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
    ) : (
      <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    );

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 group cursor-pointer w-full">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <h2 className="font-display text-lg text-foreground">Biography Completeness</h2>
        <span className="ml-auto font-body text-xs text-muted-foreground">
          {summary.complete}/{summary.total} fully complete
        </span>
      </CollapsibleTrigger>
      <p className="font-body text-xs text-muted-foreground ml-6 mt-0.5">
        Bio {summary.hasBio} · Philosophy {summary.hasPhilosophy} · Hero {summary.hasHero} · Picks {summary.hasPicks}
      </p>

      <CollapsibleContent className="mt-4 space-y-3">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter designers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-1">
            {(["incomplete", "all", "complete"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-[0.1em] border transition-colors ${
                  filter === f
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                {f} {f === "incomplete" ? `(${statuses.filter((s) => s.score < s.maxScore).length})` : f === "complete" ? `(${summary.complete})` : `(${summary.total})`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_40px_40px_40px_40px_40px_40px_60px] gap-0 text-[10px] font-body uppercase tracking-wider text-muted-foreground bg-muted/30 px-3 py-2 border-b border-border">
            <span>Designer</span>
            <span className="text-center" title="Biography">Bio</span>
            <span className="text-center" title="Philosophy">Phil</span>
            <span className="text-center" title="Hero Image">Hero</span>
            <span className="text-center" title="Curator's Picks">Picks</span>
            <span className="text-center" title="Heritage Slides">Herit</span>
            <span className="text-center" title="Instagram">IG</span>
            <span className="text-center">Score</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
            {filtered.map((s) => (
              <Link
                key={s.id}
                to={`/designers/${s.slug}`}
                target="_blank"
                className="grid grid-cols-[1fr_40px_40px_40px_40px_40px_40px_60px] gap-0 px-3 py-2 items-center hover:bg-muted/20 transition-colors"
              >
                <span className="font-body text-xs text-foreground truncate pr-2">{s.name}</span>
                <span className="flex justify-center"><Dot ok={s.hasBio} /></span>
                <span className="flex justify-center"><Dot ok={s.hasPhilosophy} /></span>
                <span className="flex justify-center"><Dot ok={s.hasHero} /></span>
                <span className="flex justify-center">
                  {s.picksCount > 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span className="text-[10px] text-muted-foreground">{s.picksCount}</span>
                    </span>
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
                  )}
                </span>
                <span className="flex justify-center"><Dot ok={s.hasHeritageSlides} /></span>
                <span className="flex justify-center"><Dot ok={s.hasInstagram} /></span>
                <span className="flex justify-center">
                  <span className={`font-body text-xs font-medium ${
                    s.score === s.maxScore ? "text-success" : s.score >= 5 ? "text-warning" : "text-destructive"
                  }`}>
                    {s.score}/{s.maxScore}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <p className="font-body text-[10px] text-muted-foreground/60 text-right">
          Showing {filtered.length} of {statuses.length} designers
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
