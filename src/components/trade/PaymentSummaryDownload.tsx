import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPaymentSummaryPdf } from "@/lib/paymentSummaryPdf";
import type { PaymentSummaryInput } from "@/lib/paymentSummary";

export default function PaymentSummaryDownload({ input }: { input: PaymentSummaryInput }) {
  const key = JSON.stringify(input);
  const [prepared, setPrepared] = useState<{ key: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    buildPaymentSummaryPdf(JSON.parse(key) as PaymentSummaryInput).then((blob) => {
      if (!cancelled) setPrepared({ key, blob });
    }).catch(() => { if (!cancelled) setError("Payment summary unavailable. Reload the quote to retry."); });
    return () => { cancelled = true; };
  }, [key]);
  const ready = prepared?.key === key ? prepared.blob : null;
  const download = async () => {
    if (!ready) return;
    const filename = `${input.quoteNumber}-payment-summary.pdf`;
    const file = new File([ready], filename, { type: "application/pdf" });
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Payment summary" }); return; }
      catch (err) { if (err instanceof DOMException && err.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(ready);
    const link = document.createElement("a"); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  return <div>
    <Button variant="outline" size="sm" onClick={download} disabled={!ready} className="gap-2">
      {ready || error ? <Download className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
      Download payment summary
    </Button>
    {error && <p role="alert" className="font-body text-xs text-destructive mt-2">{error}</p>}
  </div>;
}