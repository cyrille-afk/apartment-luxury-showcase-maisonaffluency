import { describe, it, expect } from "vitest";
import { buildSpecSchedule, MISSING, type SpecScheduleItem } from "./specScheduleBuilder";

const empty: SpecScheduleItem = {
  product_name: null,
  designer: null,
  brand_name: null,
  category: null,
  subcategory: null,
  width_mm: null,
  depth_mm: null,
  height_mm: null,
  seat_height_mm: null,
  materials: null,
  available_finishes: null,
  lead_time_weeks_min: null,
  lead_time_weeks_max: null,
  lead_time: null,
  is_contract_grade: null,
  image_url: null,
  spec_sheet_url: null,
  sku: null,
};

describe("buildSpecSchedule", () => {
  it("renders the header with zone name", () => {
    const md = buildSpecSchedule("Salon", []);
    expect(md).toContain("### SPECIFICATION SCHEDULE: Salon");
    expect(md).toContain("_No items in this tearsheet._");
  });

  it("falls back to 'Untitled Zone' when zone is blank", () => {
    const md = buildSpecSchedule("   ", [{ ...empty, product_name: "X" }]);
    expect(md).toContain("### SPECIFICATION SCHEDULE: Untitled Zone");
  });

  it("renders every missing field as 'Data not found in database.'", () => {
    const md = buildSpecSchedule("Zone A", [empty]);
    // product name line
    expect(md).toContain(`**01 | ${MISSING}**`);
    // designer + brand line
    expect(md).toContain(`Designer / Brand:** ${MISSING} | ${MISSING}`);
    // category
    expect(md).toContain(`Category / Typology:** ${MISSING}`);
    // dimensions collapsed to a single MISSING
    expect(md).toContain(`Dimensions:** ${MISSING}`);
    // finishes
    expect(md).toContain(`Material & Finish Catalogue:** ${MISSING}`);
    // lead time + contract
    expect(md).toContain(`Lead Time: ${MISSING} | Contract Grade: ${MISSING}`);
    // sku
    expect(md).toContain(`SKU:** ${MISSING}`);
    // assets are two MISSING joined with |
    expect(md).toContain(`Project Documentation Assets:** ${MISSING} | ${MISSING}`);
  });

  it("renders a fully populated item verbatim from db fields, no inference", () => {
    const full: SpecScheduleItem = {
      product_name: "Elliptical Dining Table",
      designer: "Andrée Putman",
      brand_name: "Ecart International",
      category: "Dining Table",
      subcategory: "Oval",
      width_mm: 2200,
      depth_mm: 1100,
      height_mm: 740,
      seat_height_mm: 470,
      materials: "Cerused oak, patinated bronze",
      available_finishes: ["Ivory bouclé", "Oxblood mohair"],
      lead_time_weeks_min: 10,
      lead_time_weeks_max: 14,
      lead_time: "10-14 weeks",
      is_contract_grade: true,
      image_url: "https://cdn.example.com/table.jpg",
      spec_sheet_url: "https://cdn.example.com/table.pdf",
      sku: "EIT-2200-OV",
    };
    const md = buildSpecSchedule("Dining Room A", [full]);
    expect(md).toContain("### SPECIFICATION SCHEDULE: Dining Room A");
    expect(md).toContain("**01 | Elliptical Dining Table**");
    expect(md).toContain("Designer / Brand:** Andrée Putman | Ecart International");
    expect(md).toContain("Category / Typology:** Dining Table / Oval");
    expect(md).toContain("Dimensions:** W: 2200mm x D: 1100mm x H: 740mm (Seat: 470mm)");
    expect(md).toContain(
      "Material & Finish Catalogue:** Cerused oak, patinated bronze | Ivory bouclé, Oxblood mohair"
    );
    expect(md).toContain("Lead Time: 10-14 weeks | Contract Grade: Yes");
    expect(md).toContain("SKU:** EIT-2200-OV");
    expect(md).toContain("[Image](https://cdn.example.com/table.jpg)");
    expect(md).toContain("[CAD/Spec](https://cdn.example.com/table.pdf)");
    expect(md).not.toContain(MISSING);
  });

  it("uses lead_time free-text when numeric bounds are missing", () => {
    const item: SpecScheduleItem = {
      ...empty,
      product_name: "X",
      lead_time: "Limited Edition 8 + 2 AP",
    };
    const md = buildSpecSchedule("Z", [item]);
    expect(md).toContain("Lead Time: Limited Edition 8 + 2 AP");
  });

  it("renders contract grade false as 'No', not MISSING", () => {
    const item: SpecScheduleItem = { ...empty, product_name: "X", is_contract_grade: false };
    const md = buildSpecSchedule("Z", [item]);
    expect(md).toContain("Contract Grade: No");
  });

  it("separates multiple items with a horizontal rule", () => {
    const md = buildSpecSchedule("Z", [
      { ...empty, product_name: "A" },
      { ...empty, product_name: "B" },
    ]);
    expect(md).toMatch(/\*\*01 \| A\*\*[\s\S]+---[\s\S]+\*\*02 \| B\*\*/);
  });
});
