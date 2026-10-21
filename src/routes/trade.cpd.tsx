import { createFileRoute } from "@tanstack/react-router";
import { TradeCPD } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/cpd")({
  component: () => (
    <TradeCPD />
  ),
});
