import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ProductCardActions from "./ProductCardActions";

const opened = vi.hoisted(() => vi.fn());
vi.mock("@/pages/TradeProductPage", () => ({ default: ({ embeddedProduct }: any) => { opened(embeddedProduct); return <div role="region" aria-label="Finish configuration" />; } }));
vi.mock("./TradeFavoriteFolderPicker", () => ({ default: ({ children }: any) => children }));
afterEach(() => { cleanup(); opened.mockClear(); });
it("opens the clicked product in-place without mounting configuration ahead of the action", async () => {
  render(<ProductCardActions productId="product-77" designerSlug="michel-amar-studio" productSlug="jules-jim-chair" meta={{ product_name: "Jules & Jim Chair", brand_name: "Michel Amar Studio" }} />);
  expect(opened).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Configure & Quote" }));
  await screen.findByRole("region", { name: "Finish configuration" });
  expect(opened).toHaveBeenCalledWith({ id: "product-77", designerSlug: "michel-amar-studio", productSlug: "jules-jim-chair" });
});