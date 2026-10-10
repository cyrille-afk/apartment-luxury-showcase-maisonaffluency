import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Loader2, Lock, Printer, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";

import InlineSpecSheetDocument from "./InlineSpecSheetDocument";

interface Props {
  brand: string;
  product: string;
  sheetLabel: string;
  sheetIndex: number | null;
  pdfUrl: string | null;
  /** Remote (non-blob) URL for viewers that can't read blob: URLs (mobile gview). */
  remoteUrl?: string | null;
  /** True when the confidential trade cover sheet is page 1 of this document. */
  coverIncluded?: boolean;
  clientView?: boolean;
  loading: boolean;
  signedIn: boolean;
  isMobile: boolean;
  onSignIn: () => void;
  onDownload: () => Promise<void>;
}

export default function SpecSheetWorkspace({ brand, product, sheetLabel, sheetIndex, pdfUrl, remoteUrl, coverIncluded, clientView, loading, signedIn, isMobile, onSignIn, onDownload }: Props) {
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
    // Client links request the clean retail sheet; the server never adds the trade cover in client mode.
    url.searchParams.set("view", "client");
    const success = await copyTextToClipboard(url.toString());
    setCopied(success);
    setNotice(success ? "Client link copied — it opens the clean spec sheet without your trade cover page. Recipients sign in to view." : "The link could not be copied. Please try again.");
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
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 bg-background px-5 py-4 md:px-10">
      <Link to="/trade/the-collection" className="flex items-center gap-3" aria-label="Maison Affluency — The Collection">
        <span className="font-display text-2xl text-foreground" aria-hidden="true">MA</span>
        <span className="font-display text-[13px] uppercase tracking-[0.18em]">Maison Affluency<span className="mt-1 block font-body text-[9px] text-muted-foreground tracking-[0.16em]">DOCUMENT ATELIER</span></span>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Document actions">
        <Button variant="outline" size="sm" title="Download Document" disabled={!ready || busy} onClick={download} className="gap-2 text-xs">{busy ? <Loader2 className="animate-spin" /> : <Download />}<span className="hidden sm:inline">Download Document</span></Button>
        <Button variant="outline" size="sm" title="Print" disabled={!ready || printing} onClick={print} className="gap-2 text-xs">{printing ? <Loader2 className="animate-spin" /> : <Printer />}<span className="hidden sm:inline">Print</span></Button>
        <Button variant="outline" size="sm" title="Share Spec Sheet Link" disabled={!ready} onClick={share} className="gap-2 text-xs">{copied ? <Check /> : <Share2 />}<span className="hidden sm:inline">{copied ? "Link copied" : "Share Spec Sheet Link"}</span></Button>
      </div>
    </header>
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-5 py-6 md:px-12 md:py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0"><p className="mb-2 font-body text-[10px] uppercase tracking-[0.18em] text-foreground">{brand} / Technical documentation</p><h1 className="break-words font-display text-2xl md:text-3xl">{title}</h1>{sheetLabel && <p className="mt-2 font-body text-xs text-muted-foreground">{sheetLabel}</p>}</div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground"><Link to="/trade/the-collection"><ArrowLeft /><span className="hidden md:inline">Collection</span></Link></Button>
      </div>
      {notice && <p role="status" className="mb-4 font-body text-xs text-foreground">{notice}</p>}
      {ready && pdfUrl ? <InlineSpecSheetDocument url={pdfUrl} title={title} /> :
        <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center gap-5 text-center">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : !signedIn ? <Lock className="h-6 w-6" strokeWidth={1} /> : null}
          <p className="font-body text-sm text-muted-foreground">{loading ? "Preparing your document…" : !signedIn ? "Sign in to view and download this specification sheet." : "No specification sheet was found for this piece."}</p>
          {!loading && !signedIn && <Button onClick={onSignIn} className="gap-2"><Lock />Sign in to view</Button>}
        </div>}
      {ready && <div className="mt-4 font-body text-[10px] text-muted-foreground">{coverIncluded ? "PAGE 1 · CONFIDENTIAL TRADE COVER SHEET — NOT INCLUDED IN CLIENT LINKS" : clientView ? "CLIENT SPECIFICATION SHEET · PDF" : "SPECIFICATION SHEET · PDF"}</div>}
    </main>
    <footer className="border-t border-border/20 px-5 py-4 text-center font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Maison Affluency · Technical Documents</footer>
  </div>;
}