import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Product3DViewer from "./Product3DViewer";

const qrRenderer = vi.hoisted(() => vi.fn(() => null));
vi.mock("qrcode.react", () => ({ QRCodeSVG: qrRenderer }));

class TestModelViewer extends HTMLElement {
  canActivateAR = false;
  activateAR = vi.fn(async () => {});
  model: { materials: any[] } = { materials: [] };
  createTexture = vi.fn(async (url: string) => ({ name: url, source: { uri: url } }));
}
if (!customElements.get("model-viewer")) customElements.define("model-viewer", TestModelViewer);

function mobileCapability(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
}
beforeEach(() => mobileCapability(false));

describe("desktop AR phone handoff", () => {
  it("keeps the exact current page, furniture and fabric query parameters on the public website", () => {
    window.history.replaceState({}, "", "/trade/boards/example?project=cipriani&piece=gum&fabric=Edson%20008#finishes");
    render(<Product3DViewer url="/chair.glb" alt="Chair" autoOpen />);
    fireEvent.click(screen.getByRole("button", { name: "View in Your Room (AR)" }));
    expect(qrRenderer).toHaveBeenCalledWith(expect.objectContaining({ value: "https://www.maisonaffluency.com/trade/boards/example?project=cipriani&piece=gum&fabric=Edson%20008#finishes" }), undefined);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    window.history.replaceState({}, "", "/");
  });
});

describe("mobile AR availability", () => {
  it("waits for the newly selected upholstery before exporting the live scene to AR", async () => {
    mobileCapability(true);
    const seat = material("seat", "default.jpg", [1, 1, 1, 1]);
    const props = { url: "/chair.glb", alt: "Chair", autoOpen: true, materialRoles: { seat: "fabric" as const } };
    const { container, rerender } = render(<Product3DViewer {...props} fabricTextureUrl="cream.jpg" />);
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    await act(async () => { viewer.model = { materials: [seat] }; viewer.canActivateAR = true; viewer.dispatchEvent(new Event("load")); });
    const ar = await screen.findByRole("button", { name: "View in Your Space" });
    await waitFor(() => expect(ar).toBeEnabled());
    let complete: ((texture: { name: string; source: { uri: string } }) => void) | undefined;
    viewer.createTexture = vi.fn(() => new Promise(resolve => { complete = resolve; }));
    rerender(<Product3DViewer {...props} fabricTextureUrl="EDSON-008-Charbon.jpg" />);
    expect(ar).toBeDisabled();
    fireEvent.click(ar);
    expect(viewer.activateAR).not.toHaveBeenCalled();
    await act(async () => { complete?.({ name: "EDSON-008-Charbon.jpg", source: { uri: "EDSON-008-Charbon.jpg" } }); });
    await waitFor(() => expect(ar).toBeEnabled());
    viewer.activateAR = vi.fn(async () => { expect(seat.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("EDSON-008-Charbon.jpg"); });
    fireEvent.click(ar);
    expect(viewer.activateAR).toHaveBeenCalledOnce();
  });

  it("does not launch the default fabric when the selected upholstery fails to load", async () => {
    mobileCapability(true);
    const seat = material("seat", "default.jpg", [1, 1, 1, 1]);
    const { container } = render(<Product3DViewer url="/chair.glb" alt="Chair" autoOpen fabricTextureUrl="unavailable.jpg" materialRoles={{ seat: "fabric" }} />);
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    viewer.createTexture = vi.fn(async () => { throw new Error("Texture unavailable"); });
    await act(async () => { viewer.model = { materials: [seat] }; viewer.canActivateAR = true; viewer.dispatchEvent(new Event("load")); });
    const ar = await screen.findByRole("button", { name: "View in Your Space" });
    expect(ar).toBeDisabled();
    fireEvent.click(ar);
    expect(viewer.activateAR).not.toHaveBeenCalled();
    expect(seat.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("default.jpg");
  });

  it("never enables AR on desktop even when the model supports it", async () => {
    const { container } = render(<Product3DViewer url="/chair.glb" alt="Chair" autoOpen />);
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    await act(async () => { viewer.canActivateAR = true; viewer.dispatchEvent(new Event("load")); });
    expect(viewer.hasAttribute("ar")).toBe(false);
    expect(screen.queryByRole("button", { name: "View in Your Space" })).toBeNull();
  });

  it("only offers mobile AR when the native viewer confirms capability and fixes its scale", async () => {
    mobileCapability(true);
    const { container } = render(<Product3DViewer url="/chair.glb" alt="Chair" autoOpen scale="0.9 0.77 0.75" />);
    const viewer = container.querySelector("model-viewer") as TestModelViewer;
    expect(screen.queryByRole("button", { name: "View in Your Space" })).toBeNull();
    await act(async () => { viewer.canActivateAR = true; viewer.dispatchEvent(new Event("load")); });
    await waitFor(() => expect(screen.getByRole("button", { name: "View in Your Space" })).toBeVisible());
    expect(viewer.getAttribute("ar-scale")).toBe("fixed");
    expect(viewer.getAttribute("scale")).toBe("0.9 0.77 0.75");
    expect(viewer.getAttribute("ar-modes")).toBe("webxr quick-look");
    expect(viewer.hasAttribute("ios-src")).toBe(false);
  });
});

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
    let finishTexture: ((texture: { name: string; source: { uri: string } }) => void) | undefined;
    viewer.createTexture = vi.fn(() => new Promise((resolve) => { finishTexture = resolve; }));
    rerender(<Product3DViewer url="/table.glb" alt="Table" autoOpen baseTextureUrl="Black Pepper Oak" />);
    await waitFor(() => expect(viewer.createTexture).toHaveBeenCalledWith("Black Pepper Oak"));
    expect(container.querySelector("model-viewer")).toBe(viewer);
    expect(viewer.model).toBe(model);
    expect(base.pbrMetallicRoughness.baseColorTexture.texture.name).toBe("wood.jpg");
    await act(async () => { finishTexture?.({ name: "Black Pepper Oak", source: { uri: "Black Pepper Oak" } }); });
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