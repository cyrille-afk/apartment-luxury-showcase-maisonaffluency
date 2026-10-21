import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { OAuthConsent } from "@/app/legacyShell";

export const Route = createFileRoute("/.lovable_/oauth_/consent")({
  component: () => (
    <Suspense fallback={null}><OAuthConsent /></Suspense>
  ),
});
