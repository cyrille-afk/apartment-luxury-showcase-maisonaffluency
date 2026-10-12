import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CONSENT_EVENT, hasConsent } from '@/lib/consent/consentStore';

export default function ClientCurrencyDetection() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let running = false;
    let completed = false;
    const detect = async () => {
      if (running || completed || !hasConsent('functional')) return;
      running = true;
      try {
        // Only call with a live session token; an expired/missing one yields 401.
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token || (sess.session?.expires_at ?? 0) * 1000 < Date.now()) return;
        const { data, error } = await supabase.functions.invoke('detect-client-currency', {
          body: { functionalConsent: true },
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = (error as { context?: { status?: number } } | null)?.context?.status;
        // Stop retrying on auth failure or backend timeout for this page load.
        if (status === 401 || status === 504) { completed = true; return; }
        completed = !error && data?.saved === true;
        if (completed) window.dispatchEvent(new Event('client-ip-currency-saved'));
      } catch { /* Retry on focus; never block the client workspace. */ }
      finally { running = false; }
    };
    void detect();
    window.addEventListener(CONSENT_EVENT, detect);
    window.addEventListener('focus', detect);
    return () => {
      window.removeEventListener(CONSENT_EVENT, detect);
      window.removeEventListener('focus', detect);
    };
  }, [user?.id]);
  return null;
}