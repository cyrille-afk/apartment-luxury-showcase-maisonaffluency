import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Maximize2, Minimize2, PanelLeft, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findPdfMatches, type PdfTextItem } from "@/lib/pdfTextSearch";
import { pageSections, type PdfSection, type PageImage } from "@/lib/pdfPageSections";
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
  const [full, setFull] = useState(false);
  const [thumbsOpen, setThumbsOpen] = useState(true);
  const [labels, setLabels] = useState<string[]>([]);
  const [sections, setSections] = useState<PdfSection[][]>([]);
  const thumbs = useRef<(HTMLCanvasElement | null)[]>([]);
  const thumbList = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const [texts, setTexts] = useState<{ items: PdfTextItem[]; height: number }[]>([]);
  const [scales, setScales] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState(0);
  const matches = useMemo(() => findPdfMatches(texts, query), [texts, query]);
  const zoomRef = useRef(zoom); zoomRef.current = zoom;

  useEffect(() => {
    if (!open) return;
    let off = false; let made: string | null = null; let loaded: PdfDoc | null = null;
    setState("building"); setUrl(null); setDoc(null); setZoom(1); setPage(1); setFull(false); setTexts([]); setQuery("");
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
      const used: number[] = [];
      for (let n = 1; n <= doc.numPages && !off; n++) {
        const p = await doc.getPage(n);
        const base = p.getViewport({ scale: 1 });
        const scale = (fitWidth / base.width) * zoom;
        used[n - 1] = scale; if (!off) setScales([...used]);
        const vp = p.getViewport({ scale: scale * dpr });
        const c = canvases.current[n - 1]; if (!c || off) continue;
        c.width = vp.width; c.height = vp.height;
        c.style.width = `${vp.width / dpr}px`; c.style.height = `${vp.height / dpr}px`;
        await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      }
    })();
    return () => { off = true; };
  }, [doc, zoom, full]);

  // Small page thumbnails (rendered once per document) with a short label from each page's first line of text.
  useEffect(() => {
    if (!doc) return;
    let off = false; setLabels([]); setSections([]);
    (async () => {
      const found: string[] = []; const tags: PdfSection[][] = []; const runs: { items: PdfTextItem[]; height: number }[] = [];
      const pdfjs = await import("pdfjs-dist");
      for (let n = 1; n <= doc.numPages && !off; n++) {
        const p = await doc.getPage(n);
        const base = p.getViewport({ scale: 1 });
        const vp = p.getViewport({ scale: (112 / base.width) * (window.devicePixelRatio || 1) });
        const c = thumbs.current[n - 1];
        if (c && !off) { c.width = vp.width; c.height = vp.height; c.style.width = "112px"; c.style.height = `${(vp.height / vp.width) * 112}px`; await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise; }
        try {
          const text = await p.getTextContent();
          runs[n - 1] = { height: base.height, items: text.items.map((t: any) => ({ str: t.str ?? "", x: t.transform[4], y: t.transform[5], w: t.width, h: t.height || Math.abs(t.transform[3]) })) };
          const all = text.items.map((t: { str?: string }) => t.str ?? "").join(" ").replace(/\s+/g, " ").trim();
          found[n - 1] = all.slice(0, 48);
          const ops = await p.getOperatorList();
          const images: PageImage[] = []; let m = [1, 0, 0, 1];
          ops.fnArray.forEach((fn: number, i: number) => {
            if (fn === pdfjs.OPS.transform) m = ops.argsArray[i];
            else if (fn === pdfjs.OPS.paintImageXObject) images.push({ width: Math.hypot(m[0], m[1]), height: Math.hypot(m[2], m[3]) });
          });
          tags[n - 1] = pageSections(all, images);
        } catch { found[n - 1] = ""; tags[n - 1] = []; }
        if (!off) { setLabels([...found]); setSections([...tags]); setTexts([...runs]); }
      }
    })();
    return () => { off = true; };
  }, [doc, thumbsOpen]);

  // Keep the active thumbnail in view.
  useEffect(() => {
    thumbList.current?.querySelector<HTMLElement>(`[data-thumb="${page}"]`)?.scrollIntoView({ block: "nearest" });
  }, [page]);

  // Track the page in view while scrolling.
  const onScroll = useCallback(() => {
    const el = scroller.current; if (!el) return;
    const mid = el.scrollTop + el.clientHeight / 3;
    let current = 1;
    pageEls.current.forEach((c, i) => { if (c && c.offsetTop <= mid) current = i + 1; });
    setPage(current);
  }, []);

  const goTo = (n: number) => {
    if (!doc) return;
    const target = Math.min(doc.numPages, Math.max(1, n));
    const c = pageEls.current[target - 1];
    if (c && scroller.current) scroller.current.scrollTo({ top: c.offsetTop - 16, behavior: "smooth" });
    setPage(target);
  };

  // Scroll the active search result into view.
  const showHit = (i: number) => {
    if (!matches.length) return;
    const k = (i + matches.length) % matches.length; setHit(k);
    const m = matches[k], el = pageEls.current[m.page - 1], sc = scales[m.page - 1] ?? 1;
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop + m.top * sc - scroller.current.clientHeight / 3, behavior: "smooth" });
    setPage(m.page);
  };
  useEffect(() => { setHit(0); if (matches.length) showHit(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [matches]);

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
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "PageDown" || (e.key === "ArrowRight" && !e.shiftKey)) { e.preventDefault(); goTo(page + 1); }
    else if (e.key === "PageUp" || e.key === "ArrowLeft") { e.preventDefault(); goTo(page - 1); }
    else if (e.key === "+" || e.key === "=") setZoom(z => clampZoom(z + 0.25));
    else if (e.key === "-") setZoom(z => clampZoom(z - 0.25));
    else if (e.key === "f" || e.key === "F") setFull(f => !f);
  };

  const pages = doc?.numPages ?? 0;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`flex flex-col ${full ? "h-screen w-screen max-w-none rounded-none border-none" : "h-[92vh] max-w-6xl"}`} onKeyDown={onKey}>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {doc && <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-2" role="toolbar" aria-label="PDF controls">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={thumbsOpen ? "Hide page thumbnails" : "Show page thumbnails"} aria-pressed={thumbsOpen} onClick={() => setThumbsOpen(o => !o)}><PanelLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={page <= 1} onClick={() => goTo(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">Page
            <input aria-label="Page number" type="number" min={1} max={pages} value={page} onChange={e => goTo(Number(e.target.value) || 1)} className="h-7 w-12 rounded border border-input bg-background px-1 text-center text-xs tabular-nums text-foreground" />
            of {pages}</label>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next page" disabled={page >= pages} onClick={() => goTo(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-1" role="search">
          <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input aria-label="Search in PDF" placeholder="Search notes, finishes…" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); showHit(hit + (e.shiftKey ? -1 : 1)); } else if (e.key === "Escape" && query) { e.stopPropagation(); setQuery(""); } }}
            className="h-7 w-44 rounded border border-input bg-background px-2 text-xs text-foreground" />
          <span className="min-w-14 text-xs tabular-nums text-muted-foreground" aria-live="polite">{query.trim().length >= 2 ? (matches.length ? `${hit + 1} of ${matches.length}` : "No results") : ""}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous result" disabled={!matches.length} onClick={() => showHit(hit - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next result" disabled={!matches.length} onClick={() => showHit(hit + 1)}><ChevronRight className="h-4 w-4" /></Button>
          {query && <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Clear search" onClick={() => setQuery("")}><X className="h-4 w-4" /></Button>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(z => clampZoom(z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(z => clampZoom(z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" aria-label="Fit to width" onClick={() => setZoom(1)}><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={full ? "Exit fullscreen" : "Fullscreen"} aria-pressed={full} title={full ? "Exit fullscreen (F)" : "Fullscreen (F)"} onClick={() => setFull(f => !f)}>{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        </div>
      </div>}
      <div className="flex min-h-0 flex-1 gap-3">
      {doc && thumbsOpen && <nav ref={thumbList} aria-label="Page thumbnails" className="hidden w-40 shrink-0 overflow-y-auto border-r border-border pr-2 sm:block">
        {Array.from({ length: pages }, (_, i) => <button key={i} type="button" data-thumb={i + 1} aria-label={`Go to page ${i + 1}`} aria-current={page === i + 1 ? "page" : undefined} onClick={() => goTo(i + 1)}
          className={`mb-3 flex w-full flex-col items-center gap-1 rounded p-1.5 text-left transition-colors hover:bg-muted ${page === i + 1 ? "bg-muted ring-1 ring-primary" : ""}`}>
          <canvas ref={el => { thumbs.current[i] = el; }} className="bg-background shadow-sm" />
          <span className="w-full text-[10px] font-medium tabular-nums">{i + 1}</span>
          {!!sections[i]?.length && <span className="flex w-full flex-wrap gap-1">{sections[i].map(tag => <span key={tag} className="rounded-sm bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">{tag}</span>)}</span>}
          {labels[i] && <span className="line-clamp-2 w-full text-[10px] leading-tight text-muted-foreground">{labels[i]}</span>}
        </button>)}
      </nav>}
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-4">
        {state === "building" && <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing preview…</div>}
        {state === "error" && <p role="alert" className="p-6 text-sm text-destructive">The preview couldn't be prepared. Close and try again.</p>}
        {doc && <div className="flex w-max min-w-full flex-col items-center gap-4">
          {Array.from({ length: pages }, (_, i) => <div key={i} ref={el => { pageEls.current[i] = el; }} className="relative">
            <canvas ref={el => { canvases.current[i] = el; }} aria-label={`Page ${i + 1}`} className="block bg-background shadow-sm" />
            {matches.map((m, k) => m.page === i + 1 && <span key={k} data-search-hit={k === hit ? "active" : "match"} aria-hidden className={`pointer-events-none absolute rounded-sm ${k === hit ? "bg-primary/45 ring-2 ring-primary" : "bg-accent/50"}`}
              style={{ left: m.left * (scales[i] ?? 1) - 1, top: m.top * (scales[i] ?? 1) - 1, width: m.width * (scales[i] ?? 1) + 2, height: m.height * (scales[i] ?? 1) + 2 }} />)}
          </div>)}
        </div>}
      </div>
      </div>
      {url && <div className="flex justify-end"><Button asChild size="sm"><a href={url} download={fileName}><Download className="mr-2 h-4 w-4" />Download this PDF</a></Button></div>}
    </DialogContent>
  </Dialog>;
}
