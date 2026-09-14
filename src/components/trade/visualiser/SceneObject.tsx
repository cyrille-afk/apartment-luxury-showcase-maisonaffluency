import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useTexture, TransformControls } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import { BOND_STREET_BASE_FINISH, isBondStreetStool } from "@/lib/visualiserProductFinishes";

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
  baseMaterial?: VisualiserMaterial | null;
  upholsteryMaterial?: VisualiserMaterial | null;
};

type Props = {
  object: PlacedObject;
  selected: boolean;
  onSelect: (instanceId: string) => void;
  onTransform: (instanceId: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
};

type LoadedMaps = {
  diffuse: THREE.Texture | null;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
};

const EMPTY_MAPS: LoadedMaps = { diffuse: null, normal: null, roughness: null };

function useMaterialMaps(material: VisualiserMaterial | null, maxAnisotropy: number) {
  const [maps, setMaps] = useState<LoadedMaps>(EMPTY_MAPS);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const load = (url?: string | null) => url ? loader.loadAsync(url) : Promise.resolve(null);
    void Promise.all([
      load(material?.diffuse_url ?? material?.image_url),
      load(material?.normal_url),
      load(material?.roughness_url),
    ]).then(([diffuse, normal, roughness]) => {
      if (cancelled) {
        diffuse?.dispose();
        normal?.dispose();
        roughness?.dispose();
        return;
      }
      const repeat = material?.repeat ?? 6;
      for (const texture of [diffuse, normal, roughness]) {
        if (!texture) continue;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat, repeat);
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
      }
      if (diffuse) diffuse.colorSpace = THREE.SRGBColorSpace;
      if (normal) normal.colorSpace = THREE.NoColorSpace;
      if (roughness) roughness.colorSpace = THREE.NoColorSpace;
      setMaps({ diffuse, normal, roughness });
    }).catch(() => setMaps(EMPTY_MAPS));
    return () => {
      cancelled = true;
      setMaps((current) => {
        current.diffuse?.dispose();
        current.normal?.dispose();
        current.roughness?.dispose();
        return EMPTY_MAPS;
      });
    };
  }, [material, maxAnisotropy]);

  return maps;
}

function clonePbrMaterial(source: THREE.Material, finish: VisualiserMaterial | null, maps: LoadedMaps, neutralFabric = false) {
  const original = source as THREE.MeshStandardMaterial;
  const material = original.clone();
  material.map = neutralFabric ? null : maps.diffuse;
  material.normalMap = neutralFabric ? null : maps.normal;
  material.roughnessMap = neutralFabric ? null : maps.roughness;
  material.metalnessMap = null;
  material.color.set(neutralFabric ? "#d8d4cc" : finish?.color ?? "#ffffff");
  material.roughness = neutralFabric ? 0.96 : finish?.roughness ?? 0.75;
  material.metalness = neutralFabric ? 0 : finish?.metalness ?? 0;
  material.normalScale.set(0.22, 0.22);
  material.needsUpdate = true;
  return material;
}

/** Normalises any GLB to roughly 1.4m tall and seats it on the floor plane. */
function useFittedModel(
  productId: string,
  url: string,
  material: VisualiserMaterial | null,
  baseMaterial: VisualiserMaterial | null,
  upholsteryMaterial: VisualiserMaterial | null,
) {
  const { scene } = useGLTF(url);
  const { gl } = useThree();
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const generalMaps = useMaterialMaps(material, maxAnisotropy);
  const baseMaps = useMaterialMaps(baseMaterial, maxAnisotropy);
  const upholsteryMaps = useMaterialMaps(upholsteryMaterial, maxAnisotropy);
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const nodeName = mesh.name.toLowerCase();
        const isBondStreet = isBondStreetStool(productId);
        const role = /upholstery|fabric|cushion|seat|cover|textile/.test(nodeName)
          ? "upholstery"
          : /base|frame|leg|metal|bronze|steel/.test(nodeName)
            ? "base"
            : null;
        const finish = role === "upholstery" ? upholsteryMaterial : role === "base" ? baseMaterial : material;
        const maps = role === "upholstery" ? upholsteryMaps : role === "base" ? baseMaps : generalMaps;
        const neutralFabric = isBondStreet && role === "upholstery" && !upholsteryMaterial;
        if (!finish && !neutralFabric) return;
        const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const next = source.map((entry) => clonePbrMaterial(entry, finish, maps, neutralFabric));
        mesh.material = Array.isArray(mesh.material) ? next : next[0];
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
  }, [baseMaps, baseMaterial, generalMaps, material, productId, scene, upholsteryMaps, upholsteryMaterial]);
}

const ModelBody = ({ object }: { object: PlacedObject }) => {
  const model = useFittedModel(
    object.id,
    object.glb_url ?? "",
    object.material ?? null,
    object.baseMaterial ?? (isBondStreetStool(object.id) ? BOND_STREET_BASE_FINISH : null),
    object.upholsteryMaterial ?? null,
  );
  useEffect(() => () => {
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((entry) => entry.dispose());
    });
  }, [model]);
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
    ? <ModelBody object={object} />
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
