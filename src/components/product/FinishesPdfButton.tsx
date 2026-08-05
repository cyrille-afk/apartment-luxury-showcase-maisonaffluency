import { useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  buildFinishesSelectionPdf,
  finishesPdfFileName,
  type FinishSwatch,
} from "@/lib/finishesSelectionPdf";

interface Props {
  /** designer_curator_picks.id */
  pickId: string;
  productName: string;
  brandName?: string | null;
  className?: string;
  icon?: React.ReactNode;
  /** Return false to cancel (auth gates). */
  onBeforeOpen?: () => boolean;
}

/**
 * Desktop utility action that exports the product's linked fabric / wood
 * swatches as a branded "Fabric and Finishes Selection" PDF.
 */
export default function FinishesPdfButton({
  pickId,
  productName,
  brandName,
  className,
  icon,
  onBeforeOpen,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    if (onBeforeOpen && !onBeforeOpen()) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("product_fabric_swatches_public")
        .select("name, image_url, category, supplier, is_active, sort_order")
        .eq("pick_id", pickId)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      const swatches: FinishSwatch[] = (data || [])
        .filter((r: any) => r?.name && r?.is_active !== false)
        .map((r: any) => ({
          name: r.name,
          imageUrl: r.image_url,
          group: [r.supplier, r.category].filter(Boolean).join(" - "),
        }));

      if (swatches.length === 0) {
        toast({
          title: "No finishes available",
          description: "This piece has no swatches linked yet.",
        });
        return;
      }

      const doc = await buildFinishesSelectionPdf({ productName, brandName, swatches });
      doc.save(finishesPdfFileName(productName));
    } catch (err) {
      console.error("[FinishesPdfButton] failed:", err);
      toast({
        title: "Export failed",
        description: "We couldn't build the finishes PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2 size={14} strokeWidth={1.25} className="shrink-0 animate-spin" />
      ) : (
        icon ?? <Layers size={14} strokeWidth={1.25} className="shrink-0" />
      )}
      Fabric &amp; Finishes
    </button>
  );
}
