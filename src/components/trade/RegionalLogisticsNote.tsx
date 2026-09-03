import { Plane, Ship, Truck } from "lucide-react";
import { useRegionalLogistics } from "@/hooks/useRegionalLogistics";

interface Props {
  className?: string;
  /** Compact single-line variant for checkout summaries */
  compact?: boolean;
}

/**
 * Region-aware logistics disclosure for authenticated trade users.
 * ASEAN → Singapore District 9 hub white-glove delivery.
 * GCC   → air-freight metrics, Singapore tax configuration hidden.
 */
export function RegionalLogisticsNote({ className = "", compact = false }: Props) {
  const { regionTier, rule, loading } = useRegionalLogistics();
  if (loading || !rule) return null;

  const Icon = rule.delivery_mode === "air_freight" ? Plane : rule.delivery_mode === "local_white_glove" ? Truck : Ship;

  const headline =
    regionTier === "ASEAN"
      ? `Local concierge white-glove delivery from our ${rule.hub_city || "Singapore"} hub`
      : regionTier === "GCC"
        ? `Air-freight forwarding from ${rule.hub_city || "Singapore"} · bonded export documentation`
        : `Consolidated sea freight from ${rule.hub_city || "Singapore"}`;

  const taxLine =
    regionTier === "GCC"
      ? "Exported free of Singapore GST · duties settled by consignee"
      : rule.show_singapore_tax
        ? "Singapore GST applied at checkout where applicable"
        : "Duties and taxes settled on arrival";

  if (compact) {
    return (
      <p className={`font-body text-[11px] text-muted-foreground flex items-center gap-2 ${className}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{headline} · {rule.estimated_lead_time}</span>
      </p>
    );
  }

  return (
    <div className={`border border-border rounded-sm px-4 py-3 space-y-1.5 ${className}`}>
      <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {regionTier === "ROW" ? "International logistics" : `${regionTier} logistics`}
      </p>
      <p className="font-body text-sm flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <span>{headline}</span>
      </p>
      <p className="font-body text-xs text-muted-foreground">
        Estimated landing time · {rule.estimated_lead_time}
      </p>
      <p className="font-body text-xs text-muted-foreground">{taxLine}</p>
    </div>
  );
}

export default RegionalLogisticsNote;
