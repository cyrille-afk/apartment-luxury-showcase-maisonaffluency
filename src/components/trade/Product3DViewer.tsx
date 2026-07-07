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
   * Optional filter: restrict the swap to materials whose name matches one of
   * these substrings (case-insensitive). If omitted, we auto-detect upholstery
   * meshes using a naming convention (see UPHOLSTERY_KEYWORDS). If no material
   * matches the convention, we fall back to applying the texture to every
   * material so older GLBs without the convention still swap.
   *
   * Convention for GLB authors: name any mesh/material that should accept the
   * user-selected fabric using one of the keywords below (e.g. "fabric",
   * "upholstery_seat", "cushion_back", "cover_main"). Non-upholstery parts
   * (wood_leg, metal_frame, glass_top, etc.) will then be left untouched.
   */
  fabricMaterialNameIncludes?: string | string[];
  /**
   * When true, renders a small collapsible panel showing which material
   * names were detected on the GLB and which ones the upholstery filter
   * matched for the current swatch. Intended for admin/debug use.
   */
  debug?: boolean;
}

interface DebugInfo {
  all: string[];
  matched: string[];
  fellBackToAll: boolean;
  keywords: string[];
}

const Product3DViewer: React.FC<Props> = ({
  url,
  alt,
  poster,
  fabricTextureUrl,
  fabricMaterialNameIncludes,
  debug = false,
}) => {
  const [ready, setReady] = useState(() =>
    typeof window !== "undefined" && !!customElements.get("model-viewer"),
  );
  const mvRef = useRef<HTMLElement & {
    model?: any;
    createTexture?: (url: string) => Promise<any>;
  } | null>(null);
  const originalTexturesRef = useRef<Map<any, any> | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

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

      // Build the keyword list for the convention-based filter.
      const explicitKeywords = fabricMaterialNameIncludes
        ? (Array.isArray(fabricMaterialNameIncludes)
            ? fabricMaterialNameIncludes
            : [fabricMaterialNameIncludes])
        : null;
      const conventionKeywords = [
        "fabric",
        "upholstery",
        "cushion",
        "seat",
        "cover",
        "textile",
        "pillow",
        "sofa",
      ];
      const keywords = (explicitKeywords ?? conventionKeywords).map((k) =>
        k.toLowerCase(),
      );
      const matchesKeywords = (m: any) => {
        const name = String(m?.name || "").toLowerCase();
        return keywords.some((k) => name.includes(k));
      };
      // Determine effective target materials: if any material matches the
      // convention, restrict to those; otherwise fall back to all materials
      // so legacy GLBs without the naming convention still swap.
      const matched = materials.filter(matchesKeywords);
      const targets = matched.length > 0 ? matched : materials;
      const filter = (m: any) => targets.includes(m);

      // Publish debug info for the UI panel.
      setDebugInfo({
        all: materials.map((m) => String(m?.name || "(unnamed)")),
        matched: matched.map((m) => String(m?.name || "(unnamed)")),
        fellBackToAll: matched.length === 0,
        keywords,
      });

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
      {debug && debugInfo && (
        <div className="border-t border-border bg-background/60">
          <button
            type="button"
            onClick={() => setDebugOpen((s) => !s)}
            className="w-full flex items-center justify-between px-3 py-2 font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>
              Fabric filter · {debugInfo.matched.length}/{debugInfo.all.length} matched
              {debugInfo.fellBackToAll && " · fallback: all"}
              {fabricTextureUrl ? " · swatch active" : " · original"}
            </span>
            <span>{debugOpen ? "−" : "+"}</span>
          </button>
          {debugOpen && (
            <div className="px-3 pb-3 space-y-2 font-body text-[10px] leading-relaxed">
              <div>
                <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9px] mb-0.5">
                  Keywords
                </div>
                <div className="text-foreground/80">{debugInfo.keywords.join(", ")}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9px] mb-0.5">
                  Matched ({debugInfo.matched.length})
                </div>
                <div className="text-emerald-600 break-words">
                  {debugInfo.matched.length > 0 ? debugInfo.matched.join(", ") : "— none —"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9px] mb-0.5">
                  All materials ({debugInfo.all.length})
                </div>
                <div className="text-foreground/70 break-words">
                  {debugInfo.all.map((n, i) => {
                    const isMatch = debugInfo.matched.includes(n);
                    return (
                      <span key={`${n}-${i}`}>
                        {i > 0 && ", "}
                        <span className={isMatch ? "text-emerald-600" : ""}>{n}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              {debugInfo.fellBackToAll && (
                <div className="text-amber-600">
                  No material matched the convention — the swatch is applied to every material as a fallback. Rename your upholstery mesh to include one of the keywords above.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Product3DViewer;
