import { Suspense, useMemo, useState, useLayoutEffect, type ReactNode } from "react";
import SceneObject, { type PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { AICuratedSceneSchema, ArchitecturalAnchor, Vec3 } from "@/types/aiCuratedScene";
import { curatedDimensions } from "@/lib/curatedLayoutDimensions";

const ANCHOR_COLOR: Record<ArchitecturalAnchor["type"], string> = {
  window: "#bcd3dc",
  door: "#8a7a66",
  wall_opening: "#d9d2c5",
};

interface Props {
  schema: AICuratedSceneSchema;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Index-addressed so edits flow back into the schema. */
  onAssetTransform: (index: number, position: Vec3, rotation: Vec3) => void;
  onDragStateChange: (dragging: boolean) => void;
  /** False for read-only client links. */
  isEditable?: boolean;
  /** Catalogue names in studio view, frozen public names in shared view. */
  pieceNames?: ReadonlyMap<string, string>;
  showLabels?: boolean;
  /** Runs only after all furniture has loaded. */
  children?: ReactNode;
}

const instanceIdFor = (index: number, sku: string) => `ai-${index}-${sku}`;

function PieceModel({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  // Keep the visible volume outside React's hidden Suspense tree: Drei Html owns
  // a DOM portal and must not be re-parented as the model resolves.
  const [ready, setReady] = useState(false);
  return <>{!ready && fallback}<Suspense fallback={null}>{children}<ModelReady onReady={setReady} /></Suspense></>;
}

function ModelReady({ onReady }: { onReady: (ready: boolean) => void }) {
  // Layout effects only run once this Suspense subtree commits.
  useLayoutEffect(() => { onReady(true); }, [onReady]);
  return null;
}

/** Renders an AICuratedSceneSchema inside an R3F <Canvas>: room shell, anchors and editable assets. */
const AICuratedEnvironment = ({ schema, selectedId, onSelect, onAssetTransform, onDragStateChange, isEditable = true, pieceNames, showLabels = false, children }: Props) => {
  const { width: W, length: L, height: H } = schema.roomDimensions;

  const objects = useMemo<PlacedObject[]>(
    () =>
      schema.curatedAssets.map((a, i) => ({
        instanceId: instanceIdFor(i, a.sku),
        id: a.componentId,
        product_name: pieceNames?.get(a.componentId) ?? a.sku,
        exactDimensionsM: curatedDimensions(a),
        brand_name: "",
        image_url: null,
        dimensions: null,
        width_mm: curatedDimensions(a).w * 1000,
        depth_mm: curatedDimensions(a).d * 1000,
        height_mm: curatedDimensions(a).h * 1000,
        glb_url: a.glbUrl,
        position: a.position,
        rotation: a.rotation,
        scale: 1,
        ...(a.appearance as Partial<PlacedObject> | undefined),
      })),
    [schema.curatedAssets, pieceNames],
  );

  return (
    <group name="curated-room">
      {/* Room shell: floor + two back walls, so the camera can see in. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial color="#e9e3d8" roughness={0.9} />
      </mesh>
      <mesh position={[0, H / 2, -L / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#f3efe8" roughness={1} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[L, H]} />
        <meshStandardMaterial color="#efeae2" roughness={1} />
      </mesh>

      {schema.architecturalAnchors.map((a, i) => (
        <mesh key={`${a.type}-${i}`} position={a.position} rotation={a.rotation} scale={a.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={ANCHOR_COLOR[a.type]} transparent opacity={a.type === "window" ? 0.55 : 0.85} />
        </mesh>
      ))}

      <Suspense fallback={null}>
        {schema.curatedAssets.map((asset, i) => (
          <group key={instanceIdFor(i, asset.sku)} name={`camera-piece-${instanceIdFor(i, asset.sku)}`}>
          {asset.glbUrl ? <PieceModel fallback={<ArchitecturalVolume asset={asset} name={pieceNames?.get(asset.componentId) ?? asset.sku} selected={selectedId === instanceIdFor(i, asset.sku)} onSelect={() => onSelect(instanceIdFor(i, asset.sku))} />}><SceneObject
            key={instanceIdFor(i, asset.sku)}
            object={objects[i]}
            scaleVector={asset.scale}
            label={pieceNames?.get(asset.componentId) ?? asset.sku}
            showLabels={showLabels}
            isEditable={isEditable}
            selected={selectedId === instanceIdFor(i, asset.sku)}
            onSelect={onSelect}
            onTransform={(_id, position, rotation) => onAssetTransform(i, position, rotation)}
            onDragStateChange={onDragStateChange}
          /></PieceModel> : <ArchitecturalVolume asset={asset} name={pieceNames?.get(asset.componentId) ?? asset.sku} selected={selectedId === instanceIdFor(i, asset.sku)} onSelect={() => onSelect(instanceIdFor(i, asset.sku))} />}
          </group>
        ))}
        {children}
      </Suspense>
    </group>
  );
};

export default AICuratedEnvironment;

/** Dimensioned, selectable massing stays visible even without a catalogue GLB. */
function ArchitecturalVolume({ asset, name, selected, onSelect }: { asset: AICuratedSceneSchema["curatedAssets"][number]; name: string; selected: boolean; onSelect: () => void }) {
  const size = curatedDimensions({ ...asset, name });
  return <group position={[asset.position[0], 0, asset.position[2]]} rotation={asset.rotation} scale={asset.scale}>
    <mesh position={[0, size.h / 2, 0]} castShadow receiveShadow onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <boxGeometry args={[size.w, size.h, size.d]} />
      <meshStandardMaterial color={ANCHOR_COLOR[selected ? "window" : "door"]} roughness={0.85} />
    </mesh>
  </group>;
}
