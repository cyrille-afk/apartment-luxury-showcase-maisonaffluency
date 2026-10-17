import { advancedSceneLighting, DEFAULT_ADVANCED_RENDERING, type AdvancedRenderingSettings, type EnvironmentSourcePref } from "@/lib/visualiserAdvancedRendering";
import softboxAsset from "@/assets/studio-softbox.exr.asset.json";
import windowAsset from "@/assets/window-interior.exr.asset.json";
import emptyRoomAsset from "@/assets/small-empty-room.exr.asset.json";
import type { CeilingSettings } from "@/lib/visualiserCeilingSettings";
import { RUG_TOP_Y } from "./RoomSurfaces";
import type { RugBorderColor, RugColor, RugWeave } from "@/lib/visualiserRoomSurfaces";
import { Suspense, useEffect, useState, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { DEFAULT_ARCHITECTURAL_DOF, foregroundFurnitureFocus, selectedObjectFocus } from "@/lib/visualiserDepthOfField";
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import type { FinishPart } from "@/lib/visualiserFinishTargets";
import SceneObject, { type PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { footprintRadius, floorFocusPoint } from "@/lib/visualiserPlacement";
import * as THREE from "three";
import PathTracerLayer from "./PathTracerLayer";
import LuxuryBackdrop from "./LuxuryBackdrop";
import { LUXURY_BACKDROP, windowLightPosition } from "./luxuryBackdropSettings";
import InitialRoomReveal, { InitialAssetsCommitted } from "./InitialRoomReveal";
import type { PhotorealFrameCaptureRef } from "@/lib/visualiserPhotorealGhost";
import { Bloom, EffectComposer, DepthOfField, SSAO, ToneMapping } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { createExrEnvironmentTexture } from "@/lib/visualiserExrTexture";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import studioAsset from "@/assets/showroom-studio.hdr.asset.json";
import { SHOWROOM } from "@/lib/showroomRendering";
import { validateEmptyRoomExr } from "@/lib/emptyRoomExr";
import RoomSurfaces from "./RoomSurfaces";
import ArchitecturalFeatureWall from "./ArchitecturalFeatureWall";
import ArchitecturalDownlights from "./ArchitecturalDownlights";
import type { FeatureWallFinish } from "@/lib/visualiserFeatureWall";
import { backdropStageColor, type RoomFloorFinish, type RoomWallColor, type RoomWallFinish } from "@/lib/visualiserRoomSurfaces";

export type VisualiserEnvironmentSource = EnvironmentSourcePref | "local";
export type VisualiserEnvironmentStatus = { source: VisualiserEnvironmentSource; exr?: "missing" | "unreadable" };

const ENV_STATUS_EVENT = "ma-visualiser-env";

/** Broadcasts which HDRI the canvas ended up on so the page can confirm it. */
export function reportEnvironmentStatus(status: VisualiserEnvironmentStatus) {
  window.dispatchEvent(new CustomEvent<VisualiserEnvironmentStatus>(ENV_STATUS_EVENT, { detail: status }));
}

/**
 * Loads independently: furniture stays visible with local IBL on slow/failing
 * networks. `preferred` lets the toolbar switch between the studio's empty-room
 * EXR and the built-in studio HDRI without remounting the canvas.
 */
const StudioEnvironment = ({ preferred, pathTrace = false, lightIntensity = 1, onReady }: { preferred: VisualiserEnvironmentSource; pathTrace?: boolean; lightIntensity?: number; onReady?: () => void }) => {
  const [map, setMap] = useState<THREE.DataTexture | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [localVersion, setLocalVersion] = useState(0);
  useEffect(() => {
    const bump = () => setLocalVersion((v) => v + 1);
    window.addEventListener("ma-local-exr-changed", bump);
    return () => window.removeEventListener("ma-local-exr-changed", bump);
  }, []);
  useEffect(() => {
    let cancelled = false;
    let owned: THREE.DataTexture | null = null;
    setMap(null);
    const accept = (source: VisualiserEnvironmentSource, exr?: "missing" | "unreadable") => (texture: THREE.DataTexture) => {
      if (cancelled) { texture.dispose(); return; }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      owned = texture;
      setMap(texture);
      reportEnvironmentStatus({ source, exr });
      invalidate();
    };
    const fallbackToStudioHdr = (exr?: "missing" | "unreadable") => {
      if (cancelled) return;
      new RGBELoader().load(studioAsset.url, accept("studio-hdr", exr), undefined, () => {
        /* Keep local studio reflections if both HDRI sources are unavailable. */
        if (cancelled) return;
        reportEnvironmentStatus({ source: "local", exr });
        onReady?.();
      });
    };
    const loadHostedExr = (source: VisualiserEnvironmentSource, url: string) => {
      fetch(url).then(async (response) => {
        if (!response.ok) throw new Error("EXR unavailable");
        const buffer = await response.arrayBuffer();
        if (!cancelled) accept(source)(createExrEnvironmentTexture(buffer));
      }).catch(() => fallbackToStudioHdr("unreadable"));
    };
    const loadEmptyRoom = () => {
      // The studio's own empty-room EXR — validated (present + readable) before parsing.
      validateEmptyRoomExr().then((result) => {
        if (cancelled) return;
        if (result.state !== "ok") { loadHostedExr("empty-room-exr", emptyRoomAsset.url); return; }
        try {
          accept("empty-room-exr")(createExrEnvironmentTexture(result.buffer));
        } catch {
          fallbackToStudioHdr("unreadable");
        }
      }).catch(() => fallbackToStudioHdr("unreadable"));
    };
    if (preferred === "empty-room-exr") loadEmptyRoom();
    else if (preferred === "studio-softbox-exr") loadHostedExr(preferred, softboxAsset.url);
    else if (preferred === "window-interior-exr") loadHostedExr(preferred, windowAsset.url);
    else fallbackToStudioHdr();
    return () => { cancelled = true; owned?.dispose(); };
  }, [invalidate, preferred, localVersion]);
  // Raster: HDRI is reflections only. Photoreal: HDRI is bound to scene.environment at physical
  // intensity AND to scene.background (heavily blurred so its curtains/wallpaper never read as a backdrop),
  // so escaping rays gather real light instead of a grey void.
  const rotation: [number, number, number] = [0, Math.PI / 4, 0];
  const environmentIntensity = lightIntensity * (pathTrace ? SHOWROOM.photorealEnvironmentScale : SHOWROOM.environmentIntensity);
  // Environment binds the map in its layout effect. Wake the demand loop AFTER
  // that commit, not only when the download completes, so PMREM and the tracer
  // see the new texture even after reaching the final sample cap.
  useEffect(() => {
    invalidate();
    if (map) onReady?.();
  }, [map, environmentIntensity, pathTrace, invalidate, onReady]);
  if (map) return (
    <Environment
      key={map.uuid}
      map={map}
      background={pathTrace}
      environmentIntensity={environmentIntensity}
      backgroundIntensity={pathTrace ? environmentIntensity : 1}
      backgroundBlurriness={pathTrace ? 0.85 : 0}
      environmentRotation={rotation}
      backgroundRotation={rotation}
    />
  );
  return (
    <Environment resolution={256} background={pathTrace} backgroundBlurriness={pathTrace ? 0.85 : 0} environmentIntensity={environmentIntensity} backgroundIntensity={pathTrace ? environmentIntensity : 1} environmentRotation={rotation} backgroundRotation={rotation}>
      <Lightformer intensity={2.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} color={SHOWROOM.rim} />
      <Lightformer intensity={1.1} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[14, 6, 1]} color={SHOWROOM.key} />
      <Lightformer intensity={0.9} position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[14, 6, 1]} color={SHOWROOM.fill} />
    </Environment>
  );
};

