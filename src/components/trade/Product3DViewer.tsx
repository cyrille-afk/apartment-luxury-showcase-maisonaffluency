import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Box, Camera, Lock, LockOpen, Move, QrCode, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { arViewerUrl, type ArViewerHandoff } from "@/lib/arViewerHandoff";
import { editorialModelCamera, editorialUprightRotation } from "@/lib/editorialModelFraming";
import { editorialUnnamedMaterialRole } from "@/lib/editorialModelMaterials";

declare module "react" {
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
          "ar-scale"?: "fixed" | "auto";
          "ar-modes"?: string;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string | number;
          "environment-image"?: string;
          exposure?: string | number;
          "tone-mapping"?: string;
          loading?: "auto" | "lazy" | "eager";
          reveal?: "auto" | "manual";
          scale?: string;
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
   * undefined restores the model's original materials in place.
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
   * Optional THIRD texture layer for pieces whose top surface is distinct
   * from the base (e.g. marble top on a metal base). Applied to materials
   * tagged with role "top" in the explicit role map, or matching the top
   * keyword group (top, tabletop, surface, marble, stone, glass).
   */
  topTextureUrl?: string | null;
  /** Separate backrest upholstery; materials tagged "backrest" fall back to the fabric texture when absent. */
  backrestTextureUrl?: string | null;
  /**
   * Optional filter for the top texture. Defaults to the top keyword group.
   */
  topMaterialNameIncludes?: string | string[];
  /**
   * Explicit per-material role map: { [materialName]: 'fabric'|'base'|'top'|'ignore' }.
   * When provided, takes priority over the keyword heuristics (needed when
   * GLB materials are named with opaque IDs from CAD tools). Materials absent
   * from the map fall through to keyword matching, then to the "ignore"
   * default (they keep their original texture and receive no swatch).
   */
  materialRoles?: Record<string, "fabric" | "backrest" | "base" | "top" | "ignore">;
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
  autoRotate?: boolean;
  clientEditorial?: boolean;
  furnitureCategory?: string;
  furnitureDimensions?: { width: number; depth: number; height: number };
  /**
   * When true, renders a small collapsible panel showing which material
   * names were detected on the GLB and which ones the upholstery filter
   * matched for the current swatch. Intended for admin/debug use.
   */
  debug?: boolean;
  /** model-viewer `scale` ("x y z"), used to morph proportions for size previews. */
  scale?: string | null;
  /** Reports when the user opens the interactive model. */
  onOpenedChange?: (opened: boolean) => void;
  /** Catalogue identifiers only, restored as an unsaved preview on the receiving page. */
  arHandoff?: ArViewerHandoff;
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
  top: LayerDebug;
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
  "metal",
  "brass",
  "steel",
  "bronze",
];

const TOP_KEYWORDS = [
  "top",
  "tabletop",
  "surface",
  "marble",
  "stone",
  "glass",
  "onyx",
];


