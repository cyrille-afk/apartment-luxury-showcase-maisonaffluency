import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackDownload } from "@/lib/trackDownload";
import { getSignedSpecSheetUrl } from "@/utils/signedSpecSheetUrl";
import { useIsMobile } from "@/hooks/use-mobile";
import { FileDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import AuthGateDialog from "@/components/AuthGateDialog";

/**
 * In-app spec sheet viewer.
 * URL pattern: /trade/spec-sheet?brand=Ecart&product=Wolf+Armchair
 * Resolves the actual PDF URL from the database so the address bar stays clean.
 * SECURITY: PDF viewing AND downloading require authentication.
 */
export default function TradeSpecSheet() {
  const [params] = useSearchParams();
  const brand = params.get("brand") || "Spec Sheet";
  const product = params.get("product") || "";
  const sheetLabel = params.get("sheet") || "";
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  const pageTitle = product
    ? `${brand} — ${product} Spec Sheet`
    : `${brand} Spec Sheet`;

  useEffect(() => {
    if (!product || !user) { setLoading(false); return; }

    const resolve = async () => {
      const { data: pick } = await supabase
        .from("designer_curator_picks")
        .select("pdf_url, pdf_urls")
        .ilike("title", product)
        .limit(1)
        .maybeSingle();

      // Resolve from pdf_urls (multi-PDF) — match by label if provided, else first entry.
      // Fall back to legacy pdf_url.
      const pdfList = (pick?.pdf_urls as any[] | null) ?? [];
      const matched = sheetLabel
        ? pdfList.find((p) => (p?.label || "").trim().toLowerCase() === sheetLabel.trim().toLowerCase())
        : null;
      const resolvedUrl = matched?.url
        || pdfList[0]?.url
        || pick?.pdf_url
        || null;

      if (resolvedUrl) {
        const signed = await getSignedSpecSheetUrl(resolvedUrl);
        setPdfUrl(signed);
        setLoading(false);
        return;
      }

      const { data: tp } = await supabase
        .from("trade_products")
        .select("spec_sheet_url")
        .ilike("product_name", product)
        .not("spec_sheet_url", "is", null)
        .limit(1)
        .maybeSingle();

      if (tp?.spec_sheet_url) {
        const signed = await getSignedSpecSheetUrl(tp.spec_sheet_url);
        setPdfUrl(signed);
      }
      setLoading(false);
    };

    resolve();
  }, [product, user]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">Loading spec sheet…</p>
      </div>
    );
  }

  /* ── Auth gate: user must be registered to view or download ── */
  if (!user) {
    return (
      <>
        <Helmet>
          <title>{pageTitle} | Maison & Ateliers</title>
        </Helmet>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl text-foreground mb-2">{pageTitle}</h1>
            <p className="font-body text-sm text-muted-foreground max-w-md">
              Register or sign in to view and download this spec sheet.
            </p>
          </div>
          <Button
            className="gap-2 bg-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/90 text-white"
            onClick={() => setGateOpen(true)}
          >
            <FileDown className="w-4 h-4" />
            Sign in to view
          </Button>
        </div>
        <AuthGateDialog open={gateOpen} onClose={() => setGateOpen(false)} action="view this spec sheet" />
      </>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">No spec sheet found.</p>
      </div>
    );
  }

  const handleDownload = async () => {
    trackDownload(undefined, `${brand} — ${product} Spec Sheet`);
    try {
      const res = await fetch(pdfUrl!);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${brand} — ${product} Spec Sheet.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(pdfUrl!, '_blank');
    }
  };

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
            <Button
              size="sm"
              className="gap-1.5 bg-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/90 text-white shrink-0"
              onClick={handleDownload}
            >
              <FileDown className="w-3.5 h-3.5" />
              Download
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
