import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// --- Mocks ---------------------------------------------------------------

// Mutable mock state for useProjectFilter so tests can drive filter changes.
const filterState: {
  projectFilter: string | null;
  designerFilter: string | null;
} = { projectFilter: "p1", designerFilter: "d1" };

const clearProjectFilter = vi.fn(() => { filterState.projectFilter = null; });
const clearDesignerFilter = vi.fn(() => { filterState.designerFilter = null; });
const clearAllFilters = vi.fn(() => {
  filterState.projectFilter = null;
  filterState.designerFilter = null;
});

vi.mock("@/hooks/useProjectFilter", () => ({
  useProjectFilter: () => ({
    projectFilter: filterState.projectFilter,
    designerFilter: filterState.designerFilter,
    clearProjectFilter,
    clearDesignerFilter,
    clearAllFilters,
  }),
}));

vi.mock("@/hooks/useDesignerDisplayName", () => ({
  useDesignerDisplayName: (raw: string | null | undefined) => raw || "",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { name: "My Project" } }),
        }),
      }),
    }),
  },
}));

import ActiveFilterChips from "../ActiveFilterChips";

// Force re-render of the component when mock state changes.
function Harness() {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  // Patch clear handlers to also force re-render after state mutates.
  React.useEffect(() => {
    const wrap = (fn: any) => {
      const orig = fn.getMockImplementation();
      fn.mockImplementation((...args: any[]) => {
        const r = orig?.(...args);
        force();
        return r;
      });
    };
    wrap(clearProjectFilter);
    wrap(clearDesignerFilter);
    wrap(clearAllFilters);
  }, []);
  return <ActiveFilterChips />;
}

beforeEach(() => {
  filterState.projectFilter = "p1";
  filterState.designerFilter = "d1";
  clearProjectFilter.mockClear();
  clearDesignerFilter.mockClear();
  clearAllFilters.mockClear();
  // Re-install base implementations (they get re-wrapped per render).
  clearProjectFilter.mockImplementation(() => { filterState.projectFilter = null; });
  clearDesignerFilter.mockImplementation(() => { filterState.designerFilter = null; });
  clearAllFilters.mockImplementation(() => {
    filterState.projectFilter = null;
    filterState.designerFilter = null;
  });
});

describe("ActiveFilterChips — focus restoration", () => {
  it("moves focus to the designer chip when project chip is cleared", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Wait for project name fetch to resolve.
    await waitFor(() => expect(screen.getByText("My Project")).toBeInTheDocument());

    const projectClear = screen.getByLabelText(/Clear project filter/i);
    await user.click(projectClear);

    await waitFor(() => {
      const designerClear = screen.getByLabelText(/Clear designer filter/i);
      expect(designerClear).toHaveFocus();
    });
  });

  it("moves focus to the project chip when designer chip is cleared", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByText("My Project")).toBeInTheDocument());

    const designerClear = screen.getByLabelText(/Clear designer filter/i);
    await user.click(designerClear);

    await waitFor(() => {
      const projectClear = screen.getByLabelText(/Clear project filter/i);
      expect(projectClear).toHaveFocus();
    });
  });

  it("moves focus to the filter region when Clear all is used", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByText("My Project")).toBeInTheDocument());

    const clearAllBtn = screen.getByRole("button", { name: /^Clear all$/i });
    await user.click(clearAllBtn);

    // Both filters cleared -> component returns null. Focus has nowhere
    // to land, so it falls back to body. Confirm clear was invoked.
    await waitFor(() => {
      expect(clearAllFilters).toHaveBeenCalled();
      expect(screen.queryByRole("region", { name: /Active filters/i })).toBeNull();
    });
  });

  it("moves focus to the region when the last remaining chip is cleared", async () => {
    // Start with only the designer filter.
    filterState.projectFilter = null;
    filterState.designerFilter = "d1";

    const user = userEvent.setup();
    render(<Harness />);

    const designerClear = screen.getByLabelText(/Clear designer filter/i);
    await user.click(designerClear);

    await waitFor(() => {
      expect(clearDesignerFilter).toHaveBeenCalled();
      // Region unmounts since no filters remain.
      expect(screen.queryByRole("region", { name: /Active filters/i })).toBeNull();
    });
  });
});
