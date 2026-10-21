import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ActiveProjectProvider, useActiveProject } from "@/contexts/ActiveProjectContext";
import { ProjectInventoryProvider } from "@/contexts/ProjectInventoryContext";
import { createPlacedObject, inventoryItemToPlaceable } from "@/lib/placedObjectFactory";
import type { ProjectInventoryItem } from "@/contexts/ProjectInventoryContext";
import ProjectAssetsDrawer from "./ProjectAssetsDrawer";

afterEach(() => { cleanup(); sessionStorage.clear(); });

function Room() {
  const project = useActiveProject();
  return <>
    <ProjectAssetsDrawer onPlace={item => project?.setObjects(current => [...current, createPlacedObject(inventoryItemToPlaceable(item), [0, 0, 0])])} />
    <output>{JSON.stringify(project?.state.placedItems)}</output>
  </>;
}

it("drawer removal immediately purges shared geometry and derived vectors and persists the empty room", () => {
  const item: ProjectInventoryItem = {
    instanceId: "madison-configured", id: "madison", productName: "Madison Avenue Side Table",
    brandName: "Yabu Pushelberg", dimensions: "27 × 27 × 50 cm", imageUrl: null, glbUrl: null,
    variantLabel: null, finishes: [], addedAt: 1,
  };
  sessionStorage.setItem("ma:project-inventory-v1", JSON.stringify([item]));
  render(<ProjectInventoryProvider><ActiveProjectProvider accountId="owner" projectId="deletion" initialView="plan"><Room /></ActiveProjectProvider></ProjectInventoryProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Drag Madison Avenue Side Table to layout" }));
  expect(JSON.parse(screen.getByRole("status").textContent || "[]")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Remove Madison Avenue Side Table from project assets" }));
  expect(JSON.parse(screen.getByRole("status").textContent || "[]")).toEqual([]);
  expect(JSON.parse(sessionStorage.getItem("ma-active-layout-v1:owner:deletion") || "{}").objects).toEqual([]);
  expect(JSON.parse(sessionStorage.getItem("ma:project-inventory-v1") || "null")).toEqual([]);
});