/** Exposes a getter for the floor point at the centre of the camera view (raycast onto Y = 0). */
const FloorFocusReporter = ({ focusRef }: { focusRef: { current: (() => [number, number] | null) | null } }) => {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null;
  useEffect(() => {
    focusRef.current = () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const hit = floorFocusPoint([camera.position.x, camera.position.y, camera.position.z], [dir.x, dir.y, dir.z]);
      if (hit) return hit;
      return controls?.target ? [controls.target.x, controls.target.z] : null;
    };
    return () => { focusRef.current = null; };
  }, [camera, controls, focusRef]);
  return null;
};
import { parseDimensionString } from "@/lib/productDimensions";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";

/**
 * The canvas runs on `frameloop="demand"` so it does not burn a frame every
 * 16ms while the designer is doing something else (typing to Felix, reading
 * the ledger). This helper re-renders exactly when the scene actually changes
 * or while the pointer is interacting with it.
 */
const RenderOnDemand = ({ signature }: { signature: string }) => {
  const invalidate = useThree((s) => s.invalidate);
  const domElement = useThree((s) => s.gl.domElement);

  useEffect(() => {
    // Two frames: one for the state change, one after any texture/material swap.
    invalidate();
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
  }, [invalidate, signature]);

  useEffect(() => {
    const kick = () => invalidate();
    domElement.addEventListener("pointermove", kick);
    domElement.addEventListener("pointerdown", kick);
    domElement.addEventListener("wheel", kick, { passive: true });
    window.addEventListener("pointerup", kick);
    return () => {
      domElement.removeEventListener("pointermove", kick);
      domElement.removeEventListener("pointerdown", kick);
      domElement.removeEventListener("wheel", kick);
      window.removeEventListener("pointerup", kick);
    };
  }, [domElement, invalidate]);

  return null;
};

