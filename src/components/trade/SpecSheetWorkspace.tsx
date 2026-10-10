import { memo, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, FileText, Loader2, Lock, Printer, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";

const PdfFrame = memo(function PdfFrame({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    const timer = window.setTimeout(() => setLoaded(true), 2500);
    return () => window.clearTimeout(timer);
  }, [src]);
  return <div className="absolute inset-0 bg-muted">
    {!loaded && <div className="absolute inset-0 flex items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="font-body text-xs">Loading document…</span></div>}
    <iframe src={src} title={title} onLoad={() => setLoaded(true)} className={`h-full w-full border-0 transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`} allow="fullscreen" />
  </div>;
});

interface Props {
  brand: string;
  product: string;
  sheetLabel: string;
  sheetIndex: number | null;
  pdfUrl: string | null;
  loading: boolean;
  signedIn: boolean;
  isMobile: boolean;
  onSignIn: () => void;
  onDownload: () => Promise<void>;
}

export default function SpecSheetWorkspace({ brand, product, sheetLabel, sheetIndex, pdfUrl, loading, signedIn, isMobile, onSignIn, onDownload }: Props) {
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const printFrame = useRef<HTMLIFrameElement | null>(null);
  const printBlob = useRef<string | null>(null);
  useEffect(() => () => {
    printFrame.current?.remove();
    if (printBlob.current) URL.revokeObjectURL(printBlob.current);
  }, []);
  const ready = signedIn && !loading && !!pdfUrl;
  const inlineSupported = isMobile || navigator.pdfViewerEnabled !== false;
  const title = product || "Technical specification";
  const download = async () => {
    setBusy(true); setNotice("");
    try { await onDownload(); } catch { setNotice("The download could not start. Please try again."); }
    finally { setBusy(false); }
  };
  const share = async () => {
    if (!pdfUrl) return;
    const url = new URL(buildSpecSheetUrl(pdfUrl, brand, product, sheetLabel || undefined, sheetIndex ?? undefined));
    url.hostname = "www.maisonaffluency.com"; url.protocol = "https:"; url.port = "";
    const success = await copyTextToClipboard(url.toString());
    setCopied(success);
    setNotice(success ? "Spec sheet link copied. Recipients sign in to view the document." : "The link could not be copied. Please try again.");
  };
  const print = async () => {
    if (!pdfUrl) return;
    setPrinting(true); setNotice("");
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Document unavailable");
      const blob = await response.blob();
      printFrame.current?.remove();
      if (printBlob.current) URL.revokeObjectURL(printBlob.current);
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      printBlob.current = blobUrl;
      const frame = document.createElement("iframe");
      frame.className = "spec-sheet-print-frame";
      frame.title = "Print specification sheet";
      frame.src = blobUrl;
      printFrame.current = frame;
      frame.onload = () => window.setTimeout(() => {
        try {
          if (!frame.contentWindow) throw new Error("Print unavailable");
          frame.contentWindow.focus(); frame.contentWindow.print();
        } catch { setNotice("Use the document viewer’s print control, or download the PDF to print it."); }
        finally { setPrinting(false); }
      }, 500);
      document.body.appendChild(frame);
    } catch {
      setPrinting(false);
      setNotice("Use the document viewer’s print control, or download the PDF to print it.");
    }
  };
  return <div className="spec-sheet-workspace flex min-h-[100dvh] flex-col bg-background text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 md:px-10">
      <Link to="/trade/the-collection" className="flex items-center gap-3" aria-label="Maison Affluency — The Collection">
        <span className="font-display text-2xl text-accent" aria-hidden="true">MA</span>
        <span className="font-display text-[13px] uppercase tracking-[0.18em]">Maison Affluency<span className="mt-1 block font-body text-[9px] text-muted-foreground tracking-[0.16em]">DOCUMENT ATELIER</span></span>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Document actions">
        <Button variant="ghost" size="sm" title="Download Document" disabled={!ready || busy} onClick={download} className="gap-2 text-xs">{busy ? <Loader2 className="animate-spin" /> : <Download />}<span className="hidden sm:inline">Download Document</span></Button>
        <Button variant="ghost" size="sm" title="Print" disabled={!ready || printing} onClick={print} className="gap-2 text-xs">{printing ? <Loader2 className="animate-spin" /> : <Printer />}<span className="hidden sm:inline">Print</span></Button>
        <Button variant="outline" size="sm" title="Share Spec Sheet Link" disabled={!ready} onClick={share} className="gap-2 text-xs">{copied ? <Check /> : <Share2 />}<span className="hidden sm:inline">{copied ? "Link copied" : "Share Spec Sheet Link"}</span></Button>
      </div>
    </header>
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-5 py-6 md:px-12 md:py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0"><p className="mb-2 font-body text-[10px] uppercase tracking-[0.18em] text-accent">{brand} / Technical documentation</p><h1 className="break-words font-display text-2xl md:text-3xl">{title}</h1>{sheetLabel && <p className="mt-2 font-body text-xs text-muted-foreground">{sheetLabel}</p>}</div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground"><Link to="/trade/the-collection"><ArrowLeft /><span className="hidden md:inline">Collection</span></Link></Button>
      </div>
      {notice && <p role="status" className="mb-4 font-body text-xs text-accent">{notice}</p>}
      {ready && inlineSupported ? <div className="spec-sheet-document relative h-[calc(100dvh-18rem)] min-h-[560px] overflow-hidden border border-border"><PdfFrame src={isMobile ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl || "")}` : pdfUrl || ""} title={`${title} — Spec Sheet`} /></div> :
        <div className="flex min-h-[560px] flex-1 items-center justify-center">
          <div className="spec-sheet-document w-full max-w-lg border border-border bg-card px-8 py-14 text-center md:px-12">
            {loading ? <Loader2 className="mx-auto mb-7 h-9 w-9 animate-spin text-accent" /> : signedIn ? <FileText className="mx-auto mb-7 h-10 w-10 text-accent" strokeWidth={1} /> : <Lock className="mx-auto mb-7 h-10 w-10 text-accent" strokeWidth={1} />}
            <h2 className="font-display text-2xl leading-relaxed">{loading ? "Preparing your document" : !signedIn ? "Your document, securely held" : pdfUrl ? "Your technical specification sheet is ready" : "Specification sheet unavailable"}</h2>
            <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">{loading ? "Loading specification sheet…" : !signedIn ? "Sign in to view and download this specification sheet." : pdfUrl ? `${brand} — ${title}` : "No specification sheet was found for this piece."}</p>
            {!loading && (!signedIn ? <Button onClick={onSignIn} className="mt-8 gap-2"><Lock />Sign in to view</Button> : pdfUrl ? <Button onClick={download} disabled={busy} className="mt-8 gap-2"><Download />Download Document</Button> : null)}
          </div>
        </div>}
      {ready && inlineSupported && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 font-body text-[10px] text-muted-foreground"><span>SPECIFICATION SHEET · PDF</span><Button onClick={download} disabled={busy} variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground">Preview not displaying? Download Document</Button></div>}
    </main>
    <footer className="border-t border-border px-5 py-4 text-center font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Maison Affluency · Technical Documents</footer>
  </div>;
}