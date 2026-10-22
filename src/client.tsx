// Custom client entry. `paintGate` must stay the first import: it lets the
// browser paint the server-rendered page before the app code is evaluated and
// hydrated (mobile First Contentful Paint budget in scripts/lighthouse-mobile.mjs).
import "./lib/paintGate";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
