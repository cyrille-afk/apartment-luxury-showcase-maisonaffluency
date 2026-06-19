/**
 * Lightweight A–Z text index linking every published designer profile.
 *
 * Purpose: SEO crawl-depth flattening + internal-backlink density.
 * Mounted at the bottom of the homepage and the Journal index so every
 * /designers/:slug profile is reachable within 1 click of the two highest-
 * authority pages on the site. Resolves the lovablehtml.com findings:
 * INTERNAL_BACKLINKS_LOW + PAGE_DEPTH_DEEP across /designers/*.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import designersSeed from "@/data/designersIndex.json";

interface DesignerLink {
  slug: string;
  name: string;
}

const SEED = designersSeed as DesignerLink[];

function useAllPublishedDesigners() {
  return useQuery({
    queryKey: ["all-published-designers-index"],
    staleTime: 1000 * 60 * 60, // 1h
    initialData: SEED,
    queryFn: async () => {
      // Lift Supabase's default 1000-row cap explicitly; catalog has ~700 designers.
      const { data, error } = await supabase
        .from("designers")
        .select("slug, name")
        .eq("is_published", true)
        .eq("trade_only", false)
        .order("name", { ascending: true })
        .range(0, 1499);
      if (error) throw error;
      return (data || []) as DesignerLink[];
    },
  });
}

const DesignerIndexLinks = () => {
  const { data: designers } = useAllPublishedDesigners();

  if (!designers?.length) return null;

  return (
    <nav
      aria-label="All designers index"
      className="border-t border-border/50 bg-background"
    >
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="font-display text-xl md:text-2xl text-foreground mb-2">
          Designers A–Z
        </h2>
        <p className="font-body text-xs uppercase tracking-[0.18em] text-muted-foreground mb-6">
          Browse the full directory · {designers.length} profiles
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2">
          {designers.map((d) => (
            <li key={d.slug}>
              <Link
                to={`/designers/${d.slug}`}
                className="font-body text-[13px] text-muted-foreground hover:text-primary transition-colors leading-tight"
              >
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default DesignerIndexLinks;
