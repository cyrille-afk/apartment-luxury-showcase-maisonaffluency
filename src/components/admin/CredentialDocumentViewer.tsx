import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { Loader2, Minus, Plus, RotateCw, Maximize2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type Props = {
  url: string;
  fileName?: string | null;
  className?: string;
};

const isImage = (name: string) => /\.(png|jpe?g|webp|gif|avif|heic)(\?|$)/i.test(name);

function Toolbar({
  onRotate,
  onExpand,
  url,
}: {
  onRotate: () => void;
  onExpand?: () => void;
  url: string;
}) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => zoomOut(0.4)} aria-label="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => zoomIn(0.4)} aria-label="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 font-body text-[10px] uppercase tracking-[0.18em]"
        onClick={() => resetTransform()}
      >
        Fit
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onRotate} aria-label="Rotate">
        <RotateCw className="h-3.5 w-3.5" />
      </Button>
      {onExpand && (
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onExpand} aria-label="Full screen">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        Open <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

/** Renders every page of a PDF to canvases (no iframe — works on iOS Safari). */
function PdfPages({ url, onError }: { url: string; onError: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        try {
          const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
          pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }
        const pdf = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        const targetWidth = Math.min(1400, Math.max(700, containerRef.current.clientWidth * 2));
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: targetWidth / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.style.marginBottom = "8px";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled || !containerRef.current) return;
          containerRef.current.appendChild(canvas);
        }
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          onError();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <>
      {loading && (
        <p className="font-body text-xs text-muted-foreground inline-flex items-center gap-2 p-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering document…
        </p>
      )}
      <div ref={containerRef} className="w-full" />
    </>
  );
}

function Surface({
  url,
  fileName,
  rotation,
  setRotation,
  onExpand,
  heightClass,
}: {
  url: string;
  fileName: string;
  rotation: number;
  setRotation: (r: number) => void;
  onExpand?: () => void;
  heightClass: string;
}) {
  const [pdfFailed, setPdfFailed] = useState(false);
  const image = isImage(fileName);

  return (
    <TransformWrapper
      minScale={0.5}
      maxScale={8}
      doubleClick={{ mode: "toggle", step: 1.2 }}
      wheel={{ step: 0.15 }}
      pinch={{ step: 5 }}
      limitToBounds={false}
      centerOnInit
    >
      <div className="border border-border/60 bg-muted/20">
        <div className="border-b border-border/60 px-2 py-1.5">
          <Toolbar url={url} onExpand={onExpand} onRotate={() => setRotation((rotation + 90) % 360)} />
        </div>
        <TransformComponent
          wrapperClass={`!w-full ${heightClass} touch-none bg-background`}
          contentClass="!w-full"
        >
          <div
            className="w-full origin-center transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {image ? (
              <img src={url} alt="Uploaded business credential" className="w-full select-none" draggable={false} />
            ) : pdfFailed ? (
              <div className="p-6">
                <p className="font-body text-xs text-muted-foreground">
                  Preview unavailable for this file type. Use “Open” above to view it in a new tab.
                </p>
              </div>
            ) : (
              <PdfPages url={url} onError={() => setPdfFailed(true)} />
            )}
          </div>
        </TransformComponent>
      </div>
      <p className="font-body text-[10px] text-muted-foreground mt-2">
        Pinch or scroll to zoom · drag to pan · double-tap to toggle zoom
      </p>
    </TransformWrapper>
  );
}

export default function CredentialDocumentViewer({ url, fileName, className }: Props) {
  const [rotation, setRotation] = useState(0);
  const [full, setFull] = useState(false);
  const name = fileName || url;

  return (
    <div className={className}>
      <Surface
        url={url}
        fileName={name}
        rotation={rotation}
        setRotation={setRotation}
        onExpand={() => setFull(true)}
        heightClass="h-[46vh] sm:h-[420px]"
      />
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-[100vw] w-screen h-[100dvh] sm:max-w-[95vw] sm:w-[95vw] sm:h-[92vh] p-3 pt-12 sm:p-5 sm:pt-12 overflow-hidden">
          <VisuallyHidden><DialogTitle>Business credential document</DialogTitle></VisuallyHidden>
          <Surface
            url={url}
            fileName={name}
            rotation={rotation}
            setRotation={setRotation}
            heightClass="h-[calc(100dvh-9rem)] sm:h-[calc(92vh-9rem)]"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
