// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { AiRenderHistoryPanel } from "./AiRenderHistoryPanel";
import { AiRenderCompareDialog } from "./AiRenderCompareDialog";
import {
  resolveComparePair,
  toggleCompareSelection,
  type AiRenderHistoryEntry,
  type ProjectScopeFilter,
} from "@/lib/aiRenderHistory";

const ENTRIES: AiRenderHistoryEntry[] = [
  {
    id: "r1",
    created_by: "u1",
    project_id: "p1",
    project_name: "Cipriani Miami",
    proposal_id: null,
    request_id: null,
    source_image_url: "https://example.com/plan.png",
    result_image_url: "https://example.com/render-a.png",
    mode: "stylize",
    style_preset: "Editorial Luxury",
    style_prompt: "editorial",
    quality_tier: "premium",
    prompt_note: "Warm evening brass",
    kind: "generation",
    metadata: {},
    created_at: "2026-11-25T01:00:00.000Z",
  },
  {
    id: "r2",
    created_by: "u1",
    project_id: "p1",
    project_name: "Cipriani Miami",
    proposal_id: null,
    request_id: null,
    source_image_url: "https://example.com/plan.png",
    result_image_url: "https://example.com/render-b.png",
    mode: "freeform",
    style_preset: "Photorealistic",
    style_prompt: "photo",
    quality_tier: "standard",
    prompt_note: "Ivory boucle sofa",
    kind: "ai_edit",
    metadata: {},
    created_at: "2026-11-25T01:10:00.000Z",
  },
  {
    id: "r3",
    created_by: "u1",
    project_id: "p2",
    project_name: "37A",
    proposal_id: null,
    request_id: null,
    source_image_url: "https://example.com/37a.png",
    result_image_url: "https://example.com/render-c.png",
    mode: "elevation_to_axo",
    style_preset: "Scandinavian",
    style_prompt: "scandi",
    quality_tier: "draft",
    prompt_note: "Dining draft",
    kind: "generation",
    metadata: {},
    created_at: "2026-11-25T01:20:00.000Z",
  },
];

const PROJECTS = [
  { id: "p1", name: "Cipriani Miami", client_name: null },
  { id: "p2", name: "37A", client_name: null },
];

function Harness({
  onReopen,
  onDelete,
}: {
  onReopen: (entry: AiRenderHistoryEntry) => void;
  onDelete: (entry: AiRenderHistoryEntry) => void;
}) {
  const [scope, setScope] = useState<ProjectScopeFilter>("p1");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const pair = resolveComparePair(ENTRIES, compareIds);

  return (
    <>
      <AiRenderHistoryPanel
        entries={ENTRIES}
        loading={false}
        projects={PROJECTS}
        scope={scope}
        onScopeChange={setScope}
        activeResultUrl={ENTRIES[0]!.result_image_url}
        compareIds={compareIds}
        onToggleCompare={(id) => setCompareIds((prev) => toggleCompareSelection(prev, id))}
        onOpenCompare={() => setCompareOpen(true)}
        onClearCompare={() => setCompareIds([])}
        onReopen={onReopen}
        onDelete={onDelete}
        deletingId={null}
      />
      <AiRenderCompareDialog
        open={compareOpen && !!pair}
        onOpenChange={setCompareOpen}
        pair={pair}
        onReopen={onReopen}
      />
    </>
  );
}

describe("AiRenderHistoryPanel & AiRenderCompareDialog", () => {
  it("filters history by project, compares two renders in side-by-side and slider modes, and reopens either version", () => {
    const onReopen = vi.fn();
    const onDelete = vi.fn();
    render(<Harness onReopen={onReopen} onDelete={onDelete} />);

    // Scoped to Cipriani Miami (p1): 2 renders shown, 37A hidden
    expect(screen.getByText("Warm evening brass")).toBeTruthy();
    expect(screen.getByText("Ivory boucle sofa")).toBeTruthy();
    expect(screen.queryByText("Dining draft")).toBeNull();

    // Switch filter to 37A (p2)
    fireEvent.change(screen.getByLabelText("Filter render history by project"), { target: { value: "p2" } });
    expect(screen.getByText("Dining draft")).toBeTruthy();
    expect(screen.queryByText("Warm evening brass")).toBeNull();

    // Switch back to Cipriani Miami and pick both renders to compare
    fireEvent.change(screen.getByLabelText("Filter render history by project"), { target: { value: "p1" } });
    const compareBtns = screen.getAllByRole("button", { name: "Compare" });
    expect(compareBtns).toHaveLength(2);
    fireEvent.click(compareBtns[0]!);
    fireEvent.click(compareBtns[1]!);

    fireEvent.click(screen.getByRole("button", { name: "Compare 2 Renders" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Compare Renders")).toBeTruthy();

    // Switch to Split Slider & swap A / B, then reopen A (now r2)
    fireEvent.click(screen.getByRole("button", { name: "Split Slider" }));
    expect(screen.getByLabelText("Comparison split position")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Swap A / B" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen A" }));
    expect(onReopen).toHaveBeenCalledWith(ENTRIES[1]);
  });

  it("forwards delete clicks with the matching history entry", () => {
    const onReopen = vi.fn();
    const onDelete = vi.fn();
    render(<Harness onReopen={onReopen} onDelete={onDelete} />);

    const deleteBtns = screen.getAllByRole("button", { name: "Delete render from history" });
    fireEvent.click(deleteBtns[0]!);
    expect(onDelete).toHaveBeenCalledWith(ENTRIES[0]);
  });
});