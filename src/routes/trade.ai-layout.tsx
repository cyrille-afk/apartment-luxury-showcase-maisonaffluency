import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeAILayoutStudio } from "@/app/legacyShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/trade/ai-layout")({
  head: () => ({ meta: [
    { title: "Curated Room Layout | Maison Affluency Trade" },
    { name: "description", content: "Prepare and review a curated furniture layout in your Maison Affluency studio." },
    { property: "og:title", content: "Curated Room Layout | Maison Affluency Trade" },
    { property: "og:description", content: "Prepare and review your studio’s curated furniture layout." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => (
    <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-foreground"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" /><h1 className="font-display text-2xl">Curated Room Layout</h1><p className="text-sm text-muted-foreground">Opening your room…</p></div>}><TradeAILayoutStudio /></Suspense>
  ),
});
