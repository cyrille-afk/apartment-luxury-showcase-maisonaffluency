import { Suspense, useMemo, type ReactNode } from "react";
import { Html } from "@react-three/drei";
import SceneObject, { type PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { AICuratedSceneSchema, ArchitecturalAnchor, Vec3 } from "@/types/aiCuratedScene";

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
  /** Runs only after all furniture has loaded. */
  children?: ReactNode;
}

const instanceIdFor = (index: number, sku: string) => `ai-${index}-${sku}`;

/** Renders an AICuratedSceneSchema inside an R3F <Canvas>: room shell, anchors and editable assets. */
const AICuratedEnvironment = ({ schema, selectedId, onSelect, onAssetTransform, onDragStateChange, isEditable = true, children }: Props) => {
  const { width: W, length: L, height: H } = schema.roomDimensions;

  const objects = useMemo<PlacedObject[]>(
    () =>
      schema.curatedAssets.map((a, i) => ({
        instanceId: instanceIdFor(i, a.sku),
        id: a.componentId,
        product_name: a.sku,
        brand_name: "",
        image_url: null,
        dimensions: null,
        glb_url: a.glbUrl,
        position: a.position,
        rotation: a.rotation,
        scale: 1,
      })),
    [schema.curatedAssets],
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

      <Suspense fallback={<Html center><span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Loading assets…</span></Html>}>
        {schema.curatedAssets.map((asset, i) => (
          <group key={instanceIdFor(i, asset.sku)} name={`camera-piece-${instanceIdFor(i, asset.sku)}`}>
          <SceneObject
            key={instanceIdFor(i, asset.sku)}
            object={objects[i]}
            scaleVector={asset.scale}
            isEditable={isEditable}
            selected={selectedId === instanceIdFor(i, asset.sku)}
            onSelect={onSelect}
            onTransform={(_id, position, rotation) => onAssetTransform(i, position, rotation)}
            onDragStateChange={onDragStateChange}
          />
          </group>
        ))}
        {children}
      </Suspense>
    </group>
  );
};

export default AICuratedEnvironment;
