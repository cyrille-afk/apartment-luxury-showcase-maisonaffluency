import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Box } from "lucide-react";

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
   * Optional SECOND texture layer for dual-axis products (e.g. Base finish ×
   * Top fabric). When set, applied to materials matching the "frame/base"
   * keyword group (wood, frame, leg, base, marble, metal, structure) while
   * `fabricTextureUrl` continues to target upholstery materials. Passing null
   * restores originals for that group.
   */
  baseTextureUrl?: string | null;
  /**
   * Optional filter: restrict the fabric swap to materials whose name matches
   * one of these substrings (case-insensitive). If omitted, we auto-detect
   * upholstery meshes using a naming convention (see UPHOLSTERY_KEYWORDS).
   */
  fabricMaterialNameIncludes?: string | string[];
  /**
   * Optional filter for the base/frame texture. Defaults to the frame
   * keyword group (wood, frame, leg, base, marble, metal, structure).
   */
  baseMaterialNameIncludes?: string | string[];
  /**
   * Explicit per-material role map: { [materialName]: 'fabric'|'base'|'ignore' }.
   * When provided, takes priority over the keyword heuristics (needed when
   * GLB materials are named with opaque IDs from CAD tools). Materials absent
   * from the map fall through to keyword matching, then to the "ignore"
   * default (they keep their original texture and receive no swatch).
   */
  materialRoles?: Record<string, "fabric" | "base" | "ignore">;
  /**
   * Called once the underlying GLB has loaded, with the actual material names
   * discovered in the file. Used by the admin manager to build the role UI.
   */
  onMaterialsDiscovered?: (names: string[]) => void;

  /**
   * When true, mount the model-viewer element immediately (loads the
   * model-viewer script AND fetches the GLB on mount). Defaults to false:
   * the component shows a lightweight poster + "View in 3D" button and
   * only fetches the script/GLB after the user opts in. This keeps GLB
   * bytes off the critical path of the product page.
   */
  autoOpen?: boolean;
  /**
   * When true, renders a small collapsible panel showing which material
   * names were detected on the GLB and which ones the upholstery filter
   * matched for the current swatch. Intended for admin/debug use.
   */
  debug?: boolean;
}



interface LayerDebug {
  matched: string[];
  fellBackToAll: boolean;
  keywords: string[];
}
interface DebugInfo {
  all: string[];
  fabric: LayerDebug;
  base: LayerDebug;
}

const FABRIC_KEYWORDS = [
  "fabric",
  "upholstery",
  "cushion",
  "seat",
  "cover",
  "textile",
  "pillow",
  "sofa",
];

const BASE_KEYWORDS = [
  "wood",
  "frame",
  "leg",
  "base",
  "structure",
  "marble",
  "stone",
  "metal",
  "brass",
  "steel",
  "bronze",
  "top", // table tops, cabinet tops
];


