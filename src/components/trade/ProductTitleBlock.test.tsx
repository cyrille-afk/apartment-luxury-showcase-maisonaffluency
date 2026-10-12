import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { ProductTitleBlock } from "./ProductTitleBlock";

describe("ProductTitleBlock", () => {
  it("renders the edition badge below the product title", () => {
    const { container } = render(
      <ProductTitleBlock
        title="Gleam Suspension"
        subtitleLine={null}
        product={{ edition: "Edition of 48" }}
        isEcartProduct={false}
        showBadge
      />
    );
    const h1 = container.querySelector("h1");
    const badge = Array.from(container.querySelectorAll("span")).find((el) =>
      el.textContent?.includes("Edition of 48")
    );
    expect(h1?.textContent).toContain("Gleam Suspension");
    expect(badge).toBeTruthy();
    // Badge must follow the title in DOM order (never above the designer name).
    expect(h1!.compareDocumentPosition(badge!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no badge when the product has no edition", () => {
    const { container } = render(
      <ProductTitleBlock
        title="Gleam Suspension"
        subtitleLine={null}
        product={{ edition: null }}
        isEcartProduct={false}
        showBadge
      />
    );
    expect(container.textContent).not.toContain("Edition");
  });

  it("hides the badge when showBadge is false", () => {
    const { container } = render(
      <ProductTitleBlock
        title="Gleam Suspension"
        subtitleLine={null}
        product={{ edition: "Edition of 48" }}
        isEcartProduct={false}
        showBadge={false}
      />
    );
    expect(container.textContent).not.toContain("Edition of 48");
  });
});
