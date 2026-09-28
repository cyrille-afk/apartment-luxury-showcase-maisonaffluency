/**
 * Outreach tracking links: DM copy gets a /trade-program URL tagged with channel, hook,
 * agent and lead; the landing page reads them once and logs a click for the KPI Ledger.
 */
import { supabase } from "@/integrations/supabase/client";

export type OutreachChannel = "instagram" | "linkedin" | "email";
const SHORT: Record<OutreachChannel, string> = { instagram: "ig", linkedin: "li", email: "em" };
const LONG: Record<string, OutreachChannel> = { ig: "instagram", li: "linkedin", em: "email" };

export const buildOutreachLink = (o: { channel: OutreachChannel; hook: "A" | "B" | "C"; agentId?: string | null; leadId?: string | null }) => {
  const p = new URLSearchParams({ utm_source: SHORT[o.channel], utm_medium: "outreach", hook: o.hook.toLowerCase() });
  if (o.agentId) p.set("agent", o.agentId);
  if (o.leadId) p.set("lead", o.leadId);
  return `https://www.maisonaffluency.com/trade-program?${p.toString()}`;
};

const UUID = /^[0-9a-f-]{36}$/i;

/** Call once on landing mount. Logs at most once per browser session per link. */
export const captureOutreachClick = () => {
  try {
    const q = new URLSearchParams(window.location.search);
    const channel = LONG[q.get("utm_source") ?? ""];
    if (!channel || q.get("utm_medium") !== "outreach") return;
    const hookRaw = (q.get("hook") ?? "").toUpperCase();
    const agent = q.get("agent"), lead = q.get("lead");
    const key = `ma_oc_${channel}_${lead ?? ""}_${agent ?? ""}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void supabase.rpc("log_outreach_click", {
      _channel: channel,
      _hook: hookRaw === "A" || hookRaw === "B" || hookRaw === "C" ? hookRaw : null,
      _agent: agent && UUID.test(agent) ? agent : null,
      _lead: lead && UUID.test(lead) ? lead : null,
    } as never).then(({ error }) => { if (error) sessionStorage.removeItem(key); });
  } catch { /* tracking must never break the page */ }
};
