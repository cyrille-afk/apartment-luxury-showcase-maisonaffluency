import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";

interface PdfViewerProps {
  url: string;
  title?: string;
}

const PdfViewer = ({ url, title = "PDF Document" }: PdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Load PDF
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const doc = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;

        setPdf(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [url]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;

    const page = await pdf.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }, [pdf, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  if (error) {
    return (
      <div className="text-center py-10 text-muted-foreground font-body text-sm">
        Unable to load PDF.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
          Download instead
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="font-body text-xs text-muted-foreground">Loading PDF…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <div className="flex items-center gap-1 bg-muted/30 rounded-full px-2 py-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-body text-xs text-foreground/70 min-w-[60px] text-center">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-muted/30 rounded-full px-2 py-1">
          <button
            onClick={() => setScale((s) => Math.max(0.75, s - 0.25))}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-body text-[10px] text-foreground/50 min-w-[36px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full font-body text-xs hover:opacity-90 transition-opacity"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>

      {/* Canvas */}
      <div className="w-full overflow-x-auto flex justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto shadow-md rounded-sm"
          style={{ maxHeight: "75vh" }}
        />
      </div>
    </div>
  );
};

export default PdfViewer;
