import { createFileRoute } from "@tanstack/react-router";
import { launchManifestResponse } from "@/lib/pwaLaunchManifest";

export const Route = createFileRoute("/mobile-manifest.json")({
  server: {
    handlers: { GET: ({ request }) => launchManifestResponse(request) },
  },
});