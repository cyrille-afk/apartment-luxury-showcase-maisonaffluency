import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Product3dBadge, productHas3dModel } from "./Product3dBadge";

describe("Project folder 3D badge", () => {
  it("treats a missing or non-geometry URL as no model", () => {
    expect(productHas3dModel(null)).toBe(false);
    expect(productHas3dModel("   ")).toBe(false);
    expect(productHas3dModel("https://cdn.example/img/gingko.jpg")).toBe(false);
    expect(productHas3dModel("https://cdn.example/models/gingko.glb")).toBe(true);
  });

  it("shows a muted, unclickable notice when the piece has no model", () => {
    const onOpen = vi.fn();
    const onCardClick = vi.fn();
    render(
      <button type="button" onClick={onCardClick}>
        <Product3dBadge glbUrl={null} productName="Gingko Side Table" onOpen={onOpen} />
      </button>,
    );
    const badge = screen.getByText("3D Unavailable");
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute("role")).toBeNull();
    expect(badge.getAttribute("tabindex")).toBeNull();
    // Only the card itself remains a control; the badge adds no second one.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(badge);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("keeps the interactive 3D View badge when a model exists", () => {
    const onOpen = vi.fn();
    render(<Product3dBadge glbUrl="https://cdn.example/models/gingko.glb" productName="Gingko Side Table" onOpen={onOpen} />);
    expect(screen.queryByText("3D Unavailable")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /3D View.*Gingko Side Table/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
