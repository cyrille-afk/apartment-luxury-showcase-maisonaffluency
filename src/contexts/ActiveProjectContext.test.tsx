import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActiveProjectProvider, useActiveProject } from "./ActiveProjectContext";
afterEach(() => { cleanup(); sessionStorage.clear(); });
function Consumer() {
  const project = useActiveProject();
  if (!project) return null;
  return <><output>{JSON.stringify(project.state)}</output><button onClick={() => project.setFloorPlanUrl("https://assets.example/plan.png")}>Plan</button><button onClick={() => project.setView("sandbox")}>Inside</button><button onClick={() => project.setBounds({ width: 11.475, depth: 5.81, height: 3 })}>Bounds</button></>;
}
describe("active project state", () => {
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
});