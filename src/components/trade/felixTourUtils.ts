import type { TradeTier, TierConfigRow } from "@/hooks/useTradeDiscount";
import type { TierVolumeModel } from "@/hooks/useTierVolumeLocale";

/** Shared copy formatting stays outside the React Fast Refresh boundary. */
export const fmtPct = (fraction: number) => {
  const pct = fraction * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
};

export const resolveTierTokens = (text: string, cfg: Record<TradeTier, TierConfigRow>, volume: TierVolumeModel) =>
  text
    .replace(/\{silverPct\}/g, fmtPct(cfg.silver.discount_pct))
    .replace(/\{goldPct\}/g, fmtPct(cfg.gold.discount_pct))
    .replace(/\{platinumPct\}/g, fmtPct(cfg.platinum.discount_pct))
    .replace(/\{goldVolume\}/g, volume.format(volume.amount(cfg.gold.min_spend_cents)))
    .replace(/\{platinumVolume\}/g, volume.format(volume.amount(cfg.platinum.min_spend_cents)));

/**
 * A restart request must survive the moment when no tour is mounted: the tour
 * sits inside a Suspense boundary whose late chunks can drop it for a beat, and
 * a bare event dispatched then is swallowed. The flag is tab-scoped and short
 * lived; the tour re-reads it when it mounts and clears it when it closes.
 */
export const TOUR_PENDING_KEY = "felix_tour_pending_v1";
export const TOUR_PENDING_WINDOW_MS = 15_000;

export const startFelixTour = () => {
  try { sessionStorage.setItem(TOUR_PENDING_KEY, String(Date.now())); } catch { /* storage optional */ }
  window.dispatchEvent(new Event("felix-tour:start"));
};

/** True when a restart was requested moments ago and the tour has not closed since. */
export const hasPendingTourStart = () => {
  try {
    const raw = sessionStorage.getItem(TOUR_PENDING_KEY);
    if (!raw) return false;
    const requestedAt = Number(raw);
    if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > TOUR_PENDING_WINDOW_MS) {
      sessionStorage.removeItem(TOUR_PENDING_KEY);
      return false;
    }
    return true;
  } catch { return false; }
};

export const clearTourStartRequest = () => {
  try { sessionStorage.removeItem(TOUR_PENDING_KEY); } catch { /* storage optional */ }
};
