import * as THREE from "three";

type AttributeWire = { array: THREE.TypedArray; itemSize: number; normalized: boolean };
type GeometryWire = { uuid: string; attributes: Record<string, AttributeWire>; index: AttributeWire | null; groups: THREE.BufferGeometry["groups"]; userData: Record<string, unknown> };
type NodeWire = { type: string; name: string; position: number[]; quaternion: number[]; scale: number[]; visible: boolean; userData: Record<string, unknown>; geometry?: string; materials?: string[]; arrayMaterial?: boolean; children: NodeWire[] };
export type ModelWire = { root: NodeWire; geometries: GeometryWire[]; materials: ReturnType<THREE.Material["toJSON"]>[]; textures: ReturnType<THREE.Texture["toJSON"]>[] };

/** Copy only geometry buffers; never detach the shared GLTF cache. Images stay on their owning side. */
export function encodeModel(root: THREE.Object3D): { wire: ModelWire; transfers: ArrayBuffer[]; textures: Map<string, THREE.Texture> } {
  const geometries = new Map<string, GeometryWire>();
  const materials = new Map<string, ReturnType<THREE.Material["toJSON"]>>();
  const textures = new Map<string, THREE.Texture>();
  const transfers: ArrayBuffer[] = [];
  const metadata = { textures: {} as Record<string, unknown>, images: {} as Record<string, unknown> };
  const attribute = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): AttributeWire => {
    // No clone metadata: Three de-interleaves each attribute into its own buffer.
    // clone({}) preserves stride/offset, which this packed wire format does not carry.
    const copied = a.clone();
    transfers.push(copied.array.buffer as ArrayBuffer);
    return { array: copied.array, itemSize: copied.itemSize, normalized: copied.normalized };
  };
  const node = (object: THREE.Object3D): NodeWire => {
    const out: NodeWire = { type: object.type, name: object.name, position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), visible: object.visible, userData: { ...object.userData }, children: object.children.map(node) };
    if (object instanceof THREE.Mesh) {
      const g: THREE.BufferGeometry = object.geometry;
      if (!geometries.has(g.uuid)) geometries.set(g.uuid, { uuid: g.uuid, attributes: Object.fromEntries(Object.entries(g.attributes).map(([key, value]) => [key, attribute(value)])), index: g.index ? attribute(g.index) : null, groups: g.groups.map(group => ({ ...group })), userData: { ...g.userData } });
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        if (materials.has(material.uuid)) continue;
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) {
          textures.set(value.uuid, value);
          // Suppress image serialization/readback; workers receive bitmaps separately.
          metadata.images[value.source.uuid] = { uuid: value.source.uuid };
        }
        materials.set(material.uuid, material.toJSON(metadata));
      }
      out.geometry = g.uuid; out.materials = list.map(material => material.uuid); out.arrayMaterial = Array.isArray(object.material);
    }
    return out;
  };
  const tree = node(root);
  return { wire: { root: tree, geometries: [...geometries.values()], materials: [...materials.values()], textures: Object.values(metadata.textures) as ModelWire["textures"] }, transfers, textures };
}

export function decodeModel(wire: ModelWire, textures: Map<string, THREE.Texture>): THREE.Object3D {
  const geometries = new Map(wire.geometries.map(g => {
    const geometry = new THREE.BufferGeometry();
    geometry.uuid = g.uuid;
    for (const [key, a] of Object.entries(g.attributes)) geometry.setAttribute(key, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized));
    if (g.index) geometry.setIndex(new THREE.BufferAttribute(g.index.array, g.index.itemSize, g.index.normalized));
    geometry.groups = g.groups; geometry.userData = g.userData;
    return [g.uuid, geometry] as const;
  }));
  const loader = new THREE.MaterialLoader().setTextures(Object.fromEntries(textures));
  const materials = new Map(wire.materials.map(material => [material.uuid, loader.parse(material)]));
  const node = (data: NodeWire): THREE.Object3D => {
    const geometry = data.geometry ? geometries.get(data.geometry) : undefined;
    const list = (data.materials ?? []).map(id => materials.get(id)).filter((m): m is THREE.Material => Boolean(m));
    const object = geometry ? new THREE.Mesh(geometry, data.arrayMaterial ? list : list[0] ?? new THREE.MeshStandardMaterial()) : new THREE.Group();
    object.name = data.name; object.position.fromArray(data.position); object.quaternion.fromArray(data.quaternion); object.scale.fromArray(data.scale); object.visible = data.visible; object.userData = data.userData;
    if (geometry) { object.castShadow = true; object.receiveShadow = true; object.layers.enable(1); }
    for (const child of data.children) object.add(node(child));
    return object;
  };
  return node(wire.root);
}