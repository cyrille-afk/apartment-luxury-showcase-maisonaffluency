import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

/**
 * Clean URL redirect: /spec-sheets/atelier-pendhapa-akar-dining-chair
 * → /trade/spec-sheet?brand=Atelier+Pendhapa&product=Akar+Dining+Chair
 *
 * Slug format: brand-name-product-name (all lowercase, hyphens)
 * We resolve the actual brand/product from the database.
 */
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export default function SpecSheetRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); return; }

    const resolve = async () => {
      // Try to find a matching curator pick by slugifying title
      const { data: picks } = await supabase
        .from("designer_curator_picks")
        .select("title, pdf_url, designer_id")
        .not("pdf_url", "is", null);

      if (!picks?.length) { setNotFound(true); return; }

      // Also fetch designer names
      const designerIds = [...new Set(picks.map(p => p.designer_id))];
      const { data: designers } = await supabase
        .from("designers")
        .select("id, name")
        .in("id", designerIds);

      const designerMap = new Map(designers?.map(d => [d.id, d.name]) || []);

      // Find matching pick by slugified brand+product
      const toSlug = (s: string) =>
        s.toLowerCase()
          .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e")
          .replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o")
          .replace(/[ùúûü]/g, "u").replace(/[ñ]/g, "n")
          .replace(/&/g, "and")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      for (const pick of picks) {
        const brand = designerMap.get(pick.designer_id) || "";
        const candidate = toSlug(`${brand}-${pick.title}`);
        if (candidate === slug) {
          navigate(
            `/trade/spec-sheet?brand=${encodeURIComponent(brand)}&product=${encodeURIComponent(pick.title)}`,
            { replace: true }
          );
          return;
        }
      }

      setNotFound(true);
    };

    resolve();
  }, [slug, navigate]);

  if (notFound) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">Spec sheet not found.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <p className="font-body text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
