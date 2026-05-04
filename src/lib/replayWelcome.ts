import { supabase } from "@/integrations/supabase/client";
import { loadName, DEFAULT_NAME } from "@/components/trade/conciergeGreeting";
import { loadOnboardingWelcome } from "@/lib/onboardingWelcome";

export async function replayWelcome(opts?: { userId?: string; firstName?: string | null }) {
  try {
    localStorage.removeItem("trade_quick_tour_done");
    localStorage.removeItem("trade_quick_tour_step");
    localStorage.removeItem("ma:welcome-pending");
    localStorage.removeItem("concierge:pos");
    localStorage.removeItem("concierge:expanded");
  } catch {}

  if (opts?.userId) {
    await supabase.from("profiles").update({ has_seen_trade_intro: true } as any).eq("id", opts.userId);
  }

  const conciergeName = loadName() || DEFAULT_NAME;
  const { message, actions } = await loadOnboardingWelcome({
    firstName: opts?.firstName,
    conciergeName,
  });

  try { localStorage.setItem("ma:welcome-pending", "1"); } catch {}
  window.dispatchEvent(new CustomEvent("ma:welcome-pending"));
  window.dispatchEvent(new CustomEvent("concierge:stage", {
    detail: { openPanel: true, resetPanel: true, replaceTimeline: true, message, actions, onboarding: true },
  }));
}
