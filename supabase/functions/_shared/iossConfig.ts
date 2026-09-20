/**
 * Boots the EU import routing switch from the function environment.
 *
 * `taxRules.ts` is deliberately dependency-free (it is mirrored into the
 * browser bundle), so the environment is read here and pushed into it.
 *
 *   PROCESS_IOSS_VIA_MERCHANT   "true" once we hold an IOSS registration and
 *                               want to account for low-value EU VAT ourselves
 *   EU_IOSS_NUMBER              the IM############ identifier itself
 *
 * With the switch off — the current state — every EU consignment, either side
 * of €150, is routed as a carrier-cleared DDP import from Singapore.
 */
import { configureIossRouting, getIossRouting } from "./taxRules.ts";

const TRUE = new Set(["true", "1", "yes", "on"]);

/** Reads the environment and applies it. Safe to call on every request. */
export const applyIossEnv = () => {
  const flag = (Deno.env.get("PROCESS_IOSS_VIA_MERCHANT") || "").trim().toLowerCase();
  configureIossRouting({
    processIossViaMerchant: TRUE.has(flag),
    euIossNumber: Deno.env.get("EU_IOSS_NUMBER") || null,
  });
  return getIossRouting();
};
