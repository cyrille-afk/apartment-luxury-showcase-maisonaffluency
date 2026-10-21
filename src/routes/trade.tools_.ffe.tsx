import { createFileRoute } from "@tanstack/react-router";
import { TradeFfeTool } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/tools_/ffe")({
  component: () => (
    <TradeFfeTool />
  ),
});
