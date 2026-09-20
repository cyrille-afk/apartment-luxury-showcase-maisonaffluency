/**
 * Client bridge to the cross-border invoicing & shipping optimisation matrix.
 *
 * Every call is a background enhancement: on error or timeout the caller keeps
 * the trade baseline rates already on screen and the incident is logged
 * silently to the admin console. The UI is never blocked.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CrossBorderShipping {
  zone_label: string;
  chargeable_weight_kg: number;
  freight_cents: number;
  freight_label: string;
  insurance_cents: number;
  white_glove_applied: boolean;
  white_glove_cents: number;
  white_glove_label: string;
  total_cents: number;
}

export interface CrossBorderInvoice {
  ok: true;
  tax_status: string;
  tax_treatment: string;
  tax_cents: number;
  tax_rate: number;
  tax_label: string | null;
  tax_note: string | null;
  destination_country: string;
  currency: string;
  buyer_tax_id: string | null;
  buyer_tax_id_verified: boolean;
  verified_company_name: string | null;
  shipping: CrossBorderShipping;
}

export interface CrossBorderItem {
  pickId?: string | null;
  unitCents: number;
  quantity: number;
  originCountry?: string | null;
  hs6Code?: string | null;
  dutyRate?: number | null;
}

export const B2B_EXEMPT = "B2B_EXEMPT_REVERSE_CHARGE";

export const isReverseChargeExempt = (invoice: CrossBorderInvoice | null): boolean =>
  invoice?.tax_status === B2B_EXEMPT;

/** Silent admin-console incident trail — never surfaced to the buyer. */
export const logInvoiceIncident = (reason: string, detail?: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[cross-border-invoice] ${reason}`, detail ?? "");
};

const TIMEOUT_MS = 6_000;

/**
 * Resolve the cross-border invoice. Returns `null` on any failure — callers
 * then keep the default trade baseline rates.
 */
export async function fetchCrossBorderInvoice(input: {
  destinationCountry: string;
  currency: string;
  items: CrossBorderItem[];
}): Promise<CrossBorderInvoice | null> {
  if (!input.destinationCountry || input.items.length === 0) return null;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  try {
    const call = supabase.functions
      .invoke("calculate-cross-border-invoice", { body: input })
      .then(({ data, error }) => {
        if (error) {
          logInvoiceIncident("function_error", error.message);
          return null;
        }
        if (!data || (data as any).ok !== true) {
          logInvoiceIncident("calculation_unavailable", (data as any)?.error);
          return null;
        }
        return data as CrossBorderInvoice;
      })
      .catch((e) => {
        logInvoiceIncident("network_error", e);
        return null;
      });

    const result = await Promise.race([call, timeout]);
    if (result === null) logInvoiceIncident("timeout_or_fallback");
    return result;
  } catch (e) {
    logInvoiceIncident("unexpected_error", e);
    return null;
  }
}
