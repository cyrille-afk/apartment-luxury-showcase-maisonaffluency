import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { ActiveProjectProvider, useActiveProject } from "./ActiveProjectContext";
afterEach(() => { cleanup(); sessionStorage.clear(); });
function Consumer() {
  const project = useActiveProject();
  if (!project) return null;
  return <><output>{JSON.stringify(project.state)}</output><button onClick={() => project.setFloorPlanUrl("https://assets.example/plan.png")}>Plan</button><button onClick={() => project.setView("sandbox")}>Inside</button><button onClick={() => project.setBounds({ width: 11.475, depth: 5.81, height: 3 })}>Bounds</button></>;
}
describe("active project state", () => {
  it("read-only shell capture never writes room edits into the session or project", () => {
    const id = "f6068253-c046-44f6-a29d-2efe2fedfb31";
    const key = `ma-active-layout-v1:owner:${id}`;
    const original = JSON.stringify({ objects: [], floorPlanUrl: "https://assets.example/original.png" });
    sessionStorage.setItem(key, original);
    const writes = vi.spyOn(supabase, "from");
    render(<ActiveProjectProvider accountId="owner" projectId={id} initialView="sandbox" readOnly freshHandoff><Consumer /></ActiveProjectProvider>);
    fireEvent.click(screen.getByText("Plan")); fireEvent.click(screen.getByText("Bounds"));
    expect(sessionStorage.getItem(key)).toBe(original);
    expect(writes).not.toHaveBeenCalledWith("project_visualiser_layouts");
    writes.mockRestore();
  });
  it("restores a transferred piece's edited position, rotation and finish on refresh", () => {
    const piece = { instanceId: "transferred-sofa", id: "sofa", product_name: "Sofa", position: [1.25, 0, -2], rotation: [0, Math.PI / 4, 0], scale: 1, material: { id: "selected-oak", name: "Selected oak" }, finishesLocked: true };
    sessionStorage.setItem("ma-active-layout-v1:owner:transferred-project", JSON.stringify({ objects: [piece] }));
    function Room() { const project = useActiveProject(); return <output>{JSON.stringify(project?.objects)}</output>; }
    const mount = () => render(<ActiveProjectProvider accountId="owner" projectId="transferred-project" initialView="sandbox"><Room /></ActiveProjectProvider>);
    mount();
    expect(JSON.parse(screen.getByRole("status").textContent || "[]")).toEqual([piece]);
    cleanup(); mount();
    expect(JSON.parse(screen.getByRole("status").textContent || "[]")).toEqual([piece]);
  });
  it("a selected-board handoff never loads nineteen cached or cloud objects", () => {
    const id = "f6068253-c046-44f6-a29d-2efe2fedfb31";
    sessionStorage.setItem(`ma-active-layout-v1:owner:${id}`, JSON.stringify({ objects: Array.from({ length: 19 }, (_, i) => ({ instanceId: `old-${i}` })) }));
    const reads = vi.spyOn(supabase, "from");
    render(<ActiveProjectProvider accountId="owner" projectId={id} initialView="sandbox" freshHandoff><Consumer /></ActiveProjectProvider>);
    expect(JSON.parse(screen.getByRole("status").textContent || "{}").placedItems).toHaveLength(0);
    expect(reads).not.toHaveBeenCalledWith("project_visualiser_layouts");
    reads.mockRestore();
  });
  it("retains floor plan and bounds through view changes and refresh restoration", () => {
    const mount = () => render(<ActiveProjectProvider accountId="owner" projectId="project-a" initialView="axonometric"><Consumer /></ActiveProjectProvider>);
    mount();
    fireEvent.click(screen.getByText("Plan")); fireEvent.click(screen.getByText("Bounds")); fireEvent.click(screen.getByText("Inside"));
    expect(JSON.parse(screen.getByRole("status").textContent || "{}")).toMatchObject({ projectId: "project-a", floorPlanUrl: "https://assets.example/plan.png", cameraPerspective: "eye-level", bounds: { width: 11.475, depth: 5.81, height: 3 } });
    cleanup(); mount();
    expect(JSON.parse(screen.getByRole("status").textContent || "{}")).toMatchObject({ floorPlanUrl: "https://assets.example/plan.png", bounds: { width: 11.475, depth: 5.81, height: 3 } });
  });
  it("does not load another account or project's layout", () => {
    sessionStorage.setItem("ma-active-layout-v1:other:project-a", JSON.stringify({ objects: [], floorPlanUrl: "private-plan" }));
    render(<ActiveProjectProvider accountId="owner" projectId="project-a" initialView="axonometric"><Consumer /></ActiveProjectProvider>);
    expect(JSON.parse(screen.getByRole("status").textContent || "{}")).toMatchObject({ floorPlanUrl: null });
  });
  it("recognizes a saved empty room rather than repopulating its furniture", () => {
    sessionStorage.setItem("ma-active-layout-v1:owner:project-a", JSON.stringify({ objects: [] }));
    function Status() {
      const project = useActiveProject();
      return <output>{JSON.stringify({ saved: project?.hasSavedLayout, storageKey: project?.sandboxStorageKey })}</output>;
    }
    render(<ActiveProjectProvider accountId="owner" projectId="project-a" initialView="sandbox"><Status /></ActiveProjectProvider>);
    expect(JSON.parse(screen.getByRole("status").textContent || "{}")).toEqual({ saved: true, storageKey: "trade-visualiser-sandbox-v3:owner:project-a" });
  });
});