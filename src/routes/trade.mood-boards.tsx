import { createFileRoute } from "@tanstack/react-router";
import { TradeMoodBoards } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/mood-boards")({
  head: () => ({ meta: [
    { title: "Mood Board Builder | Maison Affluency Trade" },
    { name: "description", content: "Curate Maison Affluency room mood boards around pinned furniture anchors, live EUR budgets and complementary pieces, then explore your selection in the Visualiser Sandbox." },
    { property: "og:title", content: "Mood Board Builder | Maison Affluency Trade" },
    { property: "og:description", content: "Compose budget-aware room mood boards with pinned anchors, considered complements and direct Visualiser exploration." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeMoodBoards />
  ),
});
