import { createFileRoute } from "@tanstack/react-router";
import { ShowroomLegacyRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/archive")({
  component: () => (
    <ShowroomLegacyRedirect />
  ),
});
