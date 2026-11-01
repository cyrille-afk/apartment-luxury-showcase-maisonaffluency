import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { useShippingDestination } from "./shippingDestination";

function Destination() {
  const destination = useShippingDestination();
  return <span data-testid="destination">{destination.iso}</span>;
}
afterEach(() => { cleanup(); localStorage.clear(); });

it("keeps the initial render stable and restores the saved country after mounting", () => {
  localStorage.setItem("trade.detectedCountry", "SG");
  expect(renderToString(<Destination />)).toContain(">GB<");
  render(<Destination />);
  expect(screen.getByTestId("destination").textContent).toBe("SG");
});