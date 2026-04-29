import { useEffect, useRef, useState } from "react";
import { Download, X, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  blobUrl: string | null;
  fileName: string;
  designerName: string;
  onClose: () => void;
  onDownload: () => void;
}

/**
 * Inline preview modal for the generated biography PDF. Renders the blob in
 * an <iframe> so the user can scrub through every page (verifying video
 * posters, spacing, page breaks) before committing to a download.
 *
 * The blob URL is created by the caller and revoked when the dialog closes.
 */
export default function BiographyPdfPreviewDialog({
  open,
  blobUrl,
  fileName,
  designerName,
  onClose,
  onDownload,
}: Props) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const renderTokenRef = useRef(0);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!open || !blobUrl) {
      if (canvasHostRef.current) canvasHostRef.current.innerHTML = "";
      setRendering(false);
      setRenderError(false);
      return;
    }

    let cancelled = false;
    const token = renderTokenRef.current + 1;
    renderTokenRef.current = token;

    const renderPdfPages = async () => {
      const host = canvasHostRef.current;
      if (!host) return;
      host.innerHTML = "";
      setRendering(true);
      setRenderError(false);

      try {
        const pdfjsLib = await import("pdfjs-dist");
        try {
          const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
          pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        const pdf = await pdfjsLib.getDocument({ url: blobUrl }).promise;
        if (cancelled || renderTokenRef.current !== token) return;

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page = await pdf.getPage(pageNo);
          if (cancelled || renderTokenRef.current !== token) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.min(980, Math.max(320, host.clientWidth - 48));
          const scale = Math.max(1, Math.min(2.1, availableWidth / baseViewport.width));
          const viewport = page.getViewport({ scale });

          const wrapper = document.createElement("section");
          wrapper.className = "pdf-preview-page flex flex-col items-center gap-2";

          const label = document.createElement("div");
          label.className = "text-[10px] uppercase tracking-[0.16em] text-muted-foreground";
          label.textContent = `Page ${pageNo} / ${pdf.numPages}`;

          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "block max-w-full h-auto bg-background shadow-[0_14px_42px_rgba(0,0,0,0.18)]";

          wrapper.appendChild(label);
          wrapper.appendChild(canvas);
          host.appendChild(wrapper);

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable");
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (error) {
        console.error("[BiographyPdfPreviewDialog] render failed", error);
        if (!cancelled) setRenderError(true);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void renderPdfPages();
    return () => {
      cancelled = true;
    };
  }, [open, blobUrl]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background/95">
          <div className="min-w-0">
            <p className="font-display text-sm tracking-wide truncate">
              Biography preview — {designerName}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Scroll through every page to verify video posters and spacing, then download.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDownload}
              disabled={!blobUrl}
              className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-3 py-1.5 text-xs uppercase tracking-[0.12em] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto bg-muted/20">
          {(!blobUrl || rendering) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xs">{blobUrl ? "Rendering pages…" : "Generating PDF…"}</p>
            </div>
          )}
          {renderError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 text-center">
              <AlertCircle className="h-5 w-5" />
              <p className="text-xs">Preview could not render here. Download the PDF to inspect it.</p>
            </div>
          )}
          <div ref={canvasHostRef} className="flex flex-col items-center gap-8 px-4 py-8" />
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-background/95 text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="truncate">File: {fileName}</span>
          <span className="hidden sm:inline">Tip: zoom in to inspect video poster crops and figure spacing.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
