import { createFileRoute } from "@tanstack/react-router";
import { LegacyTradeDesignerRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/designers_/$slug")({
  component: () => (
    <LegacyTradeDesignerRedirect />
  ),
});
