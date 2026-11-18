import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { ACESFilmicToneMapping, Box3, CanvasTexture, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import SceneObject, { type PlacedObject } from "./SceneObject";
import SequentialFurniture, { type FurnitureLoadingProgress } from "./SequentialFurniture";
import { viewingRoomCamera, viewingRoomComposition, type ViewingRoomItem } from "@/lib/viewingRoom";
import { withCachedModelLoader } from "@/lib/visualiserModelCache";
import VisualiserHotspots from "./VisualiserHotspots";
import type { ModelDimensionCheck } from "@/lib/viewingRoomDimensionCheck";

const noop = () => {};
function CameraView({ view, width, depth }: { view: "living" | "terrace"; width: number; depth: number }) {
  const { camera, invalidate } = useThree();
  const controls = useThree(state => state.controls) as OrbitControlsImpl | null;
  useEffect(() => {
    const pose = viewingRoomCamera(view, width, depth);
    camera.position.set(...pose.position); camera.lookAt(...pose.target);
    controls?.target.set(...pose.target); controls?.update(); invalidate();
  }, [camera, controls, view, width, depth, invalidate]);
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
function Floor({ width, depth, ink, paper }: { width: number; depth: number; ink: string; paper: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context) { context.fillStyle = paper; context.fillRect(0, 0, 256, 256); context.strokeStyle = ink; context.globalAlpha = .08; for (let x = 0; x < 256; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 256); context.stroke(); } for (let y = 0; y < 256; y += 64) { context.beginPath(); context.moveTo(0, y); context.lineTo(256, y); context.stroke(); } }
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.wrapS = map.wrapT = RepeatWrapping; map.repeat.set(width / 2, depth / 2); return map;
  }, [width, depth, ink, paper]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width + 4, depth + 4]} /><meshStandardMaterial map={texture} roughness={.82} /></mesh>;
}
function Placeholder({ object, color }: { object: PlacedObject; color: string }) {
  const width = (object.width_mm || 800) / 1000, depth = (object.depth_mm || 800) / 1000, height = (object.height_mm || 800) / 1000;
  return <group position={object.position} rotation={object.rotation}><mesh position={[0, height / 2, 0]}><boxGeometry args={[width, height, depth]} /><meshBasicMaterial wireframe color={color} transparent opacity={.18} /></mesh></group>;
}
export default function ViewingRoomCanvas({ items, environmentUrl, onPieceClick }: { items: ViewingRoomItem[]; environmentUrl: string | null; onPieceClick?: (id: string) => void }) {
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
  const [view, setView] = useState<"living" | "terrace">("living");
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
  return <div ref={root} className="viewing-room-canvas relative h-[65dvh] min-h-[420px] w-full bg-background text-foreground" data-scene-ready={ready ? "true" : undefined} aria-label="Eye-level room viewer">
    {colors && <SceneErrorBoundary key={epoch} onError={fail}>
      <Canvas shadows frameloop="demand" dpr={[1, 2]} camera={{ position: viewingRoomCamera(view, room.width, room.depth).position, fov: 48, near: .05, far: 150 }} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }} onCreated={({ gl }) => { gl.setClearColor(colors.paper); }}>
        <ambientLight intensity={.4} /><directionalLight position={[3, 6, 4]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-.0002} />
        <Environment resolution={128}><Lightformer position={[0, 5, 0]} rotation-x={Math.PI / 2} intensity={2} scale={[12, 10, 1]} /><Lightformer position={[-6, 2, 0]} rotation-y={Math.PI / 2} intensity={1} scale={[10, 5, 1]} /></Environment>
        {!environmentUrl && <>
          <Floor width={room.width} depth={room.depth} paper={colors.paper} ink={colors.ink} />
          <mesh position={[room.width / 2 + 1, 1.6, 0]}><boxGeometry args={[.15, 3.2, room.depth + 4]} /><meshStandardMaterial color={colors.paper} roughness={.9} /></mesh>
          <mesh position={[0, 1.6, -room.depth / 2 - 1]}><boxGeometry args={[room.width + 2, 3.2, .15]} /><meshStandardMaterial color={colors.paper} roughness={.9} /></mesh>
          <mesh position={[0, 3.25, 0]}><boxGeometry args={[room.width + 4, .1, room.depth + 4]} /><meshStandardMaterial color={colors.paper} roughness={.9} /></mesh>
        </>}
        {environmentUrl && <Suspense fallback={null}><EnvironmentModel url={environmentUrl} onReady={environmentLoaded} /></Suspense>}
        <SequentialFurniture pieces={room.objects} fallback={null} renderPlaceholder={object => <Placeholder object={object} color={colors.ink} />} onReady={setFurnitureReady} onProgress={setProgress} renderPiece={object => <SceneObject object={object} selected={false} isEditable={false} showLabels={false} onSelect={noop} onTransform={noop} onDragStateChange={noop} onDimensionCheck={reportDimensions} />} />
        <OrbitControls makeDefault minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} minDistance={.6} maxDistance={16} enablePan={false} enableDamping={false} />
        <CameraView view={view} width={room.width} depth={room.depth} />
        {ready && onPieceClick && <VisualiserHotspots objects={room.objects} onFindAlternatives={onPieceClick} />}
        <ReadyFrame ready={furnitureReady && environmentReady} onReady={frameReady} />
      </Canvas>
    </SceneErrorBoundary>}
    {!ready && !failed && <p role="status" className={`absolute left-4 bg-background/90 px-3 py-2 text-xs text-muted-foreground ${flagged.length ? "bottom-20" : "top-4"}`}>{progress ? `Loading group ${progress.group} of ${progress.groups} · ${progress.remaining} pieces remaining` : "Preparing room…"}</p>}
    {flagged.length > 0 && <div role="alert" className="absolute right-4 top-4 z-20 max-h-48 w-72 max-w-[calc(100%-2rem)] overflow-y-auto border border-border bg-background/95 p-3 text-xs text-foreground" data-visualiser-hotspot-obstacle>
      <p className="mb-2 font-medium">Furniture dimension checks</p>
      {flagged.map(object => <p key={object.instanceId} className="mb-2 break-words">{object.product_name}: {dimensionChecks[object.instanceId]?.check.status === "unconfirmed" ? "dimensions not recorded; scale unconfirmed." : "unexpected model dimensions; model withheld."}</p>)}
    </div>}
    {ready && !environmentUrl && !flagged.length && <p className="absolute left-4 top-4 bg-background/90 px-3 py-2 text-xs text-muted-foreground">Concept room · apartment model pending</p>}
    {failed && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background"><p>The room couldn’t load. Your selection is unchanged.</p><Button variant="outline" onClick={() => { setFailed(false); setReady(false); setFurnitureReady(false); setEnvironmentReady(!environmentUrl); setEpoch(value => value + 1); }}>Retry room view</Button></div>}
    <div className="absolute inset-x-4 bottom-5 flex justify-center gap-2"><Button variant="outline" className={`rounded-full bg-background text-foreground ${view === "living" ? "border-foreground" : ""}`} aria-pressed={view === "living"} onClick={() => setView("living")}>Living View</Button><Button variant="outline" className={`rounded-full bg-background text-foreground ${view === "terrace" ? "border-foreground" : ""}`} aria-pressed={view === "terrace"} onClick={() => setView("terrace")}>Terrace View</Button></div>
  </div>;
}