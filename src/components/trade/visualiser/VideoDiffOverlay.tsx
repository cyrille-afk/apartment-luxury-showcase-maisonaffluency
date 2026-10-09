import { useEffect, useRef, useState } from "react";

/**
 * Frame-difference overlay for two synchronized walkthrough videos.
 * Draws video A dimmed, with pixels that differ from video B highlighted.
 * Both videos must be CORS-enabled (crossOrigin="anonymous") or the canvas taints.
 */
export default function VideoDiffOverlay({
  getVideos,
  threshold,
}: {
  getVideos: () => (HTMLVideoElement | null)[];
  threshold: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(0);

  useEffect(() => {
    const W = 480;
    const a = document.createElement("canvas");
    const b = document.createElement("canvas");
    const ca = a.getContext("2d", { willReadFrequently: true });
    const cb = b.getContext("2d", { willReadFrequently: true });
    let raf = 0;
    let frame = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const [va, vb] = getVideos();
      const out = canvasRef.current;
      if (!va || !vb || !out || !ca || !cb || va.readyState < 2 || vb.readyState < 2) return;
      const H = Math.round((W * (va.videoHeight || 9)) / (va.videoWidth || 16));
      if (a.width !== W || a.height !== H) { a.width = b.width = out.width = W; a.height = b.height = out.height = H; }
      try {
        ca.drawImage(va, 0, 0, W, H);
        cb.drawImage(vb, 0, 0, W, H);
        const da = ca.getImageData(0, 0, W, H);
        const db = cb.getImageData(0, 0, W, H).data;
        const px = da.data;
        let n = 0;
        for (let i = 0; i < px.length; i += 4) {
          const d = (Math.abs(px[i] - db[i]) + Math.abs(px[i + 1] - db[i + 1]) + Math.abs(px[i + 2] - db[i + 2])) / 3;
          if (d > threshold) { px[i] = 255; px[i + 1] = 40; px[i + 2] = 120; n++; }
          else { px[i] *= 0.35; px[i + 1] *= 0.35; px[i + 2] *= 0.35; }
        }
        out.getContext("2d")?.putImageData(da, 0, 0);
        if (++frame % 10 === 0) setChanged(Math.round((n / (W * H)) * 1000) / 10);
        setError(null);
      } catch {
        setError("The video host blocked pixel access, so differences can't be calculated for these renders.");
        cancelAnimationFrame(raf);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getVideos, threshold]);

  return (
    <figure className="space-y-1" aria-label="Difference overlay">
      {error ? (
        <p className="text-muted-foreground">{error}</p>
      ) : (
        <canvas ref={canvasRef} className="h-auto w-full bg-background" />
      )}
      <figcaption className="text-muted-foreground">
        Highlighted pixels differ between the two renders at the current moment · {changed}% of frame changed
      </figcaption>
    </figure>
  );
}
