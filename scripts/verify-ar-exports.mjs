#!/usr/bin/env node
/** Build-time only: inspect original GLB geometry, then apply the real viewer export transform. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { arModelTransform } from "../src/lib/arModelTransform.ts";
import { validateArExport } from "../src/lib/arExportValidation.ts";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] ?? fallback : fallback;
const inventoryPath = option("--inventory", "scripts/data/ar-model-inventory.json");
const reportPath = option("--report", "node_modules/.cache/ar-export-validation.json");
const warnOnly = args.includes("--warn-only");
const inventory = JSON.parse(await readFile(resolve(inventoryPath), "utf8"));
if (!Array.isArray(inventory.models) || inventory.models.length === 0) throw new Error("AR inventory is missing or empty.");

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco.createDecoderModule(), "meshopt.decoder": MeshoptDecoder,
});
const results = [];
async function check(entry) {
  try {
    const url = new URL(entry.url);
    if (url.protocol !== "https:") throw new Error("Model source must use HTTPS.");
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Model download returned ${response.status}.`);
    const document = await io.readBinary(new Uint8Array(await response.arrayBuffer()));
    const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
    if (!scene) throw new Error("Model has no renderable scene.");
    const transform = arModelTransform(entry.url);
    const [sx, sy, sz] = transform.scale.split(" ").map(Number);
    // model-viewer uses roll(Z), pitch(X), yaw(Y), with YXZ composition.
    const [roll, pitch, yaw] = transform.orientation.split(" ").map(value => parseFloat(value) * Math.PI / 180);
    const quaternion = new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, "YXZ"));
    const exportMatrix = new Matrix4().compose(new Vector3(), quaternion, new Vector3(sx, sy, sz));
    const bounds = new Box3(); let vertices = 0;
    scene.traverse(node => {
      const mesh = node.getMesh(); if (!mesh) return;
      const world = exportMatrix.clone().multiply(new Matrix4().fromArray(node.getWorldMatrix()));
      for (const primitive of mesh.listPrimitives()) {
        const positions = primitive.getAttribute("POSITION"); if (!positions) continue;
        const value = [];
        for (let i = 0; i < positions.getCount(); i++) {
          positions.getElement(i, value);
          bounds.expandByPoint(new Vector3(value[0], value[1], value[2]).applyMatrix4(world));
          vertices++;
        }
      }
    });
    const dimensions = bounds.getSize(new Vector3()).toArray();
    const exportedUp = entry.sourceUp ? new Vector3(...entry.sourceUp).applyQuaternion(quaternion).toArray() : undefined;
    const issues = validateArExport({ dimensions, vertices, ...(entry.expected ? { expected: entry.expected } : {}), ...(exportedUp ? { exportedUp } : {}) });
    return { id: entry.id, name: entry.name, sourceRevision: url.pathname, dimensionsMetres: dimensions, vertices,
      exportTransform: transform, ...(entry.expected ? { expectedMetres: entry.expected, measurementBasis: entry.measurementBasis } : {}),
      status: issues.some(issue => issue.severity === "error") ? "flagged" : issues.length ? "unconfirmed" : "verified", issues };
  } catch (error) {
    return { id: entry.id, name: entry.name, status: "flagged", issues: [{ code: "inspection-failed", severity: "error", message: error instanceof Error ? error.message : "Model inspection failed." }] };
  }
}
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < inventory.models.length) {
    const entry = inventory.models[next++];
    const result = await check(entry); results.push(result);
    const summary = result.issues.map(issue => issue.code).join(", ") || "true scale and audited up direction verified";
    console.log(`[AR ${result.status.toUpperCase()}] ${result.name}: ${summary}`);
  }
}));
results.sort((a, b) => a.name.localeCompare(b.name) || (a.sourceRevision ?? "").localeCompare(b.sourceRevision ?? ""));
const report = { generatedAt: new Date().toISOString(), inventoryDate: inventory.inventoryDate, scope: inventory.scope,
  summary: { checked: results.length, flagged: results.filter(result => result.status === "flagged").length,
    unconfirmed: results.filter(result => result.status === "unconfirmed").length, verified: results.filter(result => result.status === "verified").length }, results };
await mkdir(dirname(resolve(reportPath)), { recursive: true });
await writeFile(resolve(reportPath), JSON.stringify(report, null, 2) + "\n");
console.log(`[AR audit] ${JSON.stringify(report.summary)}; inventory ${inventory.inventoryDate}; report ${reportPath}`);
if (report.summary.flagged || report.summary.unconfirmed) {
  console.warn("[AR audit] Review flagged and unconfirmed exports before publishing. No model, finish, price or permission was changed.");
  if (!warnOnly) process.exitCode = 1;
}