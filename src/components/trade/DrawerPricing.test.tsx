import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import DrawerPricing from "./DrawerPricing";
import PresentationModeToggle from "./PresentationModeToggle";
import { setClientSafeMode } from "@/lib/clientSafeMode";

afterEach(() => { cleanup(); setClientSafeMode(false); });
it("shows €22,500 retail and €20,340 net, then removes net instantly from the drawer", () => {
  setClientSafeMode(false);
  render(<><PresentationModeToggle /><DrawerPricing retailLabel="€22,500" netLabel="€20,340" /></>);
  expect(screen.getByText("€22,500")).toBeTruthy();
  expect(screen.getByText("€20,340")).toBeTruthy();
  fireEvent.click(screen.getByRole("switch", { name: "Presentation Mode" }));
  expect(screen.queryByText("€20,340")).toBeNull();
  expect(screen.getByText("€22,500")).toBeTruthy();
  fireEvent.click(screen.getByRole("switch", { name: "Presentation Mode" }));
  expect(screen.getByText("€20,340")).toBeTruthy();
});
it("never substitutes a saved net snapshot for unknown retail in Presentation", () => {
  setClientSafeMode(true);
  render(<DrawerPricing netLabel="€20,340" />);
  expect(screen.queryByText("€20,340")).toBeNull();
  expect(screen.getByText("Price upon Request")).toBeTruthy();
});