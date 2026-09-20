import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isBuyerTaxIdValid,
  normaliseBuyerTaxId,
  resolveTaxRule,
  vatValidationAuthority,
} from "@/config/taxRules";

export type VatVerificationStatus =
  | "idle" // nothing to check (private buyer, empty field)
  | "format" // typed but not yet a valid format
  | "checking" // live call in flight
  | "valid" // authority confirmed the registration
  | "invalid" // authority said no
  | "unavailable"; // provider down / timed out — treat as unverified

export interface VatVerification {
  status: VatVerificationStatus;
  /** Only ever true when an authority confirmed the number. */
  verified: boolean;
  /** Which authority answered. */
  source: string | null;
  /** Registered trader name, when the authority returns one. */
  name: string | null;
  message: string;
  /** True while checkout must not be submitted. */
  blocking: boolean;
}

const MESSAGES: Record<VatVerificationStatus, string> = {
  idle: "",
  format: "Enter the full registration number, including the country prefix.",
  checking: "Verifying your registration with the tax authority…",
  valid: "Registration verified.",
  invalid: "This registration could not be verified — destination VAT will be charged.",
  unavailable:
    "The verification service did not respond — destination VAT will be charged on this order.",
};

/**
 * Live VAT / GST registration validation.
 *
 * The result is authoritative for tax: only `verified === true` may trigger a
 * reverse charge or B2B zero-rating. An invalid number, a timeout or a
 * provider outage all fall back to standard destination VAT.
 */
export function useVatVerification(
  taxId: string,
  country: string | null | undefined,
  enabled: boolean,
): VatVerification {
  const [state, setState] = useState<{
    status: VatVerificationStatus;
    source: string | null;
    name: string | null;
  }>({ status: "idle", source: null, name: null });
  const seq = useRef(0);

  const normalised = normaliseBuyerTaxId(taxId);
  const rule = resolveTaxRule(country);
  const formatOk = isBuyerTaxIdValid(rule, normalised);
  const authority = vatValidationAuthority(country, normalised);

  useEffect(() => {
    if (!enabled || !normalised) {
      setState({ status: "idle", source: null, name: null });
      return;
    }
    if (!formatOk || !authority) {
      setState({ status: "format", source: null, name: null });
      return;
    }
    const ticket = ++seq.current;
    setState({ status: "checking", source: null, name: null });
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("validate-vat-number", {
          body: { taxId: normalised, country: (country || "").toUpperCase() },
        });
        if (ticket !== seq.current) return;
        if (error) {
          setState({ status: "unavailable", source: null, name: null });
          return;
        }
        const res = data as { valid?: boolean; source?: string; name?: string | null } | null;
        if (res?.valid === true) {
          setState({ status: "valid", source: res.source ?? null, name: res.name ?? null });
        } else if (res?.source === "unavailable") {
          setState({ status: "unavailable", source: null, name: null });
        } else {
          setState({ status: "invalid", source: res?.source ?? null, name: null });
        }
      } catch {
        if (ticket === seq.current) setState({ status: "unavailable", source: null, name: null });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [enabled, normalised, formatOk, authority, country]);

  return {
    status: state.status,
    verified: state.status === "valid",
    source: state.source,
    name: state.name,
    message: MESSAGES[state.status],
    // Never let a buyer submit mid-verification: the tax could still change.
    blocking: state.status === "checking",
  };
}
