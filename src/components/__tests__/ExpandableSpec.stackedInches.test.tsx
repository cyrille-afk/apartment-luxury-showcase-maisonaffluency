import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Layers } from "lucide-react";
import ExpandableSpec from "@/components/ExpandableSpec";
import { withImperialStacked } from "@/lib/formatDimensions";

describe("ExpandableSpec stacked imperial pairing", () => {
  it("pairs a stacked inch line with its mm metric line instead of duplicating the conversion", () => {
    // Alda Table Lamp: variant label "Ø350 x H 640mm" → withImperialStacked
    // emits the metric line plus one imperial line. The inch line must merge
    // into the metric option so DimensionText renders the inches once.
    render(
      <ExpandableSpec
        icon={<Layers />}
        text={withImperialStacked("Ø350 x H 640mm")}
      />,
    );

    expect(screen.getAllByText(/25\.2 in/)).toHaveLength(1);
    expect(screen.getByText(/640mm/)).toBeInTheDocument();
  });

  it("still pairs stacked inch lines for cm metric rows", () => {
    render(
      <ExpandableSpec
        icon={<Layers />}
        text={withImperialStacked("W 90 × D 92 × H 78 cm")}
      />,
    );

    expect(screen.getAllByText(/30\.7 in/)).toHaveLength(1);
  });
});
