import { createFileRoute } from "@tanstack/react-router";
import { TradeDownloadsByCountry } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/downloads-by-country")({
  component: () => (
    <TradeDownloadsByCountry />
  ),
});
