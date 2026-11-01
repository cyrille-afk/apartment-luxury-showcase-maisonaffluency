import { createFileRoute } from "@tanstack/react-router";
import { TradeDesigners } from "@/app/legacyShell";
import { buildPageHead } from "@/lib/pageHead";

export const Route = createFileRoute("/trade/designers")({
  head: () => buildPageHead({
    title: "Trade Designers & Ateliers — Maison Affluency",
    description: "Browse designer and atelier collections in the Maison Affluency Trade library.",
    path: "/trade/designers",
  }),
  component: () => (
    <TradeDesigners />
  ),
});
