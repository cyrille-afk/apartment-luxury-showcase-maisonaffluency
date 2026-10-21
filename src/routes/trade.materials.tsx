import { createFileRoute } from "@tanstack/react-router";
import { TradeMaterialLibrary } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/materials")({
  component: () => (
    <TradeMaterialLibrary />
  ),
});
