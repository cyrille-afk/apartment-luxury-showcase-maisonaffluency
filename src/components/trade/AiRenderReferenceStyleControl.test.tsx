// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AiRenderReferenceStyleControl } from "./AiRenderReferenceStyleControl";
import type { SavedReferenceStyle } from "@/lib/aiRenderReferenceStyle";

const REF_STYLE: SavedReferenceStyle = {
  id: "ref-1",
  mode: "section_to_axo",
  image_url: "https://example.com/old-apartment.png",
  updated_at: "2026-04-11T04:51:39.015Z",
};

describe("AiRenderReferenceStyleControl", () => {
  it("shows thumbnail, OFF state by default, opt-in toggle and delete action", () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn(async () => true);

    render(
      <AiRenderReferenceStyleControl
        currentRefStyle={REF_STYLE}
        enabled={false}
        deleting={false}
        onToggle={onToggle}
        onDelete={onDelete}
      />,
    );

    const img = screen.getByAltText("Saved reference style") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/old-apartment.png");
    expect(screen.getByText("OFF")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Apply Saved Style" }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Delete saved reference style" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("shows clear turn-off button when explicitly enabled", () => {
    render(
      <AiRenderReferenceStyleControl
        currentRefStyle={REF_STYLE}
        enabled={true}
        deleting={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("ON")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn Off Saved Style" })).toBeTruthy();
  });
});