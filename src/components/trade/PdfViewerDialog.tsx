import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string;
  /** Builds the PDF; re-run whenever `buildKey` changes while open. */
  build: () => Promise<Blob>; buildKey?: string; fileName: string;
};

export const MIN_ZOOM = 0.5, MAX_ZOOM = 4;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => void };

async function loadPdf(url: string): Promise<PdfDoc> {
  const pdfjs = await import("pdfjs-dist");
  try { pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default; }
  catch { pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`; }
  return (await pdfjs.getDocument({ url }).promise) as unknown as PdfDoc;
}

/** Full multi-page PDF viewer with zoom, page navigation and a download of the exact previewed file. */
export function PdfViewerDialog({ open, onOpenChange, title, description, build, buildKey = "", fileName }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [state, setState] = useState<"idle" | "building" | "error">("idle");
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const zoomRef = useRef(zoom); zoomRef.current = zoom;

  useEffect(() => {
    if (!open) return;
    let off = false; let made: string | null = null; let loaded: PdfDoc | null = null;
    setState("building"); setUrl(null); setDoc(null); setZoom(1); setPage(1);
    build().then(async blob => {
      if (off) return;
      made = URL.createObjectURL(blob);
      loaded = await loadPdf(made);
      if (off) { loaded.destroy(); return; }
      setUrl(made); setDoc(loaded); setState("idle");
    }).catch(() => { if (!off) setState("error"); });
    return () => { off = true; loaded?.destroy(); if (made) URL.revokeObjectURL(made); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, buildKey]);

  // Render every page at the current zoom; "100%" fits the page width to the viewer.
  useEffect(() => {
    if (!doc || !scroller.current) return;
    let off = false;
    const fitWidth = Math.max(320, scroller.current.clientWidth - 32);
    const dpr = window.devicePixelRatio || 1;
    (async () => {
      for (let n = 1; n <= doc.numPages && !off; n++) {
        const p = await doc.getPage(n);
        const base = p.getViewport({ scale: 1 });
        const scale = (fitWidth / base.width) * zoom;
        const vp = p.getViewport({ scale: scale * dpr });
        const c = canvases.current[n - 1]; if (!c || off) continue;
        c.width = vp.width; c.height = vp.height;
        c.style.width = `${vp.width / dpr}px`; c.style.height = `${vp.height / dpr}px`;
        await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      }
    })();
    return () => { off = true; };
  }, [doc, zoom]);

  // Track the page in view while scrolling.
  const onScroll = useCallback(() => {
    const el = scroller.current; if (!el) return;
    const mid = el.scrollTop + el.clientHeight / 3;
    let current = 1;
    canvases.current.forEach((c, i) => { if (c && c.offsetTop <= mid) current = i + 1; });
    setPage(current);
  }, []);

  const goTo = (n: number) => {
    if (!doc) return;
    const target = Math.min(doc.numPages, Math.max(1, n));
    const c = canvases.current[target - 1];
    if (c && scroller.current) scroller.current.scrollTo({ top: c.offsetTop - 16, behavior: "smooth" });
    setPage(target);
  };

  // Ctrl/⌘ + wheel or trackpad pinch zooms the document, not the page.
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setZoom(clampZoom(zoomRef.current * Math.exp(-dy * 0.002)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [doc]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "PageDown" || (e.key === "ArrowRight" && !e.shiftKey)) { e.preventDefault(); goTo(page + 1); }
    else if (e.key === "PageUp" || e.key === "ArrowLeft") { e.preventDefault(); goTo(page - 1); }
    else if (e.key === "+" || e.key === "=") setZoom(z => clampZoom(z + 0.25));
    else if (e.key === "-") setZoom(z => clampZoom(z - 0.25));
  };

  const pages = doc?.numPages ?? 0;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[92vh] max-w-6xl flex-col" onKeyDown={onKey}>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {doc && <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-2" role="toolbar" aria-label="PDF controls">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={page <= 1} onClick={() => goTo(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">Page
            <input aria-label="Page number" type="number" min={1} max={pages} value={page} onChange={e => goTo(Number(e.target.value) || 1)} className="h-7 w-12 rounded border border-input bg-background px-1 text-center text-xs tabular-nums text-foreground" />
            of {pages}</label>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next page" disabled={page >= pages} onClick={() => goTo(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(z => clampZoom(z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(z => clampZoom(z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" aria-label="Fit to width" onClick={() => setZoom(1)}><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
        </div>
      </div>}
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-4">
        {state === "building" && <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing preview…</div>}
        {state === "error" && <p role="alert" className="p-6 text-sm text-destructive">The preview couldn't be prepared. Close and try again.</p>}
        {doc && <div className="flex w-max min-w-full flex-col items-center gap-4">
          {Array.from({ length: pages }, (_, i) => <canvas key={i} ref={el => { canvases.current[i] = el; }} aria-label={`Page ${i + 1}`} className="bg-background shadow-sm" />)}
        </div>}
      </div>
      {url && <div className="flex justify-end"><Button asChild size="sm"><a href={url} download={fileName}><Download className="mr-2 h-4 w-4" />Download this PDF</a></Button></div>}
    </DialogContent>
  </Dialog>;
}
