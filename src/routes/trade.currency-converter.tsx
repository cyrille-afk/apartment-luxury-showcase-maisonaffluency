import { createFileRoute } from "@tanstack/react-router";
import { TradeCurrencyConverter } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/currency-converter")({
  component: () => (
    <TradeCurrencyConverter />
  ),
});
