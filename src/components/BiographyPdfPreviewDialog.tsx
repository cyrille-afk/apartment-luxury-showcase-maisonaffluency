import { useEffect, useState } from "react";
import { Download, X, Loader2 } from "lucide-react";
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
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (!open) setIframeLoaded(false);
  }, [open]);

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
        <div className="relative flex-1 bg-muted/20">
          {(!blobUrl || !iframeLoaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xs">{blobUrl ? "Rendering preview…" : "Generating PDF…"}</p>
            </div>
          )}
          {blobUrl && (
            <iframe
              key={blobUrl}
              src={`${blobUrl}#toolbar=1&navpanes=0&view=FitH`}
              title={`${designerName} biography preview`}
              className="w-full h-full border-0"
              onLoad={() => setIframeLoaded(true)}
            />
          )}
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
