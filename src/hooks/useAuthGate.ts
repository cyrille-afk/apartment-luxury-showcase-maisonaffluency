import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { customerSavedSync } from "@/lib/customerSavedSync";
import { useToast } from "@/hooks/use-toast";

/**
 * Returns a gate function that checks authentication.
 * If user is authenticated, runs the callback immediately.
 * If not, opens the AuthGateDialog.
 */
export function useAuthGate() {
  const { user, loading, isPwaBooting } = useAuth();
  const { toast } = useToast();
  const [gateOpen, setGateOpen] = useState(false);
  const [gateAction, setGateAction] = useState<string>("download this document");
  useEffect(() => { if (isPwaBooting || user) setGateOpen(false); }, [isPwaBooting, user]);

  const requireAuth = useCallback(
    (callback: () => void, actionLabel?: string) => {
      if (loading || isPwaBooting) return; // startup owns authentication
      if (user) {
        if (/favorite|folder|save pieces/i.test(actionLabel ?? "")) {
          const saved = customerSavedSync.getState();
          if (saved.userId !== user.id || saved.status === "loading" || saved.status === "error") {
            toast({ title: "Your saved collection", description: "Your saved pieces are reconnecting. Please try again shortly." });
            void customerSavedSync.retry();
            return;
          }
        }
        callback();
      } else {
        setGateAction(actionLabel || "download this document");
        setGateOpen(true);
      }
    },
    [user, loading, isPwaBooting, toast]
  );

  return {
    requireAuth,
    gateOpen: gateOpen && !isPwaBooting,
    gateAction,
    closeGate: () => setGateOpen(false),
  };
}
