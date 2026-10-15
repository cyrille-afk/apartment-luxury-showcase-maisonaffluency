import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { isTraceableMesh, PATH_TRACING, restorePhotorealQuality, tracedEnvironmentRevision, tracedSceneRevision } from "./visualiserPathTracing";

describe("progressive path tracing", () => {
  it("uses a full-resolution moving preview and settled image", () => {
    expect(PATH_TRACING.movingScale).toBe(1);
    expect(PATH_TRACING.settledScale).toBe(1);
  });
  it("restores old low-resolution preferences once without overriding later explicit choices", () => {
    expect(restorePhotorealQuality({ previewScale: 0.25, renderScale: 0.5 })).toMatchObject({ previewScale: 1, renderScale: 1 });
    expect(restorePhotorealQuality({ previewScale: 0.5, renderScale: 1.5, qualityVersion: 2 })).toMatchObject({ previewScale: 0.5, renderScale: 1.5 });
    expect(restorePhotorealQuality({ renderScale: 2 }).renderScale).toBe(2);
  });
  it("ignores raster-only helpers and shadow catchers", () => {
    expect(isTraceableMesh(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShadowMaterial()))).toBe(false);
    expect(isTraceableMesh(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial()))).toBe(false);
    expect(isTraceableMesh(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial()))).toBe(true);
  });
  it("detects asynchronously mounted furniture without a page signature change", () => {
    const scene = new THREE.Scene();
    const before = tracedSceneRevision(scene);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    expect(tracedSceneRevision(scene)).not.toBe(before);
  });
  it("detects finishes and textures arriving after the model", () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const before = tracedSceneRevision(scene);
    material.normalMap = new THREE.Texture();
    expect(tracedSceneRevision(scene)).not.toBe(before);
    const mapped = tracedSceneRevision(scene);
    material.roughness = 0.9;
    expect(tracedSceneRevision(scene)).not.toBe(mapped);
  });
  it("resets when the HDRI arrives or its rotation changes", () => {
    const scene = new THREE.Scene();
    const before = tracedEnvironmentRevision(scene);
    scene.environment = new THREE.DataTexture();
    expect(tracedEnvironmentRevision(scene)).not.toBe(before);
    const loaded = tracedEnvironmentRevision(scene);
    scene.environmentRotation.y = Math.PI / 4;
    expect(tracedEnvironmentRevision(scene)).not.toBe(loaded);
  });
  it("does not rebuild for hidden furniture or grid helpers", () => {
    const scene = new THREE.Scene();
    const before = tracedSceneRevision(scene);
    const group = new THREE.Group();
    group.visible = false;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    scene.add(group, new THREE.GridHelper());
    expect(tracedSceneRevision(scene)).toBe(before);
  });
  it("detects an HDR preset swap without changing furniture or waiting for camera movement", () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ roughness: 0.15, metalness: 0 })));
    scene.environment = new THREE.DataTexture();
    const furniture = tracedSceneRevision(scene);
    const studio = tracedEnvironmentRevision(scene);
    scene.environment = new THREE.DataTexture();
    scene.background = scene.environment;
    const interior = tracedEnvironmentRevision(scene);
    expect(interior).not.toBe(studio);
    expect(tracedSceneRevision(scene)).toBe(furniture);
    expect(tracedEnvironmentRevision(scene)).toBe(interior);
  });
});
