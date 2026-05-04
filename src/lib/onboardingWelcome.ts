import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/components/trade/conciergeGreeting";
import { localizedWelcomeTemplate } from "@/lib/conciergeI18n";

export interface WelcomeAction {
  label: string;
  prompt: string;
  primary?: boolean;
}

export interface RenderedWelcome {
  enabled: boolean;
  message: string;
  actions: WelcomeAction[];
}

const DEFAULT_TEMPLATE =
  `Welcome to Maison Affluency{first_name_comma} — I'm {concierge_name}. Want a quick tour, or shall we start from a brief?\n\n_Tip: you can rename me any time — I'll answer to whatever feels right._`;

const DEFAULT_BUTTONS: WelcomeAction[] = [
  { label: "Start Quick Tour", prompt: "__concierge:start_tour__", primary: true },
  { label: "Start from a brief", prompt: "__concierge:start_brief__" },
  { label: "Rename {concierge_name}", prompt: "__concierge:rename__" },
];

export interface LoadWelcomeOpts {
  firstName?: string | null;
  conciergeName: string;
  lang?: Lang;
}

/**
 * Single source of truth for the customised first-login / replay welcome.
 * Reads the singleton row in `onboarding_flow_config` (id='default') and applies
 * variable substitution. Falls back to a sensible default if the row is missing.
 */
export async function loadOnboardingWelcome(opts: LoadWelcomeOpts): Promise<RenderedWelcome> {
  const { data: cfg } = await supabase
    .from("onboarding_flow_config")
    .select("greeting_template, buttons, is_enabled")
    .eq("id", "default")
    .maybeSingle();

  const template = localizedWelcomeTemplate((cfg?.greeting_template as string | undefined) || DEFAULT_TEMPLATE, opts.lang ?? "en");
  const rawButtons = (cfg?.buttons as any[] | undefined) || DEFAULT_BUTTONS;
  const enabled = cfg?.is_enabled !== false;

  const firstName = opts.firstName?.trim() || "";
  const subst = (s: string) =>
    s
      .replace(/\{first_name_comma\}/g, firstName ? `, ${firstName}` : "")
      .replace(/\{first_name\}/g, firstName)
      .replace(/\{concierge_name\}/g, opts.conciergeName);

  return {
    enabled,
    message: subst(template),
    actions: rawButtons.map((b) => ({
      label: subst(String(b.label || "")),
      prompt: String(b.prompt || ""),
      primary: !!b.primary,
    })),
  };
}
