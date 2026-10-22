import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Product3DViewer from "./Product3DViewer";

class TestModelViewer extends HTMLElement {
  model: { materials: any[] } = { materials: [] };
  createTexture = vi.fn(async (url: string) => ({ name: url, source: { uri: url } }));
}
if (!customElements.get("model-viewer")) customElements.define("model-viewer", TestModelViewer);

function material(name: string, textureName: string, factor: number[]) {
  const pbr: any = {
    baseColorFactor: [...factor],
    baseColorTexture: { texture: { name: textureName }, setTexture: vi.fn((texture) => { pbr.baseColorTexture.texture = texture; }) },
    setBaseColorFactor: vi.fn((next) => { pbr.baseColorFactor = next; }),
  };
  return { name, pbrMetallicRoughness: pbr };
}

describe("live product 3D materials", () => {
  it("keeps a manually opened, camera-locked viewport active through independent base and top updates", async () => {
    const base = material("base", "wood.jpg", [0.2, 0.1, 0.05, 1]);
    const top = material("top", "stone.jpg", [0.8, 0.8, 0.8, 1]);
    const onOpenedChange = vi.fn();
    const props = { url: "/table.glb", alt: "Table", onOpenedChange };
    const { container, rerender } = render(<Product3DViewer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Load interactive 3D model" }));
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    expect(viewer).not.toBeNull();
    const model = { materials: [base, top] };
    await act(async () => { viewer.model = model; viewer.dispatchEvent(new Event("load")); });
    fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    onOpenedChange.mockClear();

    rerender(<Product3DViewer {...props} baseTextureUrl="Black Pepper Oak" />);
    await waitFor(() => expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Black Pepper Oak"));
    expect(top.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("stone.jpg");
    rerender(<Product3DViewer {...props} baseTextureUrl="Black Pepper Oak" topTextureUrl="Pall Stone" />);
    await waitFor(() => expect(top.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Pall Stone"));

    expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Black Pepper Oak");
    expect(container.querySelector("model-viewer")).toBe(viewer);
    expect(viewer.model).toBe(model);
    expect(viewer.getAttribute("src")).toBe("/table.glb");
    expect(screen.getByRole("button", { name: "Locked" })).toHaveAttribute("aria-pressed", "true");
    expect(viewer.hasAttribute("camera-controls")).toBe(false);
    expect(screen.queryByRole("button", { name: "Load interactive 3D model" })).toBeNull();
    expect(onOpenedChange).not.toHaveBeenCalled();
  });

  it("keeps the loaded viewport active while a new texture is still pending", async () => {
    const base = material("base", "wood.jpg", [0.2, 0.1, 0.05, 1]);
    const { container, rerender } = render(<Product3DViewer url="/table.glb" alt="Table" autoOpen />);
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    const model = { materials: [base] };
    await act(async () => { viewer.model = model; viewer.dispatchEvent(new Event("load")); });
    let finishTexture: ((texture: unknown) => void) | undefined;
    viewer.createTexture = vi.fn(() => new Promise((resolve) => { finishTexture = resolve; }));
    rerender(<Product3DViewer url="/table.glb" alt="Table" autoOpen baseTextureUrl="Black Pepper Oak" />);
    await waitFor(() => expect(viewer.createTexture).toHaveBeenCalledWith("Black Pepper Oak"));
    expect(container.querySelector("model-viewer")).toBe(viewer);
    expect(viewer.model).toBe(model);
    expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("wood.jpg");
    await act(async () => { finishTexture?.({ name: "Black Pepper Oak" }); });
    await waitFor(() => expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Black Pepper Oak"));
    expect(container.querySelector("model-viewer")).toBe(viewer);
    expect(viewer.model).toBe(model);
  });

  it("opens an existing viewport when a combination requests a preview", async () => {
    const { container, rerender } = render(<Product3DViewer url="/table.glb" alt="Table" />);
    expect(container.querySelector("model-viewer")).toBeNull();
    rerender(<Product3DViewer url="/table.glb" alt="Table" autoOpen />);
    await waitFor(() => expect(container.querySelector("model-viewer")).not.toBeNull());
  });
  it("swaps Black Pepper Oak and stone independently on the same loaded model, then restores originals", async () => {
    const base = material("opaque-base", "wood_oak.jpg", [0.2, 0.1, 0.05, 1]);
    const top = material("opaque-top", "stone_marble.jpg", [0.8, 0.8, 0.8, 1]);
    const originalBase = base.pbrMetallicRoughness.baseColorTexture.texture;
    const originalTop = top.pbrMetallicRoughness.baseColorTexture.texture;
    const props = { url: "/table.glb", alt: "Table", autoOpen: true };
    const { container, rerender } = render(<Product3DViewer {...props} baseTextureUrl="Black Pepper Oak" topTextureUrl="Nero Marquina" />);
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    expect(viewer).not.toBeNull();
    const model = { materials: [base, top] };
    await act(async () => { viewer.model = model; viewer.dispatchEvent(new Event("load")); });
    await waitFor(() => expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Black Pepper Oak"));
    await waitFor(() => expect(top.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Nero Marquina"));
    rerender(<Product3DViewer {...props} baseTextureUrl="Black Pepper Oak" topTextureUrl="Pall Stone" />);
    await waitFor(() => expect(top.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Pall Stone"));
    expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Black Pepper Oak");
    expect(container.querySelector("model-viewer")).toBe(viewer);
    expect(viewer.model).toBe(model);
    expect(viewer.getAttribute("src")).toBe("/table.glb");
    rerender(<Product3DViewer {...props} />);
    await waitFor(() => expect(base.pbrMetallicRoughness.baseColorTexture.texture).toBe(originalBase));
    expect(top.pbrMetallicRoughness.baseColorTexture.texture).toBe(originalTop);
    expect(base.pbrMetallicRoughness.baseColorFactor).toEqual([0.2, 0.1, 0.05, 1]);
    expect(top.pbrMetallicRoughness.baseColorFactor).toEqual([0.8, 0.8, 0.8, 1]);
  });

  it("rejects a slow old texture after a newer selection has applied", async () => {
    const base = material("base", "wood.jpg", [0.2, 0.1, 0.05, 1]);
    const props = { url: "/table.glb", alt: "Table", autoOpen: true, materialRoles: { base: "base" as const } };
    const { container, rerender } = render(<Product3DViewer {...props} />);
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    await act(async () => { viewer.model = { materials: [base] }; viewer.dispatchEvent(new Event("load")); });
    let finishOld: ((value: any) => void) | undefined;
    viewer.createTexture = vi.fn((url) => url === "old"
      ? new Promise((resolve) => { finishOld = resolve; })
      : Promise.resolve({ name: url, source: { uri: url } }));
    rerender(<Product3DViewer {...props} baseTextureUrl="old" />);
    await waitFor(() => expect(viewer.createTexture).toHaveBeenCalledWith("old"));
    rerender(<Product3DViewer {...props} baseTextureUrl="Black Pepper Oak" />);
    await waitFor(() => expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Black Pepper Oak"));
    await act(async () => { finishOld?.({ name: "old" }); });
    expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("Black Pepper Oak");
  });
});