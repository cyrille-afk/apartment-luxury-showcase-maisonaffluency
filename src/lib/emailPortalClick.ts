import { supabase } from "@/integrations/supabase/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records a trade-portal click from an email link carrying ?ma_ref=. Fire-and-forget, once per page load. */
export function recordEmailPortalClick(search: string = window.location.search) {
  const ref = new URLSearchParams(search).get("ma_ref");
  if (!ref || !UUID.test(ref)) return;
  const key = `ma-portal-click-${ref}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* storage blocked */ }
  void supabase.rpc("record_email_portal_click", { p_ref: ref }).then(() => undefined, () => undefined);
}
