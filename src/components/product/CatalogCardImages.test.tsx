import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CatalogCardImages from "./CatalogCardImages";

describe("catalogue alternate readiness", () => {
  afterEach(() => vi.restoreAllMocks());
  const props = { primary: "/primary.jpg", alternate: "/alternate.jpg", alt: "Chair", sizes: "25vw", room: false };
  it("preloads the hidden image on mount and gates swaps on successful decoding", async () => {
    const decode = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: decode });
    const { container } = render(<CatalogCardImages {...props} />);
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[1].getAttribute("loading")).toBe("eager");
    expect(images[1].getAttribute("fetchpriority")).toBe("low");
    expect(images[0].className).not.toContain("group-hover:opacity-0");
    Object.defineProperty(images[1], "naturalWidth", { value: 600 });
    fireEvent.load(images[1]);
    await waitFor(() => expect(images[1].dataset.alternateReady).toBe("true"));
    expect(decode).toHaveBeenCalled();
    expect(images[0].className).toContain("group-hover:opacity-0");
    expect(images[1].className).toContain("group-focus-visible:opacity-100");
  });
  it("keeps the primary visible on failed alternate decoding", async () => {
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: vi.fn().mockRejectedValue(new Error("broken photo")) });
    const { container } = render(<CatalogCardImages {...props} />);
    const images = container.querySelectorAll("img");
    fireEvent.load(images[1]);
    await waitFor(() => expect(images[1].dataset.alternateReady).toBe("false"));
    expect(images[0].className).not.toContain("group-hover:opacity-0");
  });
  it("never hides primary-only pieces", () => {
    const { container } = render(<CatalogCardImages {...props} alternate={undefined} />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")?.className).not.toContain("group-hover:opacity-0");
  });
});