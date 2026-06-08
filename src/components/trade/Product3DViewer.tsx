import { useEffect, useState } from "react";
import { Box } from "lucide-react";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          "ios-src"?: string;
          alt?: string;
          poster?: string;
          ar?: boolean;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string | number;
          "environment-image"?: string;
          exposure?: string | number;
          "tone-mapping"?: string;
          loading?: "auto" | "lazy" | "eager";
          reveal?: "auto" | "manual";
        },
        HTMLElement
      >;
    }
  }
}

const MODEL_VIEWER_SRC =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

let loaderPromise: Promise<void> | null = null;
function ensureModelViewer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${MODEL_VIEWER_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("model-viewer failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.type = "module";
    s.src = MODEL_VIEWER_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("model-viewer failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

interface Props {
  url: string;
  alt: string;
  poster?: string | null;
}

const Product3DViewer: React.FC<Props> = ({ url, alt, poster }) => {
  const [ready, setReady] = useState(() =>
    typeof window !== "undefined" && !!customElements.get("model-viewer"),
  );

  useEffect(() => {
    let mounted = true;
    ensureModelViewer()
      .then(() => mounted && setReady(true))
      .catch(() => mounted && setReady(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="border border-border rounded-md overflow-hidden bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/50">
        <Box size={13} className="text-muted-foreground" />
        <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Interactive 3D Model
        </span>
      </div>
      <div className="relative w-full aspect-square">
        {ready ? (
          <model-viewer
            src={url}
            alt={alt}
            poster={poster || undefined}
            camera-controls
            auto-rotate
            ar
            shadow-intensity="1"
            exposure="1"
            tone-mapping="neutral"
            loading="lazy"
            reveal="auto"
            style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <span className="font-body text-[11px] uppercase tracking-[0.12em]">Loading 3D…</span>
          </div>
        )}
      </div>
      <p className="px-3 py-2 font-body text-[10px] text-muted-foreground border-t border-border">
        Drag to rotate · scroll to zoom · tap the cube to view in your room (AR)
      </p>
    </div>
  );
};

export default Product3DViewer;
