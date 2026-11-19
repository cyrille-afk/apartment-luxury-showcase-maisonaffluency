import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { ACESFilmicToneMapping, Box3, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { createProceduralSurface } from "@/lib/visualiserProceduralSurfaces";
import { Button } from "@/components/ui/button";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import SceneObject, { type PlacedObject } from "./SceneObject";
import SequentialFurniture, { type FurnitureLoadingProgress } from "./SequentialFurniture";
import { viewingRoomCamera, viewingRoomComposition, type ViewingRoomItem, type ViewingRoomCameraPreset } from "@/lib/viewingRoom";
import { withCachedModelLoader } from "@/lib/visualiserModelCache";
import VisualiserHotspots from "./VisualiserHotspots";
import type { ModelDimensionCheck } from "@/lib/viewingRoomDimensionCheck";

const noop = () => {};
function CameraView({ view, width, depth }: { view: ViewingRoomCameraPreset; width: number; depth: number }) {
  const { camera, invalidate, size } = useThree();
  const controls = useThree(state => state.controls) as OrbitControlsImpl | null;
  const destination = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  useEffect(() => {
    const pose = viewingRoomCamera(view, width, depth, size.width / size.height);
    destination.current = { position: new Vector3(...pose.position), target: new Vector3(...pose.target) };
    invalidate();
  }, [camera, controls, view, width, depth, size.width, size.height, invalidate]);
  useFrame((_, delta) => {
    const pose = destination.current;
    if (!controls) return;
    if (!pose) return;
    const alpha = 1 - Math.exp(-7 * Math.min(delta, .05));
    camera.position.lerp(pose.position, alpha); controls.target.lerp(pose.target, alpha); controls.update();
    if (camera.position.distanceTo(pose.position) < .015 && controls.target.distanceTo(pose.target) < .015) destination.current = null;
    else invalidate();
  });
  return null;
}
function ReadyFrame({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => { if (ready && !done.current) { done.current = true; requestAnimationFrame(onReady); } });
  return null;
}
function EnvironmentModel({ url, onReady }: { url: string; onReady: () => void }) {
  const { scene } = useGLTF(url, "/draco/", undefined, withCachedModelLoader);
  const clone = useMemo(() => {
    const result = scene.clone(true);
    const box = new Box3().setFromObject(result), center = box.getCenter(new Vector3());
    result.position.set(-center.x, -box.min.y, -center.z);
    return result;
  }, [scene]);
  useEffect(onReady, [onReady]);
  return <primitive object={clone} />;
}
function RoomSurfaces({ width, depth }: { width: number; depth: number }) {
  const floor = useMemo(() => createProceduralSurface("oak-chevron"), []);
  const wall = useMemo(() => createProceduralSurface("travertine"), []);
  useEffect(() => {
    for (const map of [floor.color, floor.bump, floor.roughness]) map?.repeat.set((width + 12) / 1.02, (depth + 24) / 1.02);
    for (const map of [wall.color, wall.bump, wall.roughness]) map?.repeat.set(width / 4, 1);
    return () => { for (const surface of [floor, wall]) for (const map of [surface.color, surface.bump, surface.roughness]) map?.dispose(); };
  }, [floor, wall, width, depth]);
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.01, 6]} receiveShadow><planeGeometry args={[width + 12, depth + 24]} /><meshStandardMaterial map={floor.color} bumpMap={floor.bump} bumpScale={.012} roughnessMap={floor.roughness} roughness={.85} /></mesh>
    <mesh position={[0, 4, -depth / 2 - 1]} receiveShadow><boxGeometry args={[width + 10, 8, .15]} /><meshStandardMaterial map={wall.color} bumpMap={wall.bump} bumpScale={.018} roughnessMap={wall.roughness} roughness={.95} /></mesh>
    <mesh position={[width / 2 + 3, 1.8, -2]} receiveShadow><boxGeometry args={[.15, 3.6, depth + 4]} /><meshStandardMaterial map={wall.color} bumpMap={wall.bump} bumpScale={.018} roughness={.95} /></mesh>
  </>;
}
function Placeholder({ object, color }: { object: PlacedObject; color: string }) {
  const width = (object.width_mm || 800) / 1000, depth = (object.depth_mm || 800) / 1000, height = (object.height_mm || 800) / 1000;
  return <group position={object.position} rotation={object.rotation}><mesh position={[0, height / 2, 0]}><boxGeometry args={[width, height, depth]} /><meshBasicMaterial wireframe color={color} transparent opacity={.18} /></mesh></group>;
}
export default function ViewingRoomCanvas({ items, environmentUrl, activeSlotIds = [], onPieceClick }: { items: ViewingRoomItem[]; environmentUrl: string | null; activeSlotIds?: string[]; onPieceClick?: (id: string) => void }) {
  const initialRoom = useRef(viewingRoomComposition(items));
  const room = useMemo(() => {
    const latest = viewingRoomComposition(items);
    return { ...initialRoom.current, objects: latest.objects.map(object => {
      const slot = initialRoom.current.objects.find(row => row.instanceId === object.instanceId);
      return slot ? { ...object, position: slot.position, rotation: slot.rotation, isAnchor: slot.isAnchor } : object;
    }) };
  }, [items]);
  const root = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<{ paper: string; ink: string } | null>(null);
  const [view, setView] = useState<ViewingRoomCameraPreset>("living");
  const [ready, setReady] = useState(false);
  const [furnitureReady, setFurnitureReady] = useState(false);
  const [environmentReady, setEnvironmentReady] = useState(!environmentUrl);
  const [progress, setProgress] = useState<FurnitureLoadingProgress | null>(null);
  const [failed, setFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [dimensionChecks, setDimensionChecks] = useState<Record<string, { url: string; check: ModelDimensionCheck }>>({});
  const reportDimensions = useCallback((id: string, url: string, check: ModelDimensionCheck) => {
    setDimensionChecks(current => ({ ...current, [id]: { url, check } }));
  }, []);
  const flagged = room.objects.filter(object => {
    const result = dimensionChecks[object.instanceId];
    return result?.url === object.glb_url && result.check.status !== "verified";
  });
  useEffect(() => { if (!root.current) return; const css = getComputedStyle(root.current); setColors({ paper: css.backgroundColor, ink: css.color }); }, []);
  const environmentLoaded = useCallback(() => setEnvironmentReady(true), []);
  const frameReady = useCallback(() => setReady(true), []);
  const fail = useCallback(() => setFailed(true), []);
  return <div ref={root} className="viewing-room-canvas relative h-[75vh] min-h-[360px] w-full bg-background text-foreground" data-scene-ready={ready ? "true" : undefined} aria-label="Eye-level room viewer">
    {colors && <SceneErrorBoundary key={epoch} onError={fail}>
      <Canvas shadows frameloop="demand" dpr={[1, 2]} camera={{ position: viewingRoomCamera(view, room.width, room.depth).position, fov: 48, near: .05, far: 150 }} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }} onCreated={({ gl }) => { gl.setClearColor(colors.paper); }}>
        <ambientLight intensity={.4} /><directionalLight position={[3, 6, 4]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-.0002} />
        <Environment resolution={128}><Lightformer position={[0, 5, 0]} rotation-x={Math.PI / 2} intensity={2} scale={[12, 10, 1]} /><Lightformer position={[-6, 2, 0]} rotation-y={Math.PI / 2} intensity={1} scale={[10, 5, 1]} /></Environment>
        {!environmentUrl && <RoomSurfaces width={room.width} depth={room.depth} />}
        {environmentUrl && <Suspense fallback={null}><EnvironmentModel url={environmentUrl} onReady={environmentLoaded} /></Suspense>}
        <SequentialFurniture pieces={room.objects} fallback={null} renderPlaceholder={object => <Placeholder object={object} color={colors.ink} />} onReady={setFurnitureReady} onProgress={setProgress} renderPiece={object => <SceneObject object={object} selected={false} isEditable={false} showLabels={false} onSelect={noop} onTransform={noop} onDragStateChange={noop} onDimensionCheck={reportDimensions} />} />
        <OrbitControls makeDefault minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} minAzimuthAngle={-Math.PI / 2.4} maxAzimuthAngle={Math.PI / 2.4} minDistance={2.5} maxDistance={60} enablePan={false} enableDamping dampingFactor={.08} rotateSpeed={.45} />
        <CameraView view={view} width={Math.max(2.8, room.width - 2)} depth={Math.max(2.5, room.depth - 2)} />
        <EffectComposer multisampling={0}><N8AO aoRadius={.6} intensity={1.2} distanceFalloff={1} quality="low" /><ToneMapping mode={ToneMappingMode.ACES_FILMIC} /></EffectComposer>
        {onPieceClick && <VisualiserHotspots objects={room.objects.filter(object => activeSlotIds.includes(object.instanceId))} onFindAlternatives={onPieceClick} />}
        <ReadyFrame ready={furnitureReady && environmentReady} onReady={frameReady} />
      </Canvas>
    </SceneErrorBoundary>}
    {!ready && !failed && <p role="status" className={`absolute left-4 bg-background/90 px-3 py-2 text-xs text-muted-foreground ${flagged.length ? "bottom-20" : "top-4"}`}>{progress ? `Loading group ${progress.group} of ${progress.groups} · ${progress.remaining} pieces remaining` : "Preparing room…"}</p>}
    {flagged.length > 0 && <div role="alert" className="absolute right-4 top-4 z-20 max-h-48 w-72 max-w-[calc(100%-2rem)] overflow-y-auto border border-border bg-background/95 p-3 text-xs text-foreground" data-visualiser-hotspot-obstacle>
      <p className="mb-2 font-medium">Furniture dimension checks</p>
      {flagged.map(object => <p key={object.instanceId} className="mb-2 break-words">{object.product_name}: {dimensionChecks[object.instanceId]?.check.status === "unconfirmed" ? "dimensions not recorded; scale unconfirmed." : "unexpected model dimensions; model withheld."}</p>)}
    </div>}
    {failed && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background"><p>The room couldn’t load. Your selection is unchanged.</p><Button variant="outline" onClick={() => { setFailed(false); setReady(false); setFurnitureReady(false); setEnvironmentReady(!environmentUrl); setEpoch(value => value + 1); }}>Retry room view</Button></div>}
    <div className="absolute inset-x-2 bottom-4 z-[35] flex justify-center gap-1 sm:gap-2" data-visualiser-hotspot-obstacle>{([["living", "Living Room"], ["terrace", "Lounge Corner"], ["overview", "Overview"]] as const).map(([preset, label]) => <Button key={preset} variant="outline" className={`rounded-full bg-background px-3 text-xs text-foreground sm:text-sm ${view === preset ? "border-foreground" : ""}`} aria-pressed={view === preset} onClick={() => setView(preset)}>{label}</Button>)}</div>
  </div>;
}