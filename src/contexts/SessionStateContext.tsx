/**
 * Unified session-state facade.
 *
 * Exposes the simple { regionSettings, projectProfile } interface while
 * delegating to the two stores that already own this data, so there is a
 * single source of truth and nothing can drift out of sync:
 *
 *   regionSettings  → shippingDestination store (header flag modal, drives
 *                     the settlement-currency lock across cart/checkout)
 *   projectProfile  → CheckoutFormContext (buyer type + project location,
 *                     persisted to sessionStorage + localStorage)
 *
 * Usage:
 *   const { regionSettings, setRegionSettings, projectProfile, setProjectProfile } =
 *     useSessionState();
 */
import { useCallback, useMemo } from "react";
import { useCheckoutForm, type BuyerProfile } from "./CheckoutFormContext";
import {
  SHIPPING_COUNTRIES,
  setDestination,
  useShippingDestination,
} from "@/lib/shippingDestination";

export type RegionSettings = { country: string; currency: string };
export type ProjectProfile = { clientType: string; projectLocation: string };

export type SessionState = {
  regionSettings: RegionSettings;
  setRegionSettings: (settings: Partial<RegionSettings>) => void;
  projectProfile: ProjectProfile;
  setProjectProfile: (profile: Partial<ProjectProfile>) => void;
};

/** Resolve a country name ("Singapore") or ISO code ("SG") to its entry. */
const findCountry = (value: string | undefined) => {
  if (!value) return undefined;
  const needle = value.trim().toLowerCase();
  return SHIPPING_COUNTRIES.find(
    (c) => c.iso.toLowerCase() === needle || c.name.toLowerCase() === needle,
  );
};

export function useSessionState(): SessionState {
  const checkout = useCheckoutForm();
  const dest = useShippingDestination();

  const regionSettings = useMemo<RegionSettings>(
    () => ({ country: dest.name, currency: dest.currency }),
    [dest],
  );

  const setRegionSettings = useCallback(
    (settings: Partial<RegionSettings>) => {
      const entry = findCountry(settings.country);
      if (!entry) return;
      // Locks the settlement currency across the whole funnel and re-arms the
      // header flag; currency is always derived from the country.
      setDestination(entry.iso);
      checkout.setProjectCountry(entry.iso);
    },
    [checkout],
  );

  const projectProfile = useMemo<ProjectProfile>(
    () => ({
      clientType: checkout.buyerProfile ?? "",
      projectLocation: checkout.projectCity || dest.name,
    }),
    [checkout.buyerProfile, checkout.projectCity, dest.name],
  );

  const setProjectProfile = useCallback(
    (profile: Partial<ProjectProfile>) => {
      if (profile.clientType !== undefined) {
        const t = profile.clientType.trim().toLowerCase();
        const buyer: BuyerProfile =
          t === "designer" || t === "studio" || t === "business"
            ? "designer"
            : t === "private" || t === "individual"
              ? "private"
              : null;
        checkout.setBuyerProfile(buyer);
      }
      if (profile.projectLocation !== undefined) {
        const location = profile.projectLocation.trim();
        checkout.setProjectCity(location);
        // If the location names a known country, lock the region too so the
        // shopper never specifies their country twice.
        const entry = findCountry(location);
        if (entry) setRegionSettings({ country: entry.iso });
      }
    },
    [checkout, setRegionSettings],
  );

  return { regionSettings, setRegionSettings, projectProfile, setProjectProfile };
}
