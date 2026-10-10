import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackDownload } from "@/lib/trackDownload";
import { getSignedSpecSheetUrl } from "@/utils/signedSpecSheetUrl";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import AuthGateDialog from "@/components/AuthGateDialog";
import SpecSheetWorkspace from "@/components/trade/SpecSheetWorkspace";

const normalizeSheetKey = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

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

  const canonicalUrl = useMemo(() => {
    const base = "https://www.maisonaffluency.com/trade/spec-sheet";
    if (!product) return base;
    const qs = new URLSearchParams();
    const requestedBrand = params.get("brand");
    if (requestedBrand) qs.set("brand", requestedBrand);
    qs.set("product", product);
    return `${base}?${qs.toString()}`;
  }, [product, params]);

  useEffect(() => {
    if (!product || !user) { setLoading(false); return; }

    setLoading(true);
    setPdfUrl(null);
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
        .select("spec_sheet_url, pdf_urls")
        .ilike("product_name", product)
        .limit(1)
        .maybeSingle();

      const tpPdfList = (tp?.pdf_urls as { label?: string; url?: string }[] | null) ?? [];
      const tpMatchedByIndex = Number.isInteger(sheetIndex) && sheetIndex !== null && sheetIndex >= 0
        ? tpPdfList[sheetIndex] ?? null
        : null;
      const tpMatchedByLabel = normalizedRequestedLabel
        ? tpPdfList.find((p) => normalizeSheetKey(p?.label) === normalizedRequestedLabel)
        : null;
      const tpResolvedUrl = tpMatchedByIndex?.url
        || tpMatchedByLabel?.url
        || tpPdfList[0]?.url
        || tp?.spec_sheet_url
        || null;

      if (!cancelled) {
        if (tpResolvedUrl) {
          const signed = await getSignedSpecSheetUrl(tpResolvedUrl);
          setPdfUrl(signed);
        }
        setLoading(false);
      }

    };

    resolve().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [product, user, sheetLabel, sheetIndex]);

  const handleDownload = useCallback(async () => {
    if (!pdfUrl) return;
    trackDownload(undefined, `${brand} — ${product} Spec Sheet`);
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error("Document unavailable");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${brand} — ${product} Spec Sheet.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      throw new Error("Document download unavailable");
    }
  }, [pdfUrl, brand, product]);

  return (
    <>
      <Helmet>
        <title>{pageTitle} | Maison Affluency</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <SpecSheetWorkspace
        brand={brand}
        product={product}
        sheetLabel={sheetLabel}
        sheetIndex={sheetIndex}
        pdfUrl={pdfUrl}
        loading={loading || (!user && authLoading)}
        signedIn={!!user}
        isMobile={isMobile}
        onSignIn={() => setGateOpen(true)}
        onDownload={handleDownload}
      />
      <AuthGateDialog open={gateOpen} onClose={() => setGateOpen(false)} action="view this spec sheet" />
    </>
  );
}
