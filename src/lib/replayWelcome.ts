import { supabase } from "@/integrations/supabase/client";
import { loadName, DEFAULT_NAME } from "@/components/trade/conciergeGreeting";

export async function replayWelcome(opts?: { userId?: string; firstName?: string | null }) {
  try {
    localStorage.removeItem("trade_quick_tour_done");
    localStorage.removeItem("trade_quick_tour_step");
    localStorage.removeItem("ma:welcome-pending");
  } catch {}

  if (opts?.userId) {
    await supabase.from("profiles").update({ has_seen_trade_intro: true } as any).eq("id", opts.userId);
  }

  const { data: cfg } = await supabase
    .from("onboarding_flow_config")
    .select("greeting_template, buttons, is_enabled")
    .eq("id", "default")
    .maybeSingle();

  const conciergeName = loadName() || DEFAULT_NAME;
  const firstName = opts?.firstName?.trim();
  const tpl = (cfg?.greeting_template as string | undefined) ||
    `Welcome to Maison Affluency{first_name_comma} — I'm {concierge_name}. Want a quick tour, or shall we start from a brief?\n\n_Tip: you can rename me any time — I'll answer to whatever feels right._`;
  const subst = (s: string) => s
    .replace(/\{first_name_comma\}/g, firstName ? `, ${firstName}` : "")
    .replace(/\{first_name\}/g, firstName || "")
    .replace(/\{concierge_name\}/g, conciergeName);
  const rawButtons = (cfg?.buttons as any[] | undefined) || [
    { label: "Start Quick Tour", prompt: "__concierge:start_tour__", primary: true },
    { label: "Start from a brief", prompt: "__concierge:start_brief__" },
    { label: `Rename {concierge_name}`, prompt: "__concierge:rename__" },
  ];
  const actions = rawButtons.map((b) => ({
    label: subst(String(b.label || "")),
    prompt: String(b.prompt || ""),
    primary: !!b.primary,
  }));

  try { localStorage.setItem("ma:welcome-pending", "1"); } catch {}
  window.dispatchEvent(new CustomEvent("concierge:stage", {
    detail: { openPanel: true, message: subst(tpl), actions },
  }));
}
