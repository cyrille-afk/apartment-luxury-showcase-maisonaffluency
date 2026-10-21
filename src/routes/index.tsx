import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Index } from "@/app/legacyShell";

export const Route = createFileRoute("/")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.home),
  component: () => (
    <Index />
  ),
});
