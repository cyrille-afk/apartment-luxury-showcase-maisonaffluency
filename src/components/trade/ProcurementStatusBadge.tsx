import { Lock, FileText } from "lucide-react";
import { procurementStatusLabel, type ProcurementState } from "@/lib/procurementStatus";

export function ProcurementStatusBadge({ state }: { state: ProcurementState }) {
  const Icon = state === "PROCUREMENT_REVIEW" ? Lock : FileText;
  return <span role="status" className="inline-flex items-center gap-1.5 border border-border bg-transparent px-2.5 py-1 font-body text-[10px] font-medium uppercase tracking-normal text-foreground">
    <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />{procurementStatusLabel(state)}
  </span>;
}