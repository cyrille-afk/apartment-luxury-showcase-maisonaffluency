import { createFileRoute } from "@tanstack/react-router";
import { TradeMoodBoards } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/mood-boards")({
  head: () => ({ meta: [
    { title: "Mood Board Builder | Maison Affluency Trade" },
    { name: "description", content: "Curate Maison Affluency furniture, lighting and materials into project mood boards with considered complementary pieces." },
    { property: "og:title", content: "Mood Board Builder | Maison Affluency Trade" },
    { property: "og:description", content: "Browse the trade catalogue and compose project mood boards with furniture-led complements." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeMoodBoards />
  ),
});
