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
        const { data, error } = await supabase.functions.invoke('detect-client-currency', { body: { functionalConsent: true } });
        completed = !error && data?.saved === true;
        if (completed) window.dispatchEvent(new Event('client-ip-currency-saved'));
      } finally { running = false; }
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