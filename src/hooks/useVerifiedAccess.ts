import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the current user is a verified trade professional
 * or an approved private collector (or admin). Anonymous users → false.
 */
export function useVerifiedAccess() {
  const { user, loading: authLoading } = useAuth();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setVerified(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("has_verified_access", { _user_id: user.id });
      if (cancelled) return;
      if (error) {
        setVerified(false);
      } else {
        setVerified(!!data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { verified, loading: authLoading || loading, user };
}
