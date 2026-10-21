import { createFileRoute } from "@tanstack/react-router";
import { LegacyStephGcRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/designers_/stephane-cg_/$productSlug")({
  component: () => (
    <LegacyStephGcRedirect />
  ),
});
