import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface InlineRec {
  product_id: string;
  reason: string;
  title: string;
  image_url: string;
  brand: string;
}

export function GalleryInlineSuggestions() {
  const { user } = useAuth();
  const [recs, setRecs] = useState<InlineRec[]>([]);
  const [boardTitle, setBoardTitle] = useState("");

  useEffect(() => {
    if (!user) return;

    (async () => {
      // Find user's most recently updated board with items
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
          .limit(3);

        if (cached && cached.length >= 3) {
          const productIds = cached.map((r) => r.product_id);
          const { data: products } = await supabase
            .from("designer_curator_picks")
            .select("id, title, image_url, designer_id")
            .in("id", productIds);

          const designerIds = [...new Set((products || []).map((p) => p.designer_id))];
          const { data: designers } = await supabase
            .from("designers")
            .select("id, name")
            .in("id", designerIds);

          const dm = new Map((designers || []).map((d) => [d.id, d.name]));

          setRecs(
            cached.map((r) => {
              const p = (products || []).find((x) => x.id === r.product_id);
              return {
                product_id: r.product_id,
                reason: r.reason,
                title: p?.title || "",
                image_url: p?.image_url || "",
                brand: dm.get(p?.designer_id) || "",
              };
            })
          );
          setBoardTitle(b.title);
          break;
        }
      }
    })();
  }, [user]);

  if (recs.length < 3) return null;

  return (
    <div className="col-span-full border border-primary/20 rounded-lg p-4 bg-primary/5">
      <p className="text-xs font-medium text-primary flex items-center gap-1.5 mb-3">
        <Sparkles className="h-3.5 w-3.5" />
        Suggested for <em className="not-italic font-semibold">{boardTitle}</em>
      </p>
      <div className="grid grid-cols-3 gap-3">
        {recs.map((rec) => (
          <div key={rec.product_id} className="group">
            <div className="aspect-square rounded overflow-hidden bg-muted mb-1.5">
              {rec.image_url ? (
                <img
                  src={rec.image_url}
                  alt={rec.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
            </div>
            <p className="text-[11px] font-medium text-foreground truncate">{rec.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{rec.brand}</p>
            <p className="text-[9px] text-primary/60 truncate">{rec.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
