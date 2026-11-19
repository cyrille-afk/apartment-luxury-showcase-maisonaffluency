import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useEffect } from "react";
import FinishComparison from "./FinishComparison";
import type { PlacedObject } from "./SceneObject";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import type { ComparisonCameraLink } from "./comparisonCameraLink";

const materials = [{ id: "oak", name: "Oak" }, { id: "walnut", name: "Walnut" }] as VisualiserMaterial[];
const object = { instanceId: "table", product_name: "Table", glb_url: "table.glb", material: materials[0] } as PlacedObject;
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, []);
  return null;
}

it("toggling camera linking preserves both previews and never applies finishes", async () => {
  const apply = vi.fn();
  const links: Record<string, ComparisonCameraLink> = {};
  render(<FinishComparison object={object} objects={[object]} target="all" targetName="Whole Piece" materials={materials} onApply={apply} renderRoom={(_objects, camera, onReady) => { links[camera.id] = camera; return <Ready onReady={onReady} />; }} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare finishes" }));
  const toggle = screen.getByRole("button", { name: "Link camera movement" });
  expect(links.A.enabled).toBe(true); expect(links.B.enabled).toBe(true);
  const shared = links.A.shared;
  fireEvent.click(toggle);
  expect(links.A.enabled).toBe(false); expect(links.B.enabled).toBe(false);
  expect(links.A.shared).toBe(shared);
  fireEvent.click(toggle);
  expect(links.A.enabled).toBe(true); expect(links.B.enabled).toBe(true);
  expect(apply).not.toHaveBeenCalled();
});

it("closing discards comparison while applying B commits only its selected material", async () => {
  const apply = vi.fn();
  render(<FinishComparison object={object} objects={[object]} target="all" targetName="Whole Piece" materials={materials} onApply={apply} renderRoom={(_objects, _camera, onReady) => <Ready onReady={onReady} />} />);
  fireEvent.click(screen.getByRole("button", { name: "Compare finishes" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Use finish B" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Close finish comparison" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Compare finishes" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Use finish B" })));
  expect(apply).toHaveBeenCalledExactlyOnceWith(materials[1]);
  expect(screen.queryByRole("dialog")).toBeNull();
});