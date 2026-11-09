import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ProductCardActions from "./ProductCardActions";

vi.mock("@tanstack/react-router", () => ({ Link: ({ to, params, children }: any) => <a href={to.replace("$id", params.id || "").replace("$slug", params.slug || "").replace("$productSlug", params.productSlug || "")}>{children}</a> }));
vi.mock("./TradeFavoriteFolderPicker", () => ({ default: ({ children }: any) => children }));
afterEach(() => { cleanup(); });
it("links configuration to the dedicated product page without opening a modal", () => {
  render(<ProductCardActions productId="product-77" designerSlug="michel-amar-studio" productSlug="jules-jim-chair" meta={{ product_name: "Jules & Jim Chair", brand_name: "Michel Amar Studio" }} />);
  const link = screen.getByRole("link", { name: "Configure & Quote" });
  expect(link.getAttribute("href")).toBe("/trade/products/product-77");
  fireEvent.click(link);
  expect(screen.queryByRole("dialog")).toBeNull();
});