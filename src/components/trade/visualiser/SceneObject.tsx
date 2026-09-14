import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useTexture, PivotControls } from "@react-three/drei";
import * as THREE from "three";

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
};

type Props = {
  object: PlacedObject;
  selected: boolean;
  onSelect: (instanceId: string) => void;
  onTransform: (instanceId: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
};

/** Normalises any GLB to roughly 1.4m tall and seats it on the floor plane. */
function useFittedModel(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
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
  }, [scene]);
}

const ModelBody = ({ url }: { url: string }) => {
  const model = useFittedModel(url);
  return <primitive object={model} />;
};

const ImageBody = ({ url, name }: { url: string; name: string }) => {
  const texture = useTexture(url);
  const aspect = texture.image ? texture.image.width / texture.image.height : 1;
  const height = 1.2;
  return (
    <mesh castShadow receiveShadow position={[0, height / 2, 0]} name={name}>
      <planeGeometry args={[height * aspect, height]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
};

const SceneObject = ({ object, selected, onSelect, onTransform, onDragStateChange }: Props) => {
  const groupRef = useRef<THREE.Group>(null);
  const matrixRef = useRef(new THREE.Matrix4());

  useEffect(() => {
    matrixRef.current.identity();
  }, [object.instanceId]);

  const body = object.glb_url
    ? <ModelBody url={object.glb_url} />
    : object.image_url
      ? <ImageBody url={object.image_url} name={object.product_name} />
      : null;

  const content = (
    <group
      ref={groupRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.instanceId);
      }}
    >
      {body}
    </group>
  );

  if (!selected) return content;

  return (
    <PivotControls
      anchor={[0, 0, 0]}
      scale={1.1}
      lineWidth={2}
      depthTest={false}
      disableScaling
      matrix={matrixRef.current}
      autoTransform={false}
      onDragStart={() => onDragStateChange(true)}
      onDragEnd={() => onDragStateChange(false)}
      onDrag={(local) => {
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        local.decompose(position, quaternion, scale);
        const euler = new THREE.Euler().setFromQuaternion(quaternion);
        onTransform(
          object.instanceId,
          [
            object.position[0] + position.x,
            0,
            object.position[2] + position.z,
          ],
          [euler.x, euler.y, euler.z],
        );
      }}
    >
      {content}
    </PivotControls>
  );
};

export default SceneObject;
