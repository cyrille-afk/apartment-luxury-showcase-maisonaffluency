import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { prepareModel } from "./visualiserModelPreparation";
import { encodeModel, decodeModel } from "./visualiserModelWire";
import { decodeTextures } from "./visualiserPreparationTransport";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

const piece: PlacedObject = { id: "test", instanceId: "instance", product_name: "Test cabinet", brand_name: "Maker", image_url: null, glb_url: "test.glb", dimensions: "W 200 D 50 H 80 cm", position: [2, 0, -1], rotation: [0, 0.5, 0], scale: 1 };
describe("worker model preparation", () => {
  it("preserves shared source buffers and authored texture settings across transport", () => {
    const geometry = new THREE.BoxGeometry(2, 0.8, 0.5);
    const original = Array.from(geometry.attributes.position.array);
    const texture = new THREE.DataTexture(new Uint8Array([20, 40, 60, 255]), 1, 1);
    texture.repeat.set(3, 2); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map: texture, color: "#bca072", roughness: 0.4 });
    const scene = new THREE.Group(); scene.add(new THREE.Mesh(geometry, material));
    const encoded = encodeModel(scene);
    const clone = decodeModel(encoded.wire, decodeTextures(encoded.wire, [{ uuid: texture.uuid, data: new Uint8Array([20, 40, 60, 255]), width: 1, height: 1 }]));
    const mesh = clone.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(mesh.geometry).not.toBe(geometry);
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(original);
    expect(mesh.material.map?.repeat.toArray()).toEqual([3, 2]);
    expect(mesh.material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(mesh.material.roughness).toBe(0.4);
    expect(geometry.attributes.position.array.buffer.byteLength).toBeGreaterThan(0);
  });
  it("fits the complete model to catalogue dimensions and grounds it without changing placement", () => {
    const scene = new THREE.Group(); scene.add(new THREE.Mesh(new THREE.BoxGeometry(200, 80, 50), new THREE.MeshStandardMaterial()));
    const model = prepareModel(scene, piece, {}, new Map(), null);
    const bounds = new THREE.Box3().setFromObject(model);
    expect(bounds.getSize(new THREE.Vector3()).toArray()).toEqual([2, 0.8, 0.5]);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(piece.position).toEqual([2, 0, -1]);
    expect(piece.rotation).toEqual([0, 0.5, 0]);
    expect(model.userData.visualiserInitialReady).toBe(true);
  });
  it("prepares the selected finish per part without changing the supplier material", () => {
    const supplier = new THREE.MeshStandardMaterial({ color: "#ffffff" }); supplier.name = "MetalBase";
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.5), supplier); mesh.name = "Base";
    const scene = new THREE.Group(); scene.add(mesh);
    const finish = { id: "bronze", name: "Bronze", color: "#805020", metalness: 0.7, roughness: 0.3, brand_name: "Maker", category: "Metal", material_type: "Metal", color_family: "Bronze", image_url: null };
    const model = prepareModel(scene, { ...piece, baseMaterial: finish }, {}, new Map(), null);
    let selected: THREE.MeshStandardMaterial | undefined;
    model.traverse(node => { if (node instanceof THREE.Mesh) selected = node.material; });
    expect(selected?.color.getHexString()).toBe("805020");
    expect(selected?.metalness).toBe(0.7);
    expect(supplier.color.getHexString()).toBe("ffffff");
    expect(mesh.geometry.attributes.position.count).toBe(24);
  });
});