import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Instagram } from "lucide-react";

export default function InstagramAuditCard() {
  const { data: missingCount = 0 } = useQuery({
    queryKey: ["ig-missing-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designers")
        .select("slug, links")
        .eq("is_published", true);
      if (!data) return 0;
      return data.filter((d) => {
        const links = d.links as any[] | null;
        if (!links || !Array.isArray(links)) return true;
        return !links.some((l: any) => l.type === "Instagram" || l.type === "instagram");
      }).length;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Link
      to="/trade/designers/instagram"
      className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
    >
      <Instagram className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      <div className="flex-1">
        <span className="font-display text-sm text-foreground">Instagram Audit</span>
        <p className="font-body text-[10px] text-muted-foreground">Visual map of all designer IG accounts</p>
      </div>
      {missingCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground font-body text-[10px] font-medium">
          {missingCount}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}