const Product3DViewer: React.FC<Props> = ({
  url,
  alt,
  poster,
  fabricTextureUrl,
  baseTextureUrl,
  fabricMaterialNameIncludes,
  baseMaterialNameIncludes,
  materialRoles,
  onMaterialsDiscovered,
  autoOpen = false,
  debug = false,
}) => {
  const hasExplicitRoles = !!materialRoles && Object.keys(materialRoles).length > 0;

  const [opened, setOpened] = useState(autoOpen);
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
  const [autoTagged, setAutoTagged] = useState(false);
  const [noTargets, setNoTargets] = useState(false);

  // Only load the ~1MB model-viewer script once the user has opted in.
  useEffect(() => {
    if (!opened) return;
    let mounted = true;
    ensureModelViewer()
      .then(() => mounted && setReady(true))
      .catch(() => mounted && setReady(false));
    return () => {
      mounted = false;
    };
  }, [opened]);


  // Re-apply / restore textures whenever a swatch changes.
  useEffect(() => {
    if (!opened || !ready) return;
    const mv = mvRef.current;
    if (!mv) return;
    let cancelled = false;


    const applyTextures = async () => {
      const model = mv.model;
      if (!model) {
        const onLoad = () => {
          mv.removeEventListener("load", onLoad);
          if (!cancelled) applyTextures();
        };
        mv.addEventListener("load", onLoad);
        return;
      }
      const materials: any[] = model.materials || [];
      if (materials.length === 0) return;

      // Cache original baseColorTextures + texture-image identifiers once.
      // The texture-image identifier is used by the auto-detection fallback
      // when the material's own name is opaque (e.g. "Material.001").
      if (!originalTexturesRef.current) {
        const cache = new Map<any, any>();
        for (const m of materials) {
          try {
            const tex = m?.pbrMetallicRoughness?.baseColorTexture?.texture ?? null;
            cache.set(m, tex);
          } catch { /* noop */ }
        }
        originalTexturesRef.current = cache;
      }

      // Extract every string we can find that might describe what this
      // material actually is: material name, texture name, and any image
      // URI/name on the baseColorTexture (glTF often keeps original file
      // names like "wood_oak.jpg" or "Fabric_Base.png").
      const identifiersFor = (m: any): string[] => {
        const out: string[] = [];
        try { if (m?.name) out.push(String(m.name)); } catch { /* noop */ }
        try {
          const tex = m?.pbrMetallicRoughness?.baseColorTexture?.texture;
          if (tex?.name) out.push(String(tex.name));
          const src = tex?.source;
          if (src?.name) out.push(String(src.name));
          if (src?.uri) out.push(String(src.uri));
          if (src?.bufferView?.name) out.push(String(src.bufferView.name));
        } catch { /* noop */ }
        return out.map((s) => s.toLowerCase());
      };

      // Publish material names for the admin UI.
      const allNames = materials.map((m) => String(m?.name || "(unnamed)"));
      onMaterialsDiscovered?.(allNames);

      const toList = (v: string | string[] | undefined) =>
        v ? (Array.isArray(v) ? v : [v]).map((k) => k.toLowerCase()) : null;

      const fabricKeywords = toList(fabricMaterialNameIncludes) ?? FABRIC_KEYWORDS.map((k) => k.toLowerCase());
      const baseKeywords = toList(baseMaterialNameIncludes) ?? BASE_KEYWORDS.map((k) => k.toLowerCase());

      const matchAnyIdentifier = (m: any, kws: string[]) => {
        const ids = identifiersFor(m);
        return ids.some((id) => kws.some((k) => id.includes(k)));
      };

      const roleOf = (m: any): "fabric" | "base" | "ignore" | null => {
        const name = String(m?.name || "");
        if (materialRoles && Object.prototype.hasOwnProperty.call(materialRoles, name)) {
          return materialRoles[name];
        }
        return null;
      };

      // Last-resort classifier: use baseColorFactor luminance. Dark & warm →
      // wood/base. Light or neutral → fabric. Only used when a GLB has
      // exactly two untagged materials and no keyword hits.
      const luminanceRole = (m: any): "fabric" | "base" | null => {
        try {
          const f = m?.pbrMetallicRoughness?.baseColorFactor;
          if (!Array.isArray(f) || f.length < 3) return null;
          const [r, g, b] = f;
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const warm = r > b; // brown/wood tones skew red > blue
          if (lum < 0.35 && warm) return "base";
          if (lum > 0.5) return "fabric";
          return null;
        } catch { return null; }
      };

      let fabricMatched: any[];
      let baseMatched: any[];
      let ignored: any[];

      if (hasExplicitRoles) {
        // Explicit map wins. Unmapped materials default to "ignore".
        fabricMatched = materials.filter((m) => roleOf(m) === "fabric");
        baseMatched = materials.filter((m) => roleOf(m) === "base");
        ignored = materials.filter((m) => (roleOf(m) ?? "ignore") === "ignore");
      } else {
        // Tier 1: keyword match against material name + texture image URI.
        fabricMatched = materials.filter((m) => matchAnyIdentifier(m, fabricKeywords));
        const baseMatchedRaw = materials.filter((m) => matchAnyIdentifier(m, baseKeywords));
        baseMatched = baseMatchedRaw.filter((m) => !fabricMatched.includes(m));

        // Tier 2: for still-untagged materials, use baseColorFactor luminance.
        const tagged = new Set<any>([...fabricMatched, ...baseMatched]);
        for (const m of materials) {
          if (tagged.has(m)) continue;
          const guess = luminanceRole(m);
          if (guess === "fabric") fabricMatched.push(m);
          else if (guess === "base") baseMatched.push(m);
        }
        ignored = [];
      }


      // Targets: after explicit roles + name/URI matching + luminance auto-tag,
      // if a layer still has zero matches we apply to NOTHING rather than
      // painting the fabric texture over the entire model (the legacy
      // fallback that made a fabric swatch retexture wood legs, etc.).
      const fabricTargets = fabricMatched;
      const baseTargets = baseMatched;


      const restoreOne = (m: any) => {

        const original = originalTexturesRef.current!.get(m) ?? null;
        try { m.pbrMetallicRoughness.baseColorTexture.setTexture(original); } catch { /* noop */ }
      };

      const applyOne = async (targets: any[], textureUrl: string) => {
        const texture = await mv.createTexture!(textureUrl);
        if (cancelled || !texture) return;
        for (const m of targets) {
          try {
            m.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
            m.pbrMetallicRoughness.setBaseColorFactor?.([1, 1, 1, 1]);
          } catch { /* noop */ }
        }
      };

      // Publish debug info + a signal for the UI banner.
      setDebugInfo({
        all: allNames,
        fabric: {
          matched: fabricMatched.map((m) => String(m?.name || "(unnamed)")),
          fellBackToAll: false,
          keywords: hasExplicitRoles ? ["(explicit role map)"] : fabricKeywords,
        },
        base: {
          matched: baseMatched.map((m) => String(m?.name || "(unnamed)")),
          fellBackToAll: false,
          keywords: hasExplicitRoles ? ["(explicit role map)"] : baseKeywords,
        },
      });
      setAutoTagged(!hasExplicitRoles && (fabricMatched.length > 0 || baseMatched.length > 0));
      setNoTargets(fabricMatched.length === 0 && baseMatched.length === 0);



      try {
        // Fabric layer
        if (fabricTextureUrl) {
          await applyOne(fabricTargets, fabricTextureUrl);
        } else {
          for (const m of fabricTargets) restoreOne(m);
        }
        // Base layer
        if (baseTextureUrl) {
          await applyOne(baseTargets, baseTextureUrl);
        } else {
          for (const m of baseTargets) restoreOne(m);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Product3DViewer] Failed to apply texture", err);
      }
    };

    applyTextures();
    return () => { cancelled = true; };
  }, [opened, ready, fabricTextureUrl, baseTextureUrl, fabricMaterialNameIncludes, baseMaterialNameIncludes, materialRoles, hasExplicitRoles, onMaterialsDiscovered, url]);

  // Reset cached originals whenever the model URL changes.
  useEffect(() => {
    originalTexturesRef.current = null;
  }, [url]);

  const renderLayer = (label: string, info: LayerDebug, active: boolean) => (
    <div>
      <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9px] mb-0.5">
        {label} · {info.matched.length} matched{info.fellBackToAll ? " · fallback" : ""}{active ? " · active" : ""}
      </div>
      <div className="text-emerald-600 break-words">
        {info.matched.length > 0 ? info.matched.join(", ") : "— none —"}
      </div>
      <div className="text-muted-foreground/70 text-[9px] mt-0.5">
        keywords: {info.keywords.join(", ")}
      </div>
    </div>
  );

  return (
    <div className="border border-border rounded-md overflow-hidden bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/50">
        <Box size={13} className="text-muted-foreground" />
        <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Interactive 3D Model
        </span>
      </div>
      <div className="relative w-full aspect-square">
        {!opened ? (
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 group focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Load interactive 3D model"
          >
            {poster ? (
              <img
                src={poster}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="absolute inset-0 bg-muted/40" />
            )}
            <span className="relative z-10 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 border border-border shadow-sm font-body text-[11px] uppercase tracking-[0.12em] text-foreground group-hover:bg-background transition-colors">
              <Box size={13} />
              View in 3D
            </span>
          </button>
        ) : ready ? (
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
            loading="eager"
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
        {opened
          ? "Drag to rotate · scroll to zoom · tap the cube to view in your room (AR)"
          : "Tap to load the interactive 3D model (downloads on demand)"}
      </p>

      {opened && !hasExplicitRoles && noTargets && (
        <div className="px-3 py-2 border-t border-border bg-[hsl(var(--warning)/0.08)]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" />
            <p className="font-body text-[10px] leading-snug text-[hsl(var(--warning))]">
              This GLB uses opaque material names and no fabric/wood roles could
              be auto-detected. Finish swatches will not update the 3D model
              until an admin tags material roles in the GLB manager.
            </p>
          </div>
        </div>
      )}
      {opened && !hasExplicitRoles && autoTagged && (
        <div className="px-3 py-2 border-t border-border bg-muted/40">
          <p className="font-body text-[10px] leading-snug text-muted-foreground">
            Material roles auto-detected from texture names / base colours.
            For a permanent mapping, ask an admin to tag roles in the GLB
            manager.
          </p>
        </div>
      )}

      {debug && debugInfo && (
        <div className="border-t border-border bg-background/60">
          <button
            type="button"
            onClick={() => setDebugOpen((s) => !s)}
            className="w-full flex items-center justify-between px-3 py-2 font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>
              Materials · fabric {debugInfo.fabric.matched.length} · base {debugInfo.base.matched.length} / {debugInfo.all.length}
            </span>
            <span>{debugOpen ? "−" : "+"}</span>
          </button>
          {debugOpen && (
            <div className="px-3 pb-3 space-y-2 font-body text-[10px] leading-relaxed">
              {renderLayer("Fabric layer", debugInfo.fabric, !!fabricTextureUrl)}
              {renderLayer("Base layer", debugInfo.base, !!baseTextureUrl)}
              <div>
                <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9px] mb-0.5">
                  All materials ({debugInfo.all.length})
                </div>
                <div className="text-foreground/70 break-words">
                  {debugInfo.all.join(", ")}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

};

export default Product3DViewer;