const Product3DViewer: React.FC<Props> = ({
  url,
  alt,
  poster,
  fabricTextureUrl,
  baseTextureUrl,
  topTextureUrl,
  backrestTextureUrl,
  fabricMaterialNameIncludes,
  baseMaterialNameIncludes,
  topMaterialNameIncludes,
  materialRoles,
  onMaterialsDiscovered,
  autoOpen = false,
  autoRotate = true,
  clientEditorial = false,
  furnitureCategory = "",
  furnitureDimensions,
  debug = false,
  scale,
  onOpenedChange,
  arHandoff,
}) => {
  const hasExplicitRoles = !!materialRoles && Object.keys(materialRoles).length > 0;

  const [opened, setOpened] = useState(autoOpen);
  useEffect(() => { if (autoOpen) setOpened(true); }, [autoOpen]);
  useEffect(() => { onOpenedChange?.(opened); }, [opened, onOpenedChange]);
  const [ready, setReady] = useState(() =>
    typeof window !== "undefined" && !!customElements.get("model-viewer"),
  );
  const mvRef = useRef<HTMLElement & {
    model?: any;
    createTexture?: (url: string) => Promise<any>;
    activateAR?: () => Promise<void>;
    updateComplete?: Promise<unknown>;
  } | null>(null);
  const originalTexturesRef = useRef<Map<any, any> | null>(null);
  const originalFactorsRef = useRef<Map<any, any>>(new Map());
  const originalIdentifiersRef = useRef<Map<any, string[]>>(new Map());
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [autoTagged, setAutoTagged] = useState(false);
  const [noTargets, setNoTargets] = useState(false);
  // Camera lock — mirrors the Visualiser Sandbox position locks: when on,
  // rotate/zoom/pan are disabled so the composition can't be nudged.
  const [locked, setLocked] = useState(false);
  const [mobileAr, setMobileAr] = useState(false);
  const [arAvailable, setArAvailable] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [appliedAppearance, setAppliedAppearance] = useState<string | null>(null);
  const [arError, setArError] = useState("");
  const appearanceKey = JSON.stringify([url, fabricTextureUrl, baseTextureUrl, topTextureUrl, backrestTextureUrl, materialRoles, scale]);
  const appearanceReady = appliedAppearance === appearanceKey;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    const update = () => setMobileAr(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setArAvailable(false);
    if (!mobileAr || !opened || !ready) return;
    const viewer = mvRef.current as (HTMLElement & { canActivateAR?: boolean; updateComplete?: Promise<unknown> }) | null;
    if (!viewer) return;
    let cancelled = false;
    const update = async () => {
      await viewer.updateComplete;
      if (!cancelled) setArAvailable(viewer.canActivateAR === true);
    };
    void update();
    viewer.addEventListener("load", update);
    viewer.addEventListener("ar-status", update);
    return () => {
      cancelled = true;
      viewer.removeEventListener("load", update);
      viewer.removeEventListener("ar-status", update);
    };
  }, [mobileAr, opened, ready, url]);

  useEffect(() => {
    if (!clientEditorial || !opened || !ready) return;
    const mv = mvRef.current as any;
    if (!mv) return;
    let cancelled = false;
    const frame = async () => {
      mv.removeAttribute("data-scene-ready");
      mv.orientation = "0deg 0deg 0deg";
      await mv.updateComplete;
      if (cancelled || !mv.getDimensions) return;
      const initial = mv.getDimensions();
      const rotation = editorialUprightRotation(initial, `${furnitureCategory} ${alt}`, url, furnitureDimensions);
      // model-viewer orientation is roll / pitch / yaw; pitch rotates around X.
      mv.orientation = rotation ? "0deg -90deg 0deg" : "0deg 0deg 0deg";
      await mv.updateComplete;
      if (cancelled) return;
      const size = mv.getDimensions();
      const center = mv.getBoundingBoxCenter();
      const camera = editorialModelCamera(size, center, mv.clientWidth / Math.max(1, mv.clientHeight));
      // The renderer centers X/Z around this target and grounds its contact
      // shadow on boundingBox.min.y after the orientation is recomputed.
      mv.setAttribute("camera-target", `${camera.target.x}m ${camera.target.y}m ${camera.target.z}m`);
      mv.setAttribute("camera-orbit", `${camera.theta}rad ${camera.phi}rad ${camera.distance}m`);
      mv.setAttribute("min-camera-orbit", `auto 35deg ${camera.distance * .6}m`);
      mv.setAttribute("max-camera-orbit", `auto 88deg ${camera.distance * 2.5}m`);
      mv.setAttribute("shadow-intensity", "0.35");
      mv.setAttribute("shadow-softness", "0.8");
      mv.removeAttribute("auto-rotate");
      await mv.updateComplete;
      if (cancelled) return;
      mv.jumpCameraToGoal?.();
      mv.setAttribute("data-scene-ready", "true");
    };
    mv.addEventListener("load", frame);
    if (mv.loaded) void frame();
    return () => { cancelled = true; mv.removeEventListener("load", frame); };
  }, [clientEditorial, furnitureCategory, furnitureDimensions?.width, furnitureDimensions?.depth, furnitureDimensions?.height, alt, url, opened, ready]);

  // Clamp scroll-zoom to a band around the auto-framed radius so the piece
  // can never be zoomed out of sight or into the camera. model-viewer
  // already swallows wheel events over the canvas, so the page never scrolls.
  useEffect(() => {
    if (!opened || !ready || clientEditorial) return;
    const mv = mvRef.current as any;
    if (!mv) return;
    const clamp = () => {
      try {
        const radius = mv.getCameraOrbit?.()?.radius;
        if (typeof radius === "number" && radius > 0) {
          mv.setAttribute("min-camera-orbit", `auto auto ${(radius * 0.4).toFixed(3)}m`);
          mv.setAttribute("max-camera-orbit", `auto auto ${(radius * 2.5).toFixed(3)}m`);
        }
      } catch { /* noop */ }
    };
    if (mv.model) clamp();
    else mv.addEventListener("load", clamp, { once: true });
    return () => mv.removeEventListener("load", clamp);
  }, [opened, ready, url, clientEditorial]);

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
    let textureRun = 0;
    setAppliedAppearance(null);
    setArError("");

    const applyTextures = async () => {
      const run = ++textureRun;
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
        originalFactorsRef.current.clear();
        originalIdentifiersRef.current.clear();
        for (const m of materials) {
          try {
            const tex = m?.pbrMetallicRoughness?.baseColorTexture?.texture ?? null;
            cache.set(m, tex);
            originalFactorsRef.current.set(m, [...(m.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1])]);
            originalIdentifiersRef.current.set(m, [m.name, tex?.name, tex?.source?.name, tex?.source?.uri, tex?.source?.bufferView?.name]
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.toLowerCase()));
          } catch { /* noop */ }
        }
        originalTexturesRef.current = cache;
      }

      // Extract every string we can find that might describe what this
      // material actually is: material name, texture name, and any image
      // URI/name on the baseColorTexture (glTF often keeps original file
      // names like "wood_oak.jpg" or "Fabric_Base.png").
      const identifiersFor = (m: any): string[] => {
        const original = originalIdentifiersRef.current.get(m);
        if (original) return original;
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
      const topKeywords = toList(topMaterialNameIncludes) ?? TOP_KEYWORDS.map((k) => k.toLowerCase());

      const matchAnyIdentifier = (m: any, kws: string[]) => {
        const ids = identifiersFor(m);
        return ids.some((id) => kws.some((k) => id.includes(k)));
      };

      const roleOf = (m: any): "fabric" | "backrest" | "base" | "top" | "ignore" | null => {
        const name = String(m?.name || "");
        if (materialRoles && Object.prototype.hasOwnProperty.call(materialRoles, name)) {
          return materialRoles[name];
        }
        if (clientEditorial && !hasExplicitRoles) return editorialUnnamedMaterialRole(url, materials.indexOf(m), materials.length);
        return null;
      };

      // Last-resort classifier: use baseColorFactor luminance. Dark & warm →
      // wood/base. Light or neutral → fabric. Only used when a GLB has
      // exactly two untagged materials and no keyword hits.
      const luminanceRole = (m: any): "fabric" | "base" | null => {
        try {
          const f = originalFactorsRef.current.get(m);
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
      let topMatched: any[];
      let ignored: any[];
      let backrestMatched: any[] = [];

      if (hasExplicitRoles || (clientEditorial && materials.some(m => roleOf(m) !== null))) {
        // Explicit map wins. Unmapped materials default to "ignore".
        fabricMatched = materials.filter((m) => roleOf(m) === "fabric" || (roleOf(m) === "backrest" && !backrestTextureUrl));
        backrestMatched = backrestTextureUrl ? materials.filter((m) => roleOf(m) === "backrest") : [];
        baseMatched = materials.filter((m) => roleOf(m) === "base");
        topMatched = materials.filter((m) => roleOf(m) === "top");
        ignored = materials.filter((m) => (roleOf(m) ?? "ignore") === "ignore");
      } else {
        // Tier 1: keyword match against material name + texture image URI.
        fabricMatched = materials.filter((m) => matchAnyIdentifier(m, fabricKeywords));
        const topMatchedRaw = materials.filter((m) => matchAnyIdentifier(m, topKeywords));
        topMatched = topMatchedRaw.filter((m) => !fabricMatched.includes(m));
        const baseMatchedRaw = materials.filter((m) => matchAnyIdentifier(m, baseKeywords));
        baseMatched = baseMatchedRaw.filter(
          (m) => !fabricMatched.includes(m) && !topMatched.includes(m),
        );

        // Tier 2: for still-untagged materials, use baseColorFactor luminance.
        const tagged = new Set<any>([...fabricMatched, ...baseMatched, ...topMatched]);
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
      const topTargets = topMatched;


      const restoreOne = (m: any) => {

        if (cancelled || mv.model !== model) return;
        const original = originalTexturesRef.current?.get(m) ?? null;
        try {
          m.pbrMetallicRoughness.baseColorTexture.setTexture(original);
          m.pbrMetallicRoughness.setBaseColorFactor?.(originalFactorsRef.current.get(m) || [1, 1, 1, 1]);
        } catch { /* noop */ }
      };

      let textureFailed = false;
      const applyOne = async (targets: any[], textureUrl: string, matte = false) => {
        if (cancelled || run !== textureRun) return;
        if (!targets.length || !mv.createTexture) { textureFailed = true; return; }
        const texture = await mv.createTexture(textureUrl);
        if (cancelled || run !== textureRun || mv.model !== model) return;
        if (!texture) { textureFailed = true; return; }
        for (const m of targets) {
          try {
            m.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
            m.pbrMetallicRoughness.setBaseColorFactor?.([1, 1, 1, 1]);
            // Textiles are never metallic: some exports ship 0.5 metal on upholstery, which made fabric read as satin plastic.
            if (matte) { m.pbrMetallicRoughness.setMetallicFactor?.(0); m.pbrMetallicRoughness.setRoughnessFactor?.(0.95); }
          } catch { textureFailed = true; }
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
        top: {
          matched: topMatched.map((m) => String(m?.name || "(unnamed)")),
          fellBackToAll: false,
          keywords: hasExplicitRoles ? ["(explicit role map)"] : topKeywords,
        },
      });
      setAutoTagged(
        !hasExplicitRoles &&
          (fabricMatched.length > 0 || baseMatched.length > 0 || topMatched.length > 0),
      );
      setNoTargets(
        fabricMatched.length === 0 && baseMatched.length === 0 && topMatched.length === 0,
      );



      try {
        // Fabric layer
        if (fabricTextureUrl) {
          await applyOne(fabricTargets, fabricTextureUrl, true);
        } else {
          for (const m of fabricTargets) restoreOne(m);
        }
        if (backrestTextureUrl) await applyOne(backrestMatched, backrestTextureUrl, true);
        // Base layer
        if (baseTextureUrl) {
          await applyOne(baseTargets, baseTextureUrl);
        } else {
          for (const m of baseTargets) restoreOne(m);
        }
        // Top layer
        if (topTextureUrl) {
          await applyOne(topTargets, topTextureUrl);
        } else {
          for (const m of topTargets) restoreOne(m);
        }
        await mv.updateComplete;
        if (!cancelled && run === textureRun && mv.model === model) {
          setAppliedAppearance(textureFailed ? null : appearanceKey);
          if (textureFailed) setArError("This finish couldn’t be prepared for AR. Please select it again.");
        }
      } catch (err) {
        if (!cancelled && run === textureRun) setArError("This finish couldn’t be prepared for AR. Please select it again.");
        // eslint-disable-next-line no-console
        console.warn("[Product3DViewer] Failed to apply texture", err);
      }
    };

    applyTextures();
    // A src swap (e.g. size variant GLB) fires "load" after this effect ran
    // against the outgoing model — re-apply to the freshly loaded one.
    const onModelLoad = () => {
      if (cancelled) return;
      originalTexturesRef.current = null;
      applyTextures();
    };
    mv.addEventListener("load", onModelLoad);
    return () => { cancelled = true; mv.removeEventListener("load", onModelLoad); };
  }, [opened, ready, fabricTextureUrl, baseTextureUrl, topTextureUrl, backrestTextureUrl, fabricMaterialNameIncludes, baseMaterialNameIncludes, topMaterialNameIncludes, materialRoles, hasExplicitRoles, onMaterialsDiscovered, url, clientEditorial, appearanceKey]);

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
    <div className="shrink-0 border border-border rounded-md overflow-hidden bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/50">
        <Box size={13} className="text-muted-foreground" />
        <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Interactive 3D Model
        </span>
        {opened && ready && (
          <button
            type="button"
            onClick={() => setLocked((s) => !s)}
            aria-pressed={locked}
            title={locked ? "Unlock camera controls" : "Lock camera controls"}
            className={`ml-auto flex items-center gap-1 rounded-sm border px-2 py-1 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
              locked
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {locked ? <Lock size={11} /> : <LockOpen size={11} />}
            {locked ? "Locked" : "Lock"}
          </button>
        )}
      </div>
      <div className="relative w-full aspect-square">
        {!opened ? (
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 group focus:outline-hidden focus:ring-2 focus:ring-primary/40"
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
            {...(!locked
              ? {
                  "camera-controls": true,
                  ...(autoRotate && !clientEditorial ? { "auto-rotate": true } : {}),
                  // Touch: one finger orbits (in any direction), pinch zooms,
                  // two-finger drag pans. Lock hands the gesture back to page scroll.
                  "touch-action": "none",
                  "auto-rotate-delay": "4000",
                  "interaction-prompt": "none",
                }
              : {})}
            ar={mobileAr}
            ar-scale="fixed"
            ar-modes="webxr quick-look"
            scale={scale || "1 1 1"}
            shadow-intensity="1"
            exposure="1"
            tone-mapping="neutral"
            loading="eager"
            reveal="auto"
            data-appearance-ready={appearanceReady ? "true" : "false"}
            style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
          >
            {arAvailable && (
              <Button slot="ar-button" type="button" variant="space-preview" disabled={!appearanceReady} title={appearanceReady ? "View your selected finishes in AR" : "Preparing selected finishes…"} className="absolute bottom-4 right-4 max-w-[calc(100%-2rem)] rounded-full px-4 font-display text-sm md:hidden" onClick={event => {
                event.preventDefault(); event.stopPropagation();
                if (!appearanceReady || !mvRef.current?.activateAR) return;
                // Call synchronously from the tap; Quick Look exports the freshly textured scene.
                void mvRef.current.activateAR().catch(() => setArError("AR couldn’t open. Please try again."));
              }}>
                <Box strokeWidth={1.25} aria-hidden="true" />
                View in Your Space
              </Button>
            )}
          </model-viewer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <span className="font-body text-[11px] uppercase tracking-[0.12em]">Loading 3D…</span>
          </div>
        )}
        {opened && ready && (
          <Button type="button" variant="space-preview" className="absolute bottom-4 right-4 hidden max-w-[calc(100%-2rem)] rounded-full px-4 font-display text-sm md:flex" onClick={() => {
            setQrUrl(arViewerUrl(window.location.href, arHandoff));
          }}>
            <QrCode strokeWidth={1.25} aria-hidden="true" />
            View in Your Room (AR)
          </Button>
        )}
      </div>
      <Dialog open={!!qrUrl} onOpenChange={open => { if (!open) setQrUrl(""); }}>
        <DialogContent className="space-preview-dialog w-[calc(100%-2rem)] max-w-md gap-5 px-8 py-10 text-center" overlayClassName="bg-foreground/40 backdrop-blur-sm">
          <DialogTitle className="font-display text-3xl font-normal leading-tight tracking-normal">Experience in Your Space</DialogTitle>
          <DialogDescription className="font-display text-base leading-relaxed">Scan with your iPhone camera to place this piece to scale in your room.</DialogDescription>
          {qrUrl && <QRCodeSVG value={qrUrl} size={232} level="M" marginSize={4} fgColor="var(--space-qr-ink)" bgColor="var(--space-qr-paper)" title="Scan to open this piece on your iPhone" className="mx-auto h-auto w-full max-w-60" />}
          <p className="font-display text-sm leading-relaxed text-muted-foreground">No app download required · Works with iOS Safari &amp; Chrome</p>
        </DialogContent>
      </Dialog>
      <p className="px-3 py-2 font-display text-[10px] leading-snug text-muted-foreground/70 border-t border-border">
        {opened
          ? (locked
              ? "Camera locked — unlock above to rotate or zoom"
              : (<>
                  <span className="hidden md:inline">Drag to rotate · scroll to zoom (bounded)</span>
                  <span className="md:hidden">{arAvailable ? "Tap View in Your Space to view this piece to scale in your room." : "Drag to rotate · pinch to zoom"}</span>
                </>))
          : (<>
              <span className="block">Tap to load the interactive 3D model (downloads on demand)</span>
              <span className="block">Pick a fabric or wood finish on the right — the 3D preview updates live.</span>
            </>)}
      </p>
      {arError && <p role="status" className="px-3 pb-2 font-display text-xs text-muted-foreground">{arError}</p>}

      {arAvailable && (
        <Accordion type="single" collapsible className="md:hidden border-t border-border bg-background px-3">
          <AccordionItem value="ar-guide" className="border-b-0">
            <AccordionTrigger className="gap-3 py-3 text-left font-display text-sm text-muted-foreground hover:no-underline [&>svg]:size-4">
              First time using AR? View quick guide
            </AccordionTrigger>
            <AccordionContent className="space-y-4 font-body text-xs leading-relaxed text-muted-foreground">
              <div className="flex gap-3"><Smartphone className="mt-0.5 size-4 shrink-0" strokeWidth={1.25} /><div><h4 className="font-display text-sm text-foreground">1. Scan Your Floor</h4><p>Tap View in Your Space and slowly pan your phone over an open floor area.</p></div></div>
              <div className="flex gap-3"><Move className="mt-0.5 size-4 shrink-0" strokeWidth={1.25} /><div><h4 className="font-display text-sm text-foreground">2. Place & Rotate</h4><p>Drag with one finger to position the piece, or twist with two fingers to turn it.</p></div></div>
              <div className="flex gap-3"><Camera className="mt-0.5 size-4 shrink-0" strokeWidth={1.25} /><div><h4 className="font-display text-sm text-foreground">3. Capture & Share</h4><p>Tap the shutter button to save a true-to-scale photo to share with your partner or designer.</p></div></div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {opened && !clientEditorial && !hasExplicitRoles && noTargets && (
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
      {opened && !clientEditorial && !hasExplicitRoles && autoTagged && (
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
              Materials · fabric {debugInfo.fabric.matched.length} · base {debugInfo.base.matched.length} · top {debugInfo.top.matched.length} / {debugInfo.all.length}
            </span>
            <span>{debugOpen ? "−" : "+"}</span>
          </button>
          {debugOpen && (
            <div className="px-3 pb-3 space-y-2 font-body text-[10px] leading-relaxed">
              {renderLayer("Fabric layer", debugInfo.fabric, !!fabricTextureUrl)}
              {renderLayer("Base layer", debugInfo.base, !!baseTextureUrl)}
              {renderLayer("Top layer", debugInfo.top, !!topTextureUrl)}
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
