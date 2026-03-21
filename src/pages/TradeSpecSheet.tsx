import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/**
 * In-app spec sheet viewer.
 * URL pattern: /trade/spec-sheet?brand=Ecart&product=Round+Table&url=…
 * This keeps the browser address bar showing our domain instead of a storage URL.
 */
export default function TradeSpecSheet() {
  const [params] = useSearchParams();
  const pdfUrl = params.get("url") || "";
  const brand = params.get("brand") || "Spec Sheet";
  const product = params.get("product") || "";

  const pageTitle = product
    ? `${brand} — ${product} Spec Sheet`
    : `${brand} Spec Sheet`;

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-body text-sm text-muted-foreground">No spec sheet URL provided.</p>
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
