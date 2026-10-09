import { useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinishSwatch } from "@/lib/finishesSelectionPdf";
import { buildSpecSheetUrl, openSpecSheet } from "@/lib/specSheetUrl";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// jsPDF stays out of the public product bundle — loaded on click only.
const loadFinishesPdf = () => import("@/lib/finishesSelectionPdf");

interface Props {
  /** designer_curator_picks.id */
  pickId: string;
  productName: string;
  brandName?: string | null;
  className?: string;
  icon?: React.ReactNode;
  /** Return false to cancel (auth gates). */
  onBeforeOpen?: () => boolean;
  /** Supplier documents labelled Fabric & Finishes; other spec sheets remain separate. */
  documents?: { label: string; url: string }[] | null;
  onBeforeDocumentOpen?: () => boolean;
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
  documents,
  onBeforeDocumentOpen,
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

      const CATEGORY_ORDER = ["Fabric & Leather", "Leather", "Wood", "Metal", "Stone", "Glass", "Ceramic"];
      const catRank = (c?: string | null) => {
        const i = CATEGORY_ORDER.indexOf((c || "").trim());
        return i === -1 ? CATEGORY_ORDER.length : i;
      };

      const swatches: FinishSwatch[] = (data || [])
        .filter((r: any) => r?.name && r?.is_active !== false)
        .slice()
        .sort(
          (a: any, b: any) =>
            (a.supplier || "").localeCompare(b.supplier || "") ||
            catRank(a.category) - catRank(b.category) ||
            (a.category || "").localeCompare(b.category || "") ||
            (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
            (a.name || "").localeCompare(b.name || ""),
        )
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

      const { buildFinishesSelectionPdf, finishesPdfFileName } = await loadFinishesPdf();
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

  const finishDocuments = (documents || []).filter((entry) =>
    entry.url && /^fabric\s*(?:&|and)\s*finishes\b/i.test(entry.label),
  );
  const action = (
    <button
      type="button"
      onClick={finishDocuments.length ? undefined : handleClick}
      disabled={loading}
      className={className}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2 size={14} strokeWidth={1.25} className="shrink-0 animate-spin" />
      ) : (
        icon ?? <Layers size={14} strokeWidth={1.25} className="shrink-0" />
      )}
      <span className="flex items-center gap-1.5">
        Fabric &amp; Finishes
        {!loading && (
          <span className="px-1 py-0.5 border border-current/30 rounded text-[9px] leading-none tracking-wider">
            PDF
          </span>
        )}
      </span>
    </button>
  );

  if (!finishDocuments.length) return action;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{action}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleClick(); }}>
          Fabric &amp; Finishes Selection
        </DropdownMenuItem>
        {finishDocuments.map((entry) => (
          <DropdownMenuItem key={entry.url} onSelect={() => {
            if (onBeforeDocumentOpen && !onBeforeDocumentOpen()) return;
            openSpecSheet(buildSpecSheetUrl(entry.url, brandName || "", productName, entry.label));
          }}>
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
