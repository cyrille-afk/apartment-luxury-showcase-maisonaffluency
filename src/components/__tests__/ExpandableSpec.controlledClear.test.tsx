import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Layers } from "lucide-react";
import ExpandableSpec from "@/components/ExpandableSpec";

describe("ExpandableSpec controlled clearing", () => {
  it("returns the trigger to the placeholder after a controlled value is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpandableSpec
        icon={<Layers />}
        text={"Lacquer\nSand-Blasted Ash Table Surface"}
        placeholder="Select your top finish"
        value={0}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Lacquer");

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Clear selection"));
    expect(onChange).toHaveBeenCalledWith(-1);

    rerender(
      <ExpandableSpec
        icon={<Layers />}
        text={"Lacquer\nSand-Blasted Ash Table Surface"}
        placeholder="Select your top finish"
        value={null}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Select your top finish");
    expect(screen.getByRole("combobox")).not.toHaveTextContent("Lacquer");
  });
});