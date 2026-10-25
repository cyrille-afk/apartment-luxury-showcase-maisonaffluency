import { createFileRoute } from "@tanstack/react-router";
import { TradeTearsheets } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/tearsheets")({
  head: () => ({ meta: [
    { title: "Project Tearsheet Builder — Maison Affluency" },
    { name: "description", content: "Prepare product tearsheets and save selected pieces to project boards in your Maison Affluency studio." },
    { property: "og:title", content: "Project Tearsheet Builder — Maison Affluency" },
    { property: "og:description", content: "Prepare product tearsheets and save selected pieces to project boards in your Maison Affluency studio." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeTearsheets />
  ),
});
