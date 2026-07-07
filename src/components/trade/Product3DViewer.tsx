import { useEffect, useRef, useState } from "react";
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
  /**
   * Optional fabric/finish texture URL. When set, its image is applied as the
   * baseColorTexture of every PBR material in the loaded GLB. Passing null or
   * undefined restores the model's original materials (by re-issuing `src`).
   */
  fabricTextureUrl?: string | null;
  /**
   * Optional filter: only swap materials whose name matches. Defaults to
   * applying to all materials, which is the pragmatic behaviour when the GLB
   * doesn't tag a specific fabric slot.
   */
  fabricMaterialNameIncludes?: string;
}

const Product3DViewer: React.FC<Props> = ({
  url,
  alt,
  poster,
  fabricTextureUrl,
  fabricMaterialNameIncludes,
}) => {
  const [ready, setReady] = useState(() =>
    typeof window !== "undefined" && !!customElements.get("model-viewer"),
  );
  const mvRef = useRef<HTMLElement & {
    model?: any;
    createTexture?: (url: string) => Promise<any>;
  } | null>(null);
  const originalTexturesRef = useRef<Map<any, any> | null>(null);

  useEffect(() => {
    let mounted = true;
    ensureModelViewer()
      .then(() => mounted && setReady(true))
      .catch(() => mounted && setReady(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Re-apply / restore fabric texture whenever the swatch changes.
  useEffect(() => {
    if (!ready) return;
    const mv = mvRef.current;
    if (!mv) return;
    let cancelled = false;

    const applyTexture = async () => {
      // Wait for the model to be loaded.
      const model = mv.model;
      if (!model) {
        const onLoad = () => {
          mv.removeEventListener("load", onLoad);
          if (!cancelled) applyTexture();
        };
        mv.addEventListener("load", onLoad);
        return;
      }
      const materials: any[] = model.materials || [];
      if (materials.length === 0) return;

      // Cache original baseColorTextures once, so we can restore.
      if (!originalTexturesRef.current) {
        const cache = new Map<any, any>();
        for (const m of materials) {
          try {
            const tex = m?.pbrMetallicRoughness?.baseColorTexture?.texture ?? null;
            cache.set(m, tex);
          } catch {
            /* noop */
          }
        }
        originalTexturesRef.current = cache;
      }

      const filter = (m: any) =>
        !fabricMaterialNameIncludes ||
        String(m?.name || "").toLowerCase().includes(fabricMaterialNameIncludes.toLowerCase());

      if (!fabricTextureUrl) {
        // Restore originals.
        for (const m of materials) {
          if (!filter(m)) continue;
          const original = originalTexturesRef.current.get(m) ?? null;
          try {
            m.pbrMetallicRoughness.baseColorTexture.setTexture(original);
          } catch {
            /* noop */
          }
        }
        return;
      }

      try {
        const texture = await mv.createTexture!(fabricTextureUrl);
        if (cancelled || !texture) return;
        for (const m of materials) {
          if (!filter(m)) continue;
          try {
            m.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
            // Neutralise the base color factor so the texture reads true.
            m.pbrMetallicRoughness.setBaseColorFactor?.([1, 1, 1, 1]);
          } catch {
            /* noop */
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Product3DViewer] Failed to apply fabric texture", err);
      }
    };

    applyTexture();
    return () => {
      cancelled = true;
    };
  }, [ready, fabricTextureUrl, fabricMaterialNameIncludes, url]);

  // Reset cached originals whenever the model URL changes.
  useEffect(() => {
    originalTexturesRef.current = null;
  }, [url]);

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
            ref={mvRef as any}
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
