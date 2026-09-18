import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PaymentModeStatus = {
  liveMode: boolean;
  activeMode?: "live" | "test";
  activeSource?: "env" | "payment_settings" | "none";
  activeSourceLabel?: string;
  envKeyPresent?: boolean;
  envLiveKey?: boolean;
  savedLiveConfigured?: boolean;
  savedLiveEnabled?: boolean;
  publishableKeyAlias?: "STRIPE_PUBLIC_KEY" | "STRIPE_PUBLISHABLE_KEY" | null;
  hasWebhookSecret?: boolean;
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
  updatedAt: string | null;
  webhookUrl: string;
};

/**
 * Admin-only Stripe configuration status. Used both by the Payment Settings
 * screen and by the pipeline cards to hide simulation tools in live mode.
 */
export function usePaymentMode(enabled = true) {
  return useQuery<PaymentModeStatus | null>({
    queryKey: ["payment-mode"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("payment-credentials", {
        body: { action: "status" },
      });
      if (error) return null;
      return data as PaymentModeStatus;
    },
  });
}
