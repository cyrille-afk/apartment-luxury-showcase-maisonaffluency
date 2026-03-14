import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

interface PdfThumbnailProps {
  url: string;
  alt?: string;
  className?: string;
}

/** Simple hash for cache key */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return "pdft_" + Math.abs(hash).toString(36);
}

const PdfThumbnail = ({ url, alt = "PDF cover", className = "" }: PdfThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = hashUrl(url);

    // Try localStorage cache first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setCachedDataUrl(cached);
        setLoaded(true);
        return;
      }
    } catch {
      // localStorage unavailable, continue with render
    }

    const render = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({
          url,
          disableAutoFetch: true,
          disableStream: true,
        }).promise;

        if (cancelled) return;

        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const targetWidth = 400;
        const viewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        if (cancelled) return;

        setLoaded(true);

        // Cache the rendered thumbnail
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          localStorage.setItem(cacheKey, dataUrl);
        } catch {
          // Quota exceeded or canvas tainted, ignore
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    render();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 ${className}`}>
        <FileText className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }

  // Show cached image
  if (cachedDataUrl) {
    return (
      <div className={`relative bg-muted/20 ${className}`}>
        <img
          src={cachedDataUrl}
          alt={alt}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`relative bg-muted/20 ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {/* Skeleton shimmer */}
          <div className="w-3/4 h-3 rounded bg-muted-foreground/10 animate-pulse" />
          <div className="w-1/2 h-3 rounded bg-muted-foreground/10 animate-pulse" />
          <div className="w-2/3 h-3 rounded bg-muted-foreground/10 animate-pulse" />
          <div className="w-5 h-5 mt-2 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-label={alt}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

export default PdfThumbnail;