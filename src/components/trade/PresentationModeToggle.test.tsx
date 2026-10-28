import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import PresentationModeToggle from "./PresentationModeToggle";
import { getClientSafeMode, setClientSafeMode } from "@/lib/clientSafeMode";

afterEach(() => { cleanup(); setClientSafeMode(false); });
it("synchronizes product and drawer switches with the shared client price guard", () => {
  setClientSafeMode(false);
  render(<><section aria-label="Product"><PresentationModeToggle /></section><section aria-label="Drawer"><PresentationModeToggle /></section></>);
  fireEvent.click(screen.getByRole("region", { name: "Product" }).querySelector("button") as HTMLButtonElement);
  expect(getClientSafeMode()).toBe(true);
  expect(screen.getAllByRole("switch", { name: "Presentation Mode" }).map(s => s.getAttribute("aria-checked"))).toEqual(["true", "true"]);
  fireEvent.click(screen.getByRole("region", { name: "Drawer" }).querySelector("button") as HTMLButtonElement);
  expect(getClientSafeMode()).toBe(false);
  expect(document.documentElement.dataset.clientView).toBe("inactive");
});