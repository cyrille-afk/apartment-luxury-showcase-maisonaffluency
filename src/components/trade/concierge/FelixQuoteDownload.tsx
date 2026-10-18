import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClientSafeMode } from "@/lib/clientSafeMode";
import type { ProactiveTearsheetData } from "./ProactiveTearsheetCard";

export function FelixQuoteDownload({ cards, studioName, locale }: { cards: ProactiveTearsheetData[]; studioName?: string | null; locale?: string | null }) {
  const key = JSON.stringify({ cards, studioName, locale });
  const [ready, setReady] = useState<{ key: string; blob: Blob } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    const input = JSON.parse(key);
    import("@/lib/felixQuotePdf").then(({ buildFelixQuotePdf }) => buildFelixQuotePdf(input.cards, input.studioName, input.locale)).then((blob) => {
      if (!cancelled) setReady({ key, blob });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [key, retry]);
  const prepared = ready?.key === key ? ready.blob : null;
  return <div data-trade-sensitive className="px-3 pb-2">
    <Button variant="outline" size="sm" className="w-full text-[10px]" disabled={!prepared && !error} onClick={() => {
      if (getClientSafeMode()) return;
      if (error) { setRetry((value) => value + 1); return; }
      if (!prepared) return;
      const url = URL.createObjectURL(prepared);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "maison-affluency-felix-quote.pdf";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    }}>{prepared ? <Download /> : error ? <Download /> : <Loader2 className="animate-spin" />}{error ? "Retry quote PDF" : prepared ? "Download current quote PDF" : "Preparing quote PDF"}</Button>
  </div>;
}