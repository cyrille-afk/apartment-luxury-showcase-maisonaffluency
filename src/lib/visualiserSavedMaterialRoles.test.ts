import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { prepareModel } from "./visualiserModelPreparation";
import { toVisualiserRoles } from "./visualiserSavedMaterialRoles";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

const mesh = (name: string, material: string) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), new THREE.MeshStandardMaterial({ name: material })); m.name = name; return m; };
const piece: PlacedObject = { id: "rua", instanceId: "i", product_name: "Test chair", brand_name: "Maker", image_url: null, glb_url: "rua.glb", dimensions: "W 90 D 90 H 76 cm", position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };

describe("saved fabric/frame mapping in the room visualiser", () => {
  it("keeps upholstery off the frame and leaves ignored parts untouched", () => {
    const scene = new THREE.Group();
    scene.add(mesh("Shell", "uuid-fabric"), mesh("Legs", "uuid-legs"), mesh("Post", "uuid-post"));
    const savedMaterialRoles = toVisualiserRoles({ "uuid-fabric": "fabric", "uuid-legs": "base", "uuid-post": "ignore" });
    const model = prepareModel(scene, { ...piece, savedMaterialRoles }, {}, new Map(), null);
    const roles: Record<string, unknown> = {};
    model.traverse(c => { if ((c as THREE.Mesh).isMesh) roles[c.name] = c.userData.partRole; });
    expect(roles).toEqual({ Shell: "upholstery", Legs: "base", Post: null });
  });
});
