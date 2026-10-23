import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns a gate function that checks authentication.
 * If user is authenticated, runs the callback immediately.
 * If not, opens the AuthGateDialog.
 */
export function useAuthGate() {
  const { user, loading, isPwaBooting } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);
  const [gateAction, setGateAction] = useState<string>("download this document");
  useEffect(() => { if (isPwaBooting || user) setGateOpen(false); }, [isPwaBooting, user]);

  const requireAuth = useCallback(
    (callback: () => void, actionLabel?: string) => {
      if (loading || isPwaBooting) return; // startup owns authentication
      if (user) {
        callback();
      } else {
        setGateAction(actionLabel || "download this document");
        setGateOpen(true);
      }
    },
    [user, loading, isPwaBooting]
  );

  return {
    requireAuth,
    gateOpen: gateOpen && !isPwaBooting,
    gateAction,
    closeGate: () => setGateOpen(false),
  };
}
