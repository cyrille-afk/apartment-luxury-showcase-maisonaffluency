import { createFileRoute } from "@tanstack/react-router";
import { TradeTearsheets } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/tearsheets")({
  component: () => (
    <TradeTearsheets />
  ),
});
