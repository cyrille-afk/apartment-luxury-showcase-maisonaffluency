import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeLogin } from "@/app/legacyShell";
import { normalizedTradeLoginSearch } from "@/lib/tradeLoginReturn";

export const Route = createFileRoute("/trade_/login")({
  beforeLoad: ({ location }) => {
    const search = normalizedTradeLoginSearch(location.searchStr);
    if (search) throw redirect({ to: "/trade/login", search, replace: true });
  },
  head: () => ({ meta: [
    { title: "Trade Sign In & Access Requests — Maison Affluency" },
    { name: "description", content: "Sign in to your Maison Affluency Trade account or request access when Google sign-in is blocked." },
    { property: "og:title", content: "Trade Sign In & Access Requests — Maison Affluency" },
    { property: "og:description", content: "Sign in to your Trade account or request Google sign-in access from Maison Affluency." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "index, follow" },
    { property: "og:url", content: "https://www.maisonaffluency.com/trade/login" },
  ] }),
  component: () => (
    <Suspense fallback={null}><TradeLogin /></Suspense>
  ),
});
