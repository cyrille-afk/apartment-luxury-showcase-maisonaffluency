import { createFileRoute } from "@tanstack/react-router";
import { TradeApplyRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/trade-program_/apply")({
  component: () => (
    <TradeApplyRedirect />
  ),
});
