import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ExpandableSpec from "@/components/ExpandableSpec";

describe("material options containing ordinary in", () => {
  it("keeps a materials sentence separately selectable after a measured option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ExpandableSpec
      icon={null}
      text={"Oak frame, 2 cm thick\nFrame upholstered in bouclé, legs in solid oak"}
      placeholder="Select your material choice"
      onChange={onChange}
    />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Frame upholstered in bouclé, legs in solid oak" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});