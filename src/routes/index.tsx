import { createFileRoute } from "@tanstack/react-router";
import { Index } from "@/app/legacyShell";

export const Route = createFileRoute("/")({
  component: () => (
    <Index />
  ),
});
