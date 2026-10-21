import { createFileRoute } from "@tanstack/react-router";
import { TradeStudioSettings } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/settings_/studio")({
  component: () => (
    <TradeStudioSettings />
  ),
});
