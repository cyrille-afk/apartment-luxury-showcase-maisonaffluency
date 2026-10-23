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

export const startFelixTour = () => {
  window.dispatchEvent(new Event("felix-tour:start"));
};