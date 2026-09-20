/**
 * Browser-side mirror of the EU import routing switch, so the checkout summary
 * previews exactly what the server will charge. The server remains the
 * authority: it re-resolves the treatment from its own environment before the
 * PaymentIntent is created.
 */
import { configureIossRouting } from "@/config/taxRules";

const TRUE = new Set(["true", "1", "yes", "on"]);

export const bootIossRouting = () => {
  const flag = String(import.meta.env.VITE_PROCESS_IOSS_VIA_MERCHANT ?? "")
    .trim()
    .toLowerCase();
  configureIossRouting({
    processIossViaMerchant: TRUE.has(flag),
    euIossNumber: (import.meta.env.VITE_EU_IOSS_NUMBER as string | undefined) ?? null,
  });
};
