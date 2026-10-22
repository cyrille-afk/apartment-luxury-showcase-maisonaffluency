// Custom client entry: hydrate only after the browser has painted the
// server-rendered page. Hydrating synchronously at module load ran a ~400ms
// task before first paint and pushed mobile First Contentful Paint over budget.
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

const hydrate = () =>
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });

if (typeof requestAnimationFrame === "function") {
  requestAnimationFrame(() => setTimeout(hydrate, 0));
} else {
  setTimeout(hydrate, 0);
}
