import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, ChevronRight } from "lucide-react";
import { normalizeBrandToParent } from "@/lib/brandNormalization";

interface InlineRec {
  product_id: string;
  reason: string;
  title: string;
  image_url: string;
  brand: string;
  category?: string;
  subcategory?: string;
}

interface Props {
  selectedCategory?: string;
  selectedSubcategory?: string;
  selectedBrand?: string;
  onProductClick?: (productId: string) => void;
}

export function GalleryInlineSuggestions({ selectedCategory, selectedSubcategory, selectedBrand, onProductClick }: Props) {
  const { user } = useAuth();
  const [allRecs, setAllRecs] = useState<InlineRec[]>([]);
  const [boardTitle, setBoardTitle] = useState("");

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data: boards } = await supabase
        .from("client_boards")
        .select("id, title")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (!boards?.length) return;

      for (const b of boards) {
        const { data: cached } = await supabase
          .from("board_recommendations")
          .select("product_id, reason")
          .eq("board_id", b.id)
          .order("score", { ascending: false })
          .limit(12);

        if (cached && cached.length >= 3) {
          const productIds = cached.map((r) => r.product_id);
          const { data: products } = await supabase
            .from("designer_curator_picks")
            .select("id, title, image_url, designer_id, category, subcategory")
            .in("id", productIds);

          const designerIds = [...new Set((products || []).map((p) => p.designer_id))];
          const { data: designers } = await supabase
            .from("designers")
            .select("id, name, founder")
            .in("id", designerIds);

          const dm = new Map((designers || []).map((d) => [d.id, d]));

          setAllRecs(
            cached.map((r) => {
              const p = (products || []).find((x) => x.id === r.product_id);
              const designer = dm.get(p?.designer_id);
              const childName = designer?.name?.trim() || "";
              const brandName = normalizeBrandToParent(childName);
              const founderName = (designer as any)?.founder?.trim();
              // Build display: "Designer by Parent" or just brand
              const displayBrand = founderName && founderName.toLowerCase() !== childName.toLowerCase() && founderName.toLowerCase() !== brandName.toLowerCase()
                ? `${brandName} by ${founderName}`
                : brandName;
              return {
                product_id: r.product_id,
                reason: r.reason,
                title: p?.title || "",
                image_url: p?.image_url || "",
                brand: displayBrand,
                category: p?.category || undefined,
                subcategory: p?.subcategory || undefined,
              };
            })
          );
          setBoardTitle(b.title);
          break;
        }
      }
    })();
  }, [user]);

  // Filter by active category/subcategory/brand
  const filtered = allRecs.filter((r) => {
    if (selectedCategory && selectedCategory !== "all" && r.category !== selectedCategory) return false;
    if (selectedSubcategory && selectedSubcategory !== "all" && r.subcategory !== selectedSubcategory) return false;
    if (selectedBrand && selectedBrand !== "all") {
      // Match if brand display contains the selected brand name
      if (!r.brand.toLowerCase().includes(selectedBrand.toLowerCase())) return false;
    }
    return true;
  });

  if (filtered.length === 0) return null;

  const shown = filtered.slice(0, 4);

  return (
    <div className="flex items-center gap-4 px-1 py-2.5 mb-2 border-b border-border/40">
      <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap shrink-0">
        <Sparkles className="h-3 w-3 text-primary/60" />
        <span>For <em className="not-italic text-primary/80 font-semibold">{boardTitle}</em></span>
      </p>
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
        {shown.map((rec) => (
          <button
            key={rec.product_id}
            onClick={() => onProductClick?.(rec.product_id)}
            className="flex items-center gap-2.5 shrink-0 hover:bg-muted/40 rounded-md px-1.5 py-1 -mx-1.5 -my-1 transition-colors cursor-pointer text-left"
          >
            <div className="w-11 h-11 rounded overflow-hidden bg-muted shrink-0">
              {rec.image_url && (
                <img src={rec.image_url} alt={rec.title} className="w-full h-full object-cover" loading="lazy" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate max-w-[140px]">{rec.title}</p>
              <p className="text-[9px] text-muted-foreground truncate max-w-[140px]">{rec.brand}</p>
            </div>
          </button>
        ))}
      </div>
      {filtered.length > 4 && (
        <span className="text-[9px] text-muted-foreground/60 shrink-0 flex items-center gap-0.5">
          +{filtered.length - 4} more <ChevronRight className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}
