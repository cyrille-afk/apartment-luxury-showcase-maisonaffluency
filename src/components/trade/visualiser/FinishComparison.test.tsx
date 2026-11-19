import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useEffect } from "react";
import FinishComparison from "./FinishComparison";
import type { PlacedObject } from "./SceneObject";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

const materials = [{ id: "oak", name: "Oak" }, { id: "walnut", name: "Walnut" }] as VisualiserMaterial[];
const object = { instanceId: "table", product_name: "Table", glb_url: "table.glb", material: materials[0] } as PlacedObject;
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, []);
  return null;
}

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