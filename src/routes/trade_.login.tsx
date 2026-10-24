import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeLogin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/login")({
  head: () => ({ meta: [
    { title: "Trade Sign In & Access Requests — Maison Affluency" },
    { name: "description", content: "Sign in to your Maison Affluency Trade account or request access when Google sign-in is blocked." },
    { property: "og:title", content: "Trade Sign In & Access Requests — Maison Affluency" },
    { property: "og:description", content: "Sign in to your Trade account or request Google sign-in access from Maison Affluency." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={null}><TradeLogin /></Suspense>
  ),
});
