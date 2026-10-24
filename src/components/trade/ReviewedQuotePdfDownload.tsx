import { useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuotePdfArgs } from "@/lib/quotePdf";

export default function ReviewedQuotePdfDownload({ args, validate }: {
  args: QuotePdfArgs;
  validate: (args: QuotePdfArgs) => Promise<boolean>;
}) {
  const validator = useRef(validate);
  const [retry, setRetry] = useState(0);
  const [prepared, setPrepared] = useState<{ args: QuotePdfArgs; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { validator.current = validate; }, [validate]);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPrepared(null);
    (async () => {
      if (!(await validator.current(args))) throw new Error("Resolve the quote checks in the editor, then review again.");
      const { buildQuotePdf } = await import("@/lib/quotePdf");
      const doc = await buildQuotePdf(args);
      if (!cancelled) setPrepared({ args, blob: doc.output("blob") });
    })().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not prepare the quote PDF.");
    });
    return () => { cancelled = true; };
  }, [args, retry]);
  const ready = prepared?.args === args ? prepared.blob : null;
  const download = async () => {
    if (!ready) return;
    const filename = `${args.quoteNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}-client-quote.pdf`;
    const file = new File([ready], filename, { type: "application/pdf" });
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: args.quoteNumber }); return; }
      catch (err) { if (err instanceof DOMException && err.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(ready);
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  return <div className="space-y-2">
    <Button variant="outline" size="sm" disabled={!ready && !error} onClick={error ? () => setRetry((value) => value + 1) : download}>
      {error ? <RefreshCw className="h-3.5 w-3.5" /> : ready ? <Download className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {error ? "Retry client PDF" : ready ? "Download client PDF" : "Preparing client PDF…"}
    </Button>
    {error && <p role="alert" className="font-body text-xs text-destructive">{error}</p>}
  </div>;
}