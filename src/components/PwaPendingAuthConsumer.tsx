import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { redeemMobileSyncToken } from "@/lib/mobileSync.functions";
import { readPendingAuthToken, clearPendingAuthToken } from "@/lib/pwaPendingAuth";
import { isPwaStandaloneDisplay } from "@/lib/pwaMode";

/**
 * Runs once at app start inside the installed PWA. If the mobile browser
 * bridge parked a one-time sign-in token (ma_pwa_pending_auth_token), redeem
 * it here, establish the session, and land on the trade dashboard. Expired or
 * absent tokens are cleared/ignored silently.
 */
export function PwaPendingAuthConsumer() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!isPwaStandaloneDisplay()) return;

    const token = readPendingAuthToken();
    if (!token) return;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          clearPendingAuthToken();
          return;
        }
        const res = await redeemMobileSyncToken({ data: { token } });
        if (!res.ok) {
          clearPendingAuthToken();
          return;
        }
        const { error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
        clearPendingAuthToken();
        if (!error) navigate({ to: "/trade", replace: true });
      } catch {
        clearPendingAuthToken();
      }
    })();
  }, [navigate]);

  return null;
}
