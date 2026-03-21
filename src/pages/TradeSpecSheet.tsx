import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * In-app spec sheet viewer.
 * URL pattern: /trade/spec-sheet?brand=Ecart&product=Wolf+Armchair
 * Resolves the actual PDF URL from the database so the address bar stays clean.
 */
export default function TradeSpecSheet() {
  const [params] = useSearchParams();
  const brand = params.get("brand") || "Spec Sheet";
  const product = params.get("product") || "";
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pageTitle = product
    ? `${brand} — ${product} Spec Sheet`
    : `${brand} Spec Sheet`;

  useEffect(() => {
    if (!product) { setLoading(false); return; }

    const resolve = async () => {
      // Try designer_curator_picks first
      const { data: pick } = await supabase
        .from("designer_curator_picks")
        .select("pdf_url")
        .ilike("title", product)
        .not("pdf_url", "is", null)
        .limit(1)
        .maybeSingle();

      if (pick?.pdf_url) { setPdfUrl(pick.pdf_url); setLoading(false); return; }

      // Fallback to trade_products
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
