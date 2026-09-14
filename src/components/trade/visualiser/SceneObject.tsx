import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useTexture, TransformControls } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

export type PlacedObject = {
  instanceId: string;
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  dimensions: string | null;
  glb_url: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  material?: VisualiserMaterial | null;
};

type Props = {
  object: PlacedObject;
  selected: boolean;
  onSelect: (instanceId: string) => void;
  onTransform: (instanceId: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
};

/** Normalises any GLB to roughly 1.4m tall and seats it on the floor plane. */
function useFittedModel(url: string, material: VisualiserMaterial | null) {
  const { scene } = useGLTF(url);
  const texture = useTexture(material?.image_url || "/placeholder.svg");
  return useMemo(() => {
    const clone = scene.clone(true);
    const category = `${material?.category ?? ""} ${material?.material_type ?? ""}`.toLowerCase();
    const isMetal = /metal|brass|bronze|steel|aluminium|aluminum|chrome/.test(category);
    const isFabric = /fabric|textile|upholstery|leather|wool|linen|velvet/.test(category);
    const isGlass = /glass|crystal/.test(category);
    const colorMap = material?.image_url ? texture.clone() : null;
    const roughnessMap = material?.image_url && !isGlass ? texture.clone() : null;
    const metalnessMap = material?.image_url && isMetal ? texture.clone() : null;
    const neutralNormalMap = material?.image_url
      ? new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat)
      : null;
    if (colorMap) {
      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
      colorMap.repeat.set(isFabric ? 5 : 3, isFabric ? 5 : 3);
      colorMap.needsUpdate = true;
    }
    if (roughnessMap) {
      roughnessMap.colorSpace = THREE.NoColorSpace;
      roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
      roughnessMap.repeat.copy(colorMap?.repeat ?? new THREE.Vector2(3, 3));
      roughnessMap.needsUpdate = true;
    }
    if (metalnessMap) {
      metalnessMap.colorSpace = THREE.NoColorSpace;
      metalnessMap.wrapS = metalnessMap.wrapT = THREE.RepeatWrapping;
      metalnessMap.repeat.copy(colorMap?.repeat ?? new THREE.Vector2(3, 3));
      metalnessMap.needsUpdate = true;
    }
    if (neutralNormalMap) neutralNormalMap.needsUpdate = true;
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (material) {
          const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const next = source.map((entry) => {
            const pbr = (entry as THREE.MeshStandardMaterial).clone();
            pbr.map = colorMap;
            pbr.roughnessMap = roughnessMap;
            pbr.metalnessMap = metalnessMap;
            pbr.normalMap = neutralNormalMap;
            pbr.color.set(THREE.Color.NAMES.white);
            pbr.roughness = isMetal ? 0.28 : isGlass ? 0.12 : isFabric ? 0.92 : 0.68;
            pbr.metalness = isMetal ? 0.78 : 0;
            pbr.normalScale = new THREE.Vector2(isFabric ? 0.18 : 0.08, isFabric ? 0.18 : 0.08);
            pbr.needsUpdate = true;
            return pbr;
          });
          mesh.material = Array.isArray(mesh.material) ? next : next[0];
        }
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const largest = Math.max(size.x, size.y, size.z) || 1;
    const fit = 1.4 / largest;
    clone.scale.setScalar(fit);
    const fitted = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    clone.position.set(-center.x, -fitted.min.y, -center.z);
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [material, scene, texture]);
}

const ModelBody = ({ url, material }: { url: string; material: VisualiserMaterial | null }) => {
  const model = useFittedModel(url, material);
  return <primitive object={model} />;
};

const ImageBody = ({ url, name }: { url: string; name: string }) => {
  const texture = useTexture(url);
  const image = texture.image as { width?: number; height?: number } | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 1;
  const height = 1.2;
  return (
    <mesh castShadow receiveShadow position={[0, height / 2, 0]} name={name}>
      <planeGeometry args={[height * aspect, height]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
};

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const SceneObject = ({ object, selected, onSelect, onTransform, onDragStateChange }: Props) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const [groupNode, setGroupNode] = useState<THREE.Group | null>(null);
  const { raycaster, gl } = useThree();
  const draggingRef = useRef(false);
  const offsetRef = useRef(new THREE.Vector3());
  const hitRef = useRef(new THREE.Vector3());

  // Keep the group in sync when position changes from outside (e.g. reset/restore).
  useEffect(() => {
    if (groupRef.current && !draggingRef.current) {
      groupRef.current.position.set(object.position[0], 0, object.position[2]);
    }
  }, [object.position]);

  const body = object.glb_url
    ? <ModelBody url={object.glb_url} material={object.material ?? null} />
    : object.image_url
      ? <ImageBody url={object.image_url} name={object.product_name} />
      : null;

  /** Raycast the pointer onto the y = 0 floor plane. */
  const floorHit = useCallback(() => {
    const point = hitRef.current;
    return raycaster.ray.intersectPlane(FLOOR_PLANE, point) ? point : null;
  }, [raycaster]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onSelect(object.instanceId);
    const hit = floorHit();
    if (!hit || !groupRef.current) return;
    offsetRef.current.set(
      groupRef.current.position.x - hit.x,
      0,
      groupRef.current.position.z - hit.z,
    );
    draggingRef.current = true;
    onDragStateChange(true);
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
    gl.domElement.style.cursor = "grabbing";
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current || !groupRef.current) return;
    event.stopPropagation();
    const hit = floorHit();
    if (!hit) return;
    // Floor lock: X/Z translation only, y is pinned to 0.
    groupRef.current.position.set(hit.x + offsetRef.current.x, 0, hit.z + offsetRef.current.z);
  };

  const endDrag = (event?: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onDragStateChange(false);
    gl.domElement.style.cursor = "auto";
    if (event) (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    const group = groupRef.current;
    if (group) {
      onTransform(object.instanceId, [group.position.x, 0, group.position.z], object.rotation);
    }
  };

  const content = (
    <group
      ref={(node) => {
        groupRef.current = node;
        setGroupNode(node);
      }}
      position={[object.position[0], 0, object.position[2]]}
      rotation={object.rotation}
      scale={object.scale}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => endDrag()}
    >
      {body}
    </group>
  );

  return (
    <>
      {content}
      {selected && groupNode && (
        <TransformControls
          object={groupNode}
          mode="translate"
          showY={false}
          size={0.85}
          onMouseDown={() => onDragStateChange(true)}
          onMouseUp={() => {
            onDragStateChange(false);
            const group = groupRef.current;
            if (group) {
              group.position.y = 0;
              onTransform(object.instanceId, [group.position.x, 0, group.position.z], object.rotation);
            }
          }}
          onObjectChange={() => {
            const group = groupRef.current;
            if (group) group.position.y = 0;
          }}
        />
      )}
    </>
  );
};

export default SceneObject;
