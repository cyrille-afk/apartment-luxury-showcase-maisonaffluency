import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns a gate function that checks authentication.
 * If user is authenticated, runs the callback immediately.
 * If not, opens the AuthGateDialog.
 */
export function useAuthGate() {
  const { user, loading } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);
  const [gateAction, setGateAction] = useState<string>("download this document");

  const requireAuth = useCallback(
    (callback: () => void, actionLabel?: string) => {
      if (loading) return; // still loading, ignore
      if (user) {
        callback();
      } else {
        setGateAction(actionLabel || "download this document");
        setGateOpen(true);
      }
    },
    [user, loading]
  );

  return {
    requireAuth,
    gateOpen,
    gateAction,
    closeGate: () => setGateOpen(false),
  };
}
