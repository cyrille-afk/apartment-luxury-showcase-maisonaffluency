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

// Homepage: let the browser paint the inline static hero before hydration
// takes over the main thread. Other pages hydrate immediately as before.
if (window.location.pathname === "/") {
  requestAnimationFrame(() => setTimeout(hydrate, 0));
} else {
  hydrate();
}
