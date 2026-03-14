import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

interface PdfThumbnailProps {
  url: string;
  alt?: string;
  className?: string;
}

const PdfThumbnail = ({ url, alt = "PDF cover", className = "" }: PdfThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Use the bundled worker
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

        // Render at a reasonable thumbnail size
        const targetWidth = 400;
        const viewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        if (!cancelled) setLoaded(true);
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

  return (
    <div className={`relative bg-muted/20 ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
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
