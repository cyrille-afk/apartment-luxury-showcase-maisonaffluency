import { useSearchParams } from "react-router-dom";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Helmet } from "react-helmet-async";
import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackDownload } from "@/lib/trackDownload";
import { getSignedSpecSheetUrl } from "@/utils/signedSpecSheetUrl";
import { useIsMobile } from "@/hooks/use-mobile";
import { FileDown, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import AuthGateDialog from "@/components/AuthGateDialog";

const normalizeSheetKey = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

/**
 * PdfFrame — isolated, memoized iframe wrapper.
 * Tracks its own load state so parent rerenders (e.g. resize, auth refresh)
 * don't force the iframe to reflow or re-fetch the PDF.
 */
const PdfFrame = memo(function PdfFrame({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative w-full h-full bg-muted/20 ${className || ""}`}>
      {!loaded && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20"
          aria-hidden="true"
        >
          <DotCircleLoader size="sm" className="text-muted-foreground" />
          <p className="font-body text-xs text-muted-foreground tracking-wide">
            Loading spec sheet…
          </p>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        className="w-full h-full border-0"
        allow="fullscreen"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 200ms ease-out" }}
      />
    </div>
  );
});

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
  const sheetIndexParam = params.get("sheetIndex");
  const sheetIndex = sheetIndexParam !== null ? Number(sheetIndexParam) : null;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  const pageTitle = useMemo(
    () => (product ? `${brand} — ${product} Spec Sheet` : "Trade Product Spec Sheet Viewer"),
    [brand, product]
  );
  const pageDescription = product
    ? `View the ${product} spec sheet from ${brand}: dimensions, finishes, materials and downloadable product documentation.`
    : "View Maison Affluency trade product spec sheets, including dimensions, materials, finishes and downloadable documentation for registered users.";

  useEffect(() => {
    if (!product || !user) { setLoading(false); return; }

    let cancelled = false;
    const resolve = async () => {
      const { data: pick } = await supabase
        .from("designer_curator_picks")
        .select("pdf_url, pdf_urls")
        .ilike("title", product)
        .limit(1)
        .maybeSingle();

      const pdfList = (pick?.pdf_urls as { label?: string; url?: string }[] | null) ?? [];
      const matchedByIndex = Number.isInteger(sheetIndex) && sheetIndex !== null && sheetIndex >= 0
        ? pdfList[sheetIndex] ?? null
        : null;
      const normalizedRequestedLabel = normalizeSheetKey(sheetLabel);
      const matchedByLabel = normalizedRequestedLabel
        ? pdfList.find((p) => normalizeSheetKey(p?.label) === normalizedRequestedLabel)
        : null;
      const resolvedUrl = matchedByIndex?.url
        || matchedByLabel?.url
        || pdfList[0]?.url
        || pick?.pdf_url
        || null;

      if (resolvedUrl) {
        const signed = await getSignedSpecSheetUrl(resolvedUrl);
        if (!cancelled) {
          setPdfUrl(signed);
          setLoading(false);
        }
        return;
      }

      const { data: tp } = await supabase
        .from("trade_products")
        .select("spec_sheet_url")
        .ilike("product_name", product)
        .not("spec_sheet_url", "is", null)
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        if (tp?.spec_sheet_url) {
          const signed = await getSignedSpecSheetUrl(tp.spec_sheet_url);
          setPdfUrl(signed);
        }
        setLoading(false);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [product, user, sheetLabel, sheetIndex]);

  const handleDownload = useCallback(async () => {
    if (!pdfUrl) return;
    trackDownload(undefined, `${brand} — ${product} Spec Sheet`);
    try {
      const res = await fetch(pdfUrl);
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
      window.open(pdfUrl, '_blank');
    }
  }, [pdfUrl, brand, product]);

  const googleViewerUrl = useMemo(
    () => (pdfUrl ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl)}` : ""),
    [pdfUrl]
  );

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
          <title>{pageTitle} | Maison Affluency</title>
          <meta name="description" content={pageDescription} />
          <link rel="canonical" href="https://maisonaffluency.com/trade/spec-sheet" />
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

  /* Mobile: Google Docs viewer iframe + prominent download button */
  if (isMobile) {
    return (
      <>
        <Helmet>
          <title>{pageTitle} | Maison Affluency</title>
          <meta name="description" content={pageDescription} />
          <link rel="canonical" href="https://maisonaffluency.com/trade/spec-sheet" />
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
          <div className="flex-1">
            <PdfFrame src={googleViewerUrl} title={pageTitle} />
          </div>
        </div>
      </>
    );
  }

  /* Desktop: native PDF iframe */
  return (
    <>
      <Helmet>
        <title>{pageTitle} | Maison Affluency</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href="https://maisonaffluency.com/trade/spec-sheet" />
      </Helmet>
      <div className="w-full h-[calc(100vh-4rem)]">
        <h1 className="sr-only">{pageTitle}</h1>
        <PdfFrame src={pdfUrl} title={pageTitle} />
      </div>
    </>
  );
}