const SceneLoader = () => (
  <Html center>
    <span className={`${microLabel} text-muted-foreground`}>Loading asset…</span>
  </Html>
);

interface VisualiserCanvasProps {
  onInitialReady?: () => void;
  isEditable?: boolean;
  objects: PlacedObject[];
  selectedId: string | null;
  orbitEnabled: boolean;
  hasBackdrop: boolean;
  defaultLuxuryBackdrop?: boolean;
  /** Surface of the three-slab architectural backdrop wall (default travertine). */
  featureWallFinish?: FeatureWallFinish;
  onSelect: (id: string | null) => void;
  onTransform: (instanceId: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
  onTextureParts?: (instanceId: string, parts: FinishPart[]) => void;
  /** When true, dragged pieces snap to the placement grid. */
  snapToGrid?: boolean;
  /** When true, the faint design-canvas floor grid renders at Y = 0. */
  showGrid?: boolean;
  /** When false, floating name labels and lock badges are unmounted for a clean canvas. */
  showLabels?: boolean;
  /** Filled with a getter returning the floor point the camera is looking at. */
  focusRef?: { current: (() => [number, number] | null) | null };
  /** Subtle background blur focused on the selected piece (or orbit target). */
  depthOfField?: boolean;
  /** Progressive GPU path tracing (offline-quality GI) while the camera is still. */
  pathTrace?: boolean;
  renderCheckpointKey?: string;
  onRenderCheckpoint?: (event: import("@/lib/visualiserRenderCheckpoint").CheckpointEvent) => void;
  frameCaptureRef?: PhotorealFrameCaptureRef;
  onPathTraceSamples?: (n: number) => void;
  pathTraceQuality?: import("@/lib/visualiserPathTracing").PathTraceQuality;
  /** Measure real per-sample cost and adapt resolution/samples to the GPU. */
  pathTraceAdaptive?: boolean;
  onPathTraceAdaptiveChange?: (state: import("@/lib/visualiserAdaptiveSampling").AdaptiveSamplingState) => void;
  /** Blur strength (bokeh scale), 1–10. */
  dofStrength?: number;
  /** When true, DoF focus follows the clicked/selected piece; when false, the view centre. */
  dofFocusSelected?: boolean;
  /** Which HDRI the environment should load: the empty-room EXR or the built-in studio HDRI. */
  environmentSource?: VisualiserEnvironmentSource;
  advancedRendering?: AdvancedRenderingSettings;
  floorFinish?: RoomFloorFinish;
  showRearWall?: boolean;
  /** Wall height percentage of the full cyclorama (20–100). */
  wallHeight?: number;
  ceilingHeight?: CeilingSettings["ceilingHeight"];
  ceilingThickness?: number;
  ceilingOpening?: number;
  /** Floor reflection strength, 0 (matte) – 100 (polished). */
  floorGlare?: number;
  /** Plaster wall colour preset key. */
  wallColor?: RoomWallColor;
  /** Plaster wall finish preset key. */
  wallFinish?: RoomWallFinish;
  /** Hex value used when wallColor is "custom". */
  wallCustomHex?: string | null;
  /** How strongly the plaster finish catches light, 0–100 (100 = the finish as designed). */
  wallFinishIntensity?: number;
  rugColor?: RugColor;
  rugBorderColor?: RugBorderColor;
  rugBorderThicknessMm?: number;
  rugBorderTwistMm?: number;
  rugBorderRoughness?: number;
  rugWeave?: RugWeave;
  rugPile?: number;
  rugLayout?: { width?: number | null; depth?: number | null; offsetX?: number; offsetZ?: number; rotation?: number };
  /** Hide the rug while arranging furniture (default shown). */
  showRug?: boolean;
  /** Seamless studio stage colour (hex) when no room photo is loaded. */
  backdropColor?: string | null;
  /** Stage brightness, 0–100 (50 = the colour as chosen). */
  backdropBrightness?: number;
}

const SelectedPieceFocus = ({ selectedId, enabled, target, objects, range }: { selectedId: string | null; enabled: boolean; target: THREE.Vector3; objects: PlacedObject[]; range: { current: number } }) => {
  useFrame(({ scene, controls, camera }) => {
    range.current = DEFAULT_ARCHITECTURAL_DOF.focusRange;
    const orbit = controls as unknown as { target?: THREE.Vector3 } | null;
    if (!enabled || !selectedObjectFocus(scene, selectedId, target)) {
      if (enabled) {
        const foregroundRange = foregroundFurnitureFocus(scene, camera, objects, target);
        if (foregroundRange !== null) { range.current = foregroundRange; return; }
      }
      if (orbit?.target) target.copy(orbit.target);
      else target.set(0, 0.5, 0);
    }
  }, -1);
  return null;
};

const ShowroomEffects = ({ target, range, strength = 1, depthOfField, hasBackdrop }: { target: THREE.Vector3; range: { current: number }; strength?: number; depthOfField: boolean; hasBackdrop: boolean }) => {
  const effect = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    if (!effect.current) return;
    effect.current.target?.copy(target);
    effect.current.cocMaterial.worldFocusRange = range.current;
  });
  const bokehScale = Math.min(10, Math.max(1, strength));
  return (
    <EffectComposer multisampling={4} enableNormalPass>
      {/* Contact SSAO: tight radius + low bias darkens the crevices where legs/rug meet the floor. */}
      <SSAO blendFunction={BlendFunction.MULTIPLY} samples={24} rings={5} radius={0.07} intensity={hasBackdrop ? 0.9 : SHOWROOM.aoIntensity * 1.6} luminanceInfluence={0.35} bias={0.012} worldDistanceThreshold={30} worldDistanceFalloff={10} worldProximityThreshold={0.25} worldProximityFalloff={0.08} />
      {/* Subtle bloom: only HDR highlights above ~0.9 luminance glow softly. */}
      <Bloom intensity={0.25} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
      {depthOfField ? <DepthOfField ref={effect} target={target} worldFocusRange={DEFAULT_ARCHITECTURAL_DOF.focusRange} bokehScale={bokehScale} height={720} /> : <></>}
      {/* Composer disables renderer tone mapping; apply ACES once after the HDR effects. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
};

/**
 * Heavy WebGL layer. Kept in its own module so React Three Fiber, drei and
 * three.js are code-split out of the main bundle and only fetched when the
 * Visualiser route actually mounts.
 */
const VisualiserCanvas = ({
  onInitialReady,
  isEditable = true,
  objects,
  selectedId,
  orbitEnabled,
  hasBackdrop: hasCustomBackdrop,
  defaultLuxuryBackdrop = false,
  featureWallFinish = "travertine",
  onSelect,
  onTransform,
  onDragStateChange,
  onTextureParts,
  snapToGrid = false,
  showGrid = true,
  showLabels = true,
  focusRef,
  depthOfField = true,
  pathTrace = false,
  renderCheckpointKey,
  onRenderCheckpoint,
  frameCaptureRef,
  onPathTraceSamples,
  pathTraceQuality,
  pathTraceAdaptive = false,
  onPathTraceAdaptiveChange,
  dofStrength = 1,
  dofFocusSelected = true,
  environmentSource = "empty-room-exr",
  advancedRendering = DEFAULT_ADVANCED_RENDERING,
  floorFinish = "oak-chevron",
  showRearWall = true,
  wallHeight = 100,
  ceilingHeight, ceilingThickness, ceilingOpening,
  floorGlare = 50,
  wallColor = "warm-white",
  wallFinish = "matte",
  wallCustomHex = null,
  wallFinishIntensity = 100,
  rugColor = "cream",
  rugBorderColor = "match",
  rugBorderThicknessMm,
  rugBorderTwistMm,
  rugBorderRoughness,
  rugWeave = "loop",
  rugPile = 50,
  rugLayout,
  showRug = true,
  backdropColor = null,
  backdropBrightness = 50,
}: VisualiserCanvasProps) => {
  const showLuxuryBackdrop = defaultLuxuryBackdrop && !hasCustomBackdrop;
  const hasBackdrop = hasCustomBackdrop || showLuxuryBackdrop;
  const center: [number, number, number] = objects.length ? objects.reduce<[number, number, number]>((sum, object) => [sum[0] + object.position[0] / objects.length, sum[1] + object.position[1] / objects.length, sum[2] + object.position[2] / objects.length], [0, 0, 0]) : [0, 0, 0];
  const lighting = advancedSceneLighting(advancedRendering, pathTraceQuality?.lightIntensity ?? 1);
  const dofTarget = useRef(new THREE.Vector3(0, 0.5, 0));
  const dofRange = useRef<number>(DEFAULT_ARCHITECTURAL_DOF.focusRange);
  const [roomReady, setRoomReady] = useState(false);
  const [objectsReady, setObjectsReady] = useState(false);
  const [environmentReady, setEnvironmentReady] = useState(false);
  const environmentLoaded = useRef(() => setEnvironmentReady(true)).current;
  return (
  <Canvas
    shadows={{ type: THREE.PCFShadowMap }}
    frameloop="demand"
    gl={{
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: SHOWROOM.exposure,
      outputColorSpace: THREE.SRGBColorSpace,
    }}
    dpr={Math.min(window.devicePixelRatio, 2)}
    onCreated={({ gl }) => {
      RectAreaLightUniformsLib.init();
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = SHOWROOM.exposure;
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFShadowMap;
    }}
    onPointerMissed={() => onSelect(null)}
  >
    {onInitialReady && <InitialRoomReveal ready={roomReady && objectsReady && environmentReady} modelCount={objects.filter((object) => Boolean(object.glb_url)).length} onReady={onInitialReady} />}
    <RenderOnDemand
      signature={`lighting:${JSON.stringify(advancedRendering)}:${lighting.lightScale}|environment:${environmentSource}|${floorFinish}|${showRearWall}|${wallHeight}|${ceilingHeight}|${ceilingThickness}|${ceilingOpening}|${floorGlare}|${wallColor}|${wallCustomHex ?? ""}|${wallFinish}|${wallFinishIntensity}|${featureWallFinish}|${rugColor}|${rugBorderColor}|${rugBorderThicknessMm}|${rugBorderTwistMm}|${rugBorderRoughness}|${rugWeave}|${rugPile}|${JSON.stringify(rugLayout)}|${showRug ? "rug" : "no-rug"}|${backdropColor ?? ""}|${backdropBrightness}|${selectedId ?? ""}|${hasBackdrop}|${orbitEnabled}|${showGrid}|${showLabels}|${depthOfField}|${dofStrength}|${dofFocusSelected}|${objects
        .map(
          (o) =>
            `${o.instanceId}:${o.position?.join(",")}:${o.rotation?.join(",")}:${o.scale}:${o.modelOrientation?.join(",")}` +
            `:${o.material?.id ?? ""}:${o.topMaterial?.id ?? ""}:${o.baseMaterial?.id ?? ""}:${o.upholsteryMaterial?.id ?? ""}:${JSON.stringify(o.partMaterials ?? {})}:${JSON.stringify(o.marbleSurface ?? {})}:${o.positionLocked ?? false}`,
        )
        .join("|")}`}
    />
    {focusRef && <FloorFocusReporter focusRef={focusRef} />}
    <SelectedPieceFocus selectedId={selectedId} enabled={depthOfField && dofFocusSelected} target={dofTarget.current} objects={objects} range={dofRange} />
    {/* A level, dollied-back camera preserves parallel architectural verticals. */}
    <PerspectiveCamera makeDefault fov={SHOWROOM.cameraFov} position={showLuxuryBackdrop ? LUXURY_BACKDROP.cameraPosition : SHOWROOM.cameraPosition} up={[0, 1, 0]} near={0.1} far={200} onUpdate={(camera) => { if (showLuxuryBackdrop) camera.lookAt(...LUXURY_BACKDROP.cameraTarget); }} />
    <OrbitControls
      makeDefault
      enabled={orbitEnabled}
      enablePan={!showLuxuryBackdrop}
      screenSpacePanning
      enableDamping={false}
      minDistance={1.5}
      maxDistance={24}
      minPolarAngle={showLuxuryBackdrop ? LUXURY_BACKDROP.minPolarAngle : SHOWROOM.cameraPolarAngle}
      maxPolarAngle={showLuxuryBackdrop ? LUXURY_BACKDROP.maxPolarAngle : SHOWROOM.cameraPolarAngle}
      minAzimuthAngle={showLuxuryBackdrop ? LUXURY_BACKDROP.minAzimuthAngle : -Infinity}
      maxAzimuthAngle={showLuxuryBackdrop ? LUXURY_BACKDROP.maxAzimuthAngle : Infinity}
      target={showLuxuryBackdrop ? LUXURY_BACKDROP.cameraTarget : SHOWROOM.cameraTarget}
    />

    {/* Ambient comes from the architectural interior HDR (StudioEnvironment), not a flat global light. */}
    {!hasBackdrop && <ArchitecturalDownlights lightScale={lighting.lightScale} />}
    {showLuxuryBackdrop && <ambientLight intensity={SHOWROOM.ambient * lighting.lightScale} />}
    {/* Key: soft window light, front-left, casts the shadows. */}
    <directionalLight
      position={showLuxuryBackdrop ? windowLightPosition(center) : [-6, 9, 6]}
      intensity={lighting.directionalIntensity}
      color={SHOWROOM.key}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={40}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
      shadow-bias={lighting.shadowBias * 0.4}
      shadow-normalBias={lighting.shadowNormalBias * 0.4}
      shadow-radius={lighting.shadowRadius}
    />
    {/* Fill: opposite side, low and cool. */}
    <directionalLight position={[7, 4, 4]} intensity={lighting.fillIntensity} color={SHOWROOM.fill} />
    {/* Rim: behind the pieces to lift silhouettes. */}
    <directionalLight position={[0, 6, -9]} intensity={0.6 * lighting.lightScale} color={SHOWROOM.rim} />

    {/* Local IBL: metals need reflections or they render solid black. Toolbar-switchable HDRI. */}
    {/* Photoreal: no solid grey void — escaping rays must hit the emissive HDRI. */}
    {!hasBackdrop && !pathTrace && <color attach="background" args={[backdropStageColor(backdropColor, backdropBrightness)]} />}
    <StudioEnvironment preferred={environmentSource} pathTrace={pathTrace && !hasBackdrop} lightIntensity={lighting.lightScale} onReady={environmentLoaded} />

    <Suspense fallback={null}>
      {showLuxuryBackdrop && <LuxuryBackdrop />}
      {/* Both renderers retain the designed architecture; only room photos suppress it. */}
      {!hasBackdrop && <ArchitecturalFeatureWall finish={featureWallFinish} />}
      <RoomSurfaces floor={hasBackdrop ? "none" : floorFinish} rearWall={hasBackdrop ? false : showRearWall} objects={objects} glare={floorGlare} wallHeight={wallHeight} ceilingHeight={ceilingHeight} ceilingThickness={ceilingThickness} ceilingOpening={ceilingOpening} wallColor={wallColor} wallFinish={wallFinish} wallCustomHex={wallCustomHex} wallFinishIntensity={wallFinishIntensity} rugColor={rugColor} rugBorderColor={rugBorderColor} rugBorderThicknessMm={rugBorderThicknessMm} rugBorderTwistMm={rugBorderTwistMm} rugBorderRoughness={rugBorderRoughness} rugWeave={rugWeave} rugPile={rugPile} rugLayout={rugLayout} showRug={showRug && !hasBackdrop} />
      <InitialAssetsCommitted onReady={setRoomReady} />
    </Suspense>
    {!pathTrace && !hasBackdrop && floorFinish === "none" && (
      <ContactShadows
        position={[0, 0.002, 0]}
        scale={40}
        opacity={lighting.contactOpacity * (0.45 / SHOWROOM.contactOpacity)}
        blur={lighting.contactBlur * (2.6 / 1.5)}
        far={4}
        resolution={1024}
        depthWrite={false}
      />
    )}
    {/* Grounding shadows where legs/bases meet the room floor — stops pieces floating on the wood. */}
    {/* Raised just above the flat rug's surface so shadows land on the rug fibers;
        when the rug is hidden they drop back onto the floor itself. */}
    {!pathTrace && !hasBackdrop && floorFinish !== "none" && (
      <ContactShadows
        position={[0, (showRug ? RUG_TOP_Y : 0) + 0.002, 0]}
        scale={15}
        opacity={lighting.contactOpacity}
        blur={lighting.contactBlur * 0.6}
        far={1}
        resolution={2048}
        color="#2b2015"
        depthWrite={false}
      />
    )}
    {/* Faint floor grid at Y = 0 — the design-canvas ground reference. Hideable for room-photo backdrops. */}
    {!pathTrace && showLuxuryBackdrop && <ContactShadows position={[center[0], 0.002, center[2]]} opacity={LUXURY_BACKDROP.contactOpacity} blur={LUXURY_BACKDROP.contactBlur} scale={LUXURY_BACKDROP.contactScale} far={1.5} resolution={1024} depthWrite={false} />}
    {showGrid && !showLuxuryBackdrop && (
      <Grid
        position={[0, 0.001, 0]}
        infiniteGrid
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#E5E7EB"
        sectionSize={1}
        sectionThickness={0.8}
        sectionColor="#D1D5DB"
        fadeDistance={30}
        fadeStrength={1.5}
        followCamera={false}
      />
    )}
    {/* Invisible shadow-catcher floor: lets the backdrop's own flooring read through the shadows. */}
    {!showLuxuryBackdrop && (hasBackdrop || floorFinish === "none") && <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[80, 80]} />
      <shadowMaterial transparent opacity={0.28} />
    </mesh>}

    <Suspense fallback={<SceneLoader />}>
      {objects.map((object) => (
        <SceneObject
          key={`${object.instanceId}:${object.restoreKey ?? 0}`}
          object={object}
          isEditable={isEditable}
          selected={object.instanceId === selectedId}
          onSelect={onSelect}
          onTransform={onTransform}
          onDragStateChange={onDragStateChange}
          onTextureParts={onTextureParts}
          snapToGrid={snapToGrid}
          showLabels={showLabels}
          selfRadius={footprintRadius(parseDimensionString(object.dimensions), object.scale)}
          obstacles={objects
            .filter((other) => other.instanceId !== object.instanceId)
            .map((other) => ({
              position: other.position,
              radius: footprintRadius(parseDimensionString(other.dimensions), other.scale),
            }))}
        />
      ))}
      <InitialAssetsCommitted onReady={setObjectsReady} />
    </Suspense>
    {pathTrace && (
      <PathTracerLayer
        checkpointKey={renderCheckpointKey}
        onCheckpoint={onRenderCheckpoint}
        frameCaptureRef={frameCaptureRef}
        onSamples={onPathTraceSamples}
        quality={pathTraceQuality}
        adaptive={pathTraceAdaptive}
        onAdaptiveChange={onPathTraceAdaptiveChange}
        depthOfField={depthOfField}
        focusTarget={dofTarget.current}
        dofStrength={dofStrength}
        signature={`${depthOfField}|${dofStrength}|${dofFocusSelected}|${dofFocusSelected ? selectedId : ""}|${showRearWall}|${wallHeight}|${ceilingHeight}|${ceilingThickness}|${ceilingOpening}|${wallColor}|${wallCustomHex}|${wallFinish}|${wallFinishIntensity}|${JSON.stringify(advancedRendering)}|light:${lighting.lightScale}|${environmentSource}|${hasBackdrop}|${floorFinish}|${featureWallFinish}|${floorGlare}|${rugColor}|${rugBorderColor}|${rugBorderThicknessMm}|${rugBorderTwistMm}|${rugBorderRoughness}|${rugWeave}|${rugPile}|${JSON.stringify(rugLayout)}|${showRug}|${backdropColor ?? ""}|${backdropBrightness}|${objects
          .map((o) => `${o.instanceId}:${o.glb_url}:${o.position?.join(",")}:${o.rotation?.join(",")}:${o.scale}:${o.modelOrientation?.join(",")}:${o.material?.id ?? ""}:${o.topMaterial?.id ?? ""}:${o.baseMaterial?.id ?? ""}:${o.upholsteryMaterial?.id ?? ""}:${JSON.stringify(o.partMaterials ?? {})}:${JSON.stringify(o.marbleSurface ?? {})}`)
          .join("|")}`}
      />
    )}
    {!pathTrace && <ShowroomEffects
        depthOfField={depthOfField}
        hasBackdrop={hasBackdrop}
        strength={dofStrength}
        target={dofTarget.current}
        range={dofRange}
      />}
  </Canvas>
  );
};

export default VisualiserCanvas;
