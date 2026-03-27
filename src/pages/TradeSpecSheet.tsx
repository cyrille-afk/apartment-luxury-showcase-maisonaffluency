import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";

/**
 * In-app spec sheet viewer.
 * URL pattern: /trade/spec-sheet?brand=Ecart&product=Wolf+Armchair
 * Resolves the actual PDF URL from the database so the address bar stays clean.
 * Mobile: shows a download card + Google Docs embedded viewer for better rendering.
 */
export default function TradeSpecSheet() {
  const [params] = useSearchParams();
  const brand = params.get("brand") || "Spec Sheet";
  const product = params.get("product") || "";
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const pageTitle = product
    ? `${brand} — ${product} Spec Sheet`
    : `${brand} Spec Sheet`;

  useEffect(() => {
    if (!product) { setLoading(false); return; }

    const resolve = async () => {
      const { data: pick } = await supabase
        .from("designer_curator_picks")
        .select("pdf_url")
        .ilike("title", product)
        .not("pdf_url", "is", null)
        .limit(1)
        .maybeSingle();

      if (pick?.pdf_url) { setPdfUrl(pick.pdf_url); setLoading(false); return; }

      const { data: tp } = await supabase
        .from("trade_products")
        .select("spec_sheet_url")
        .ilike("product_name", product)
        .not("spec_sheet_url", "is", null)
        .limit(1)
        .maybeSingle();

      if (tp?.spec_sheet_url) { setPdfUrl(tp.spec_sheet_url); }
      setLoading(false);
    };

    resolve();
  }, [product]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">Loading spec sheet…</p>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">No spec sheet found.</p>
      </div>
    );
  }

  /* Mobile: Google Docs viewer iframe + prominent download button */
  if (isMobile) {
    const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl)}`;

    return (
      <>
        <Helmet>
          <title>{pageTitle} | Maison & Ateliers</title>
        </Helmet>

        <div className="flex flex-col h-[calc(100vh-4rem)]">
          {/* Header bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background">
            <div className="min-w-0 flex-1">
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider truncate">{brand}</p>
              <h1 className="font-display text-sm text-foreground truncate">{product} — Spec Sheet</h1>
            </div>
            <Button size="sm" className="gap-1.5 bg-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/90 text-white shrink-0" asChild>
              <a href={pdfUrl} download={`${brand} — ${product} Spec Sheet.pdf`}>
                <FileDown className="w-3.5 h-3.5" />
                Download
              </a>
            </Button>
          </div>

          {/* Google Docs viewer for mobile-friendly PDF rendering */}
          <div className="flex-1 bg-muted/20">
            <iframe
              src={googleViewerUrl}
              title={pageTitle}
              className="w-full h-full border-0"
              allow="fullscreen"
            />
          </div>
        </div>
      </>
    );
  }

  /* Desktop: native PDF iframe */
  return (
    <>
      <Helmet>
        <title>{pageTitle} | Maison & Ateliers</title>
      </Helmet>
      <div className="w-full h-[calc(100vh-4rem)]">
        <iframe
          src={pdfUrl}
          title={pageTitle}
          className="w-full h-full border-0"
          allow="fullscreen"
        />
      </div>
    </>
  );
}
