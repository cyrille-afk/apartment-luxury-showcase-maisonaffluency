import { useEffect, useState } from "react";
import { loadName, DEFAULT_NAME } from "@/components/trade/conciergeGreeting";

/**
 * Single source of truth for the AI guide's display name across the portal.
 * Defaults to "Felix" and reacts instantly to renames (settings form, concierge
 * rename flow, onboarding) as well as to changes made in another tab.
 */
export function useAIGuideName(): string {
  const [name, setName] = useState<string>(() => {
    try { return loadName() || DEFAULT_NAME; } catch { return DEFAULT_NAME; }
  });

  useEffect(() => {
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) setName(detail.trim());
      else setName(loadName() || DEFAULT_NAME);
    };
    const onStorage = () => setName(loadName() || DEFAULT_NAME);
    window.addEventListener("concierge:name-changed", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("concierge:name-changed", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return name;
}

export { DEFAULT_NAME };
