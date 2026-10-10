import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

GlobalWorkerOptions.workerSrc = pdfWorker;

function DocumentPage({ document, pageNumber }: { document: PDFDocumentProxy; pageNumber: number }) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.round(entry.contentRect.width)); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    (async () => {
      try {
        const page = await document.getPage(pageNumber);
        const element = canvas.current;
        if (cancelled || !element) return;
        const context = element.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width * Math.min(window.devicePixelRatio || 1, 2) });
        element.width = Math.ceil(viewport.width);
        element.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setError(false);
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [document, pageNumber, width]);
  return <div ref={container} className="spec-sheet-document w-full bg-card">
    <canvas ref={canvas} role="img" aria-label={`Document page ${pageNumber}`} className="block h-auto w-full" />
    {error && <p role="alert" className="p-6 text-center text-sm">This page could not be displayed.</p>}
  </div>;
}

export default function InlineSpecSheetDocument({ url, title }: { url: string; title: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    let cancelled = false;
    setDocument(null); setError(false);
    const task = getDocument({ url });
    task.promise.then(pdf => { if (!cancelled) setDocument(pdf); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; void task.destroy(); };
  }, [url]);
  return <section aria-label={`${title} — Spec Sheet`} className="w-full">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-border/20 py-3 text-xs">
      <span className="font-body text-muted-foreground">{document ? `${document.numPages} ${document.numPages === 1 ? "page" : "pages"}` : "PDF"}</span>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" title="Zoom out" aria-label="Zoom out" disabled={zoom <= 75} onClick={() => setZoom(value => value - 25)} className="h-8 w-8"><Minus className="h-4 w-4" /></Button>
        <span className="w-12 text-center tabular-nums">{zoom}%</span>
        <Button size="icon" variant="ghost" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(value => value + 25)} className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom(100)}>Fit width</Button>
      </div>
    </div>
    {!document && !error && <div role="status" className="flex min-h-80 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Rendering document…</span></div>}
    {error && <p role="alert" className="py-16 text-center text-sm">The document preview could not load. Please reload or use Download Document.</p>}
    {document && <div className="w-full overflow-x-auto pb-6">
      <div className="mx-auto flex flex-col gap-6" style={{ width: `${zoom}%` }}>
        {Array.from({ length: document.numPages }, (_, index) => <DocumentPage key={index + 1} document={document} pageNumber={index + 1} />)}
      </div>
    </div>}
  </section>;
}
