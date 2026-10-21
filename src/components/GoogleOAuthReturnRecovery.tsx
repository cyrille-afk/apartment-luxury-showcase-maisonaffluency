import { useEffect } from "react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { clearGoogleAttempt, readGoogleAttempt } from "@/lib/googleSignInRecovery";

// useAuth owns successful returns; only confirmed signed-out returns recover.
export default function GoogleOAuthReturnRecovery() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) { clearGoogleAttempt(); return; }
    if (loading || location.pathname !== "/") return;
    const next = readGoogleAttempt(sessionStorage);
    if (!next) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled || error || data.session) return;
      navigate(`/trade/login?google_recovery=1&next=${encodeURIComponent(next)}`, { replace: true });
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [user, loading, location.pathname, navigate]);
  return null;
}