import { createFileRoute } from "@tanstack/react-router";
import { TradeMoodBoards } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/mood-boards")({
  head: () => ({ meta: [
    { title: "Mood Board Builder | Maison Affluency Trade" },
    { name: "description", content: "Curate Maison Affluency room mood boards around pinned furniture anchors, live budgets and complementary pieces, then save your selection to Project Studio for finishes and AI pairings." },
    { property: "og:title", content: "Mood Board Builder | Maison Affluency Trade" },
    { property: "og:description", content: "Compose budget-aware mood boards, then refine catalogue finishes and AI pairings in Project Studio before Visualiser exploration." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeMoodBoards />
  ),
});
