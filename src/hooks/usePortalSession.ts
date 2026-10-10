import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "portal_cn_session_v1";

export type PortalSession = {
  token: string;
  expiresAt: string;
  corporateId?: string;
  invitedName?: string | null;
  invitedCompany?: string | null;
};

export function readPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalSession;
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePortalSession(s: PortalSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearPortalSession() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Validate portal session token against the backend. */
export function usePortalSession() {
  const [session, setSession] = useState<PortalSession | null>(() => readPortalSession());
  const [checking, setChecking] = useState<boolean>(!!session);
  const [valid, setValid] = useState<boolean | null>(session ? null : false);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setValid(false);
      setChecking(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("validate_portal_session", { _token: session.token });
      if (cancelled) return;
      const ok = !error && (data as any)?.valid === true;
      setValid(ok);
      setChecking(false);
      if (!ok) {
        clearPortalSession();
      } else {
        // Keep the short-lived brief capability fresh (server renews it when
        // it is missing or expiring soon) and record the session id.
        const d = data as any;
        if (d.session_id) sessionStorage.setItem("cn_portal:session_id", d.session_id);
        if (d.brief_capability) sessionStorage.setItem("cn_portal:brief_cap", d.brief_capability);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  return { session, setSession, valid, checking };
}
