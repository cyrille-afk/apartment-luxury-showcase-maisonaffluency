import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, FileText, Receipt } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useWholesalePayables,
  useUpdateInvoiceStatus,
  INVOICE_STATUS_LABEL,
  type PayableGroup,
  type InvoiceStatus,
} from "@/hooks/useWholesalePayables";

const FILTERS: { id: "all" | InvoiceStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "pending_invoice_match", label: "Pending invoice match" },
  { id: "invoice_received", label: "Invoice received" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
];

const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const StatusPill = ({ status }: { status: InvoiceStatus }) => (
  <span
    className={cn(
      "inline-flex items-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
      (status === "pending" || status === "pending_invoice_match") && "bg-accent/15 text-accent",
      status === "invoice_received" && "bg-muted text-foreground",
      status === "approved" && "bg-primary/10 text-primary",
      status === "paid" && "bg-emerald-900/15 text-emerald-800 dark:text-emerald-300",
    )}
  >
    {INVOICE_STATUS_LABEL[status]}
  </span>
);

const GroupBlock = ({
  group,
  onAdvance,
  busy,
}: {
  group: PayableGroup;
  onAdvance: (g: PayableGroup, from: InvoiceStatus[], to: InvoiceStatus) => void;
  busy: boolean;
}) => {
  const count = (s: InvoiceStatus) => group.rows.filter((r) => r.invoiceStatus === s).length;
  return (
    <section
      className={cn(
        "border bg-card",
        group.followupCount > 0
          ? "border-2 border-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.12)]"
          : "border-border",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div>
          <h2 className="font-display text-lg text-foreground">{group.designerName}</h2>
          <p className="font-body text-xs text-muted-foreground">
            {group.rows.length} purchase order line{group.rows.length === 1 ? "" : "s"} ·{" "}
            {group.currency}
            {group.pendingCount > 0 && (
              <span className="ml-2 text-accent">{group.pendingCount} awaiting invoice</span>
            )}
            {group.followupCount > 0 && (
              <span className="ml-2 inline-flex animate-pulse items-center gap-1 bg-orange-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-600 dark:text-orange-400">
                ⚠ {group.followupCount} overdue acknowledgement
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {count("pending") + count("pending_invoice_match") > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAdvance(group, ["pending", "pending_invoice_match"], "invoice_received")}
              className="font-body"
            >
              <FileText className="mr-1.5 h-4 w-4" /> Mark invoice received
            </Button>
          )}
          {count("invoice_received") > 0 && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onAdvance(group, ["invoice_received"], "approved")}
              className="font-body"
            >
              <BadgeCheck className="mr-1.5 h-4 w-4" /> Approve invoice
            </Button>
          )}
          {count("approved") > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAdvance(group, ["approved"], "paid")}
              className="font-body"
            >
              <Check className="mr-1.5 h-4 w-4" /> Mark settled
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {[
          { label: "Sold to buyers", value: money(group.soldGross, group.currency) },
          { label: "Wholesale cost", value: money(group.wholesalePayable, group.currency) },
          { label: "Outstanding payable", value: money(group.outstandingPayable, group.currency) },
          { label: "Maison margin", value: money(group.maisonMargin, group.currency) },
        ].map((stat) => (
          <div key={stat.label} className="bg-card px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-base text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-t border-border font-body text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-normal">Item</th>
              <th className="px-4 py-2 text-right font-normal">Retail RRP</th>
              <th className="px-4 py-2 text-right font-normal">Wholesale cost</th>
              <th className="px-4 py-2 text-right font-normal">Sold gross</th>
              <th className="px-4 py-2 text-right font-normal">Processing fees</th>
              <th className="px-4 py-2 text-right font-normal">Maison margin</th>
              <th className="px-4 py-2 font-normal">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.id} className="border-t border-border/60">
                <td className="px-4 py-2.5">
                  <span className="text-foreground">{row.productTitle ?? "Line item"}</span>
                  {row.requiresFollowup && (
                    <span className="ml-2 inline-flex animate-pulse items-center bg-orange-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Follow up
                    </span>
                  )}
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {row.orderRef ?? ""} · wholesale −{row.wholesaleDiscountPct}%
                    {row.invoiceReference ? ` · ${row.invoiceReference}` : ""}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {money(row.retailRrp, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
                  {money(row.purchaseCostCogs, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {money(row.soldPriceGross, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  −{money(row.stripeProcessingFees, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                  {money(row.netMaisonMargin, row.currency)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={row.invoiceStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default function TradeAdminProcurementLedger() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const { data: groups, isLoading } = useWholesalePayables(!!isAdmin, filter);
  const update = useUpdateInvoiceStatus();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <DotCircleLoader />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const advance = async (g: PayableGroup, from: InvoiceStatus[], to: InvoiceStatus) => {
    const ids = g.rows.filter((r) => from.includes(r.invoiceStatus)).map((r) => r.id);
    if (!ids.length) return;
    try {
      await update.mutateAsync({ ids, status: to });
      toast({
        title: `Marked ${INVOICE_STATUS_LABEL[to].toLowerCase()}`,
        description: `${g.designerName} — ${ids.length} line${ids.length === 1 ? "" : "s"}.`,
      });
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const outstanding = (groups ?? []).reduce((a, g) => a + g.outstandingPayable, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Helmet>
        <title>Wholesale Procurement Ledger | Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Link
        to="/trade"
        className="inline-flex items-center gap-2 font-body text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to trade portal
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl text-foreground">
            <Receipt className="h-6 w-6 text-accent" /> Wholesale Procurement Ledger
          </h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Purchase orders Maison Affluency owes its designers. Wholesale cost is locked at
            settlement and never moves with buyer-side discounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "border px-3 py-1.5 font-body text-xs transition-colors",
                filter === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <DotCircleLoader />
        </div>
      ) : !groups || groups.length === 0 ? (
        <p className="mt-10 font-body text-sm text-muted-foreground">
          No purchase orders yet. Payable lines are generated automatically when an order settles.
        </p>
      ) : (
        <>
          <p className="mt-5 font-body text-xs text-muted-foreground">
            {groups.length} designer{groups.length === 1 ? "" : "s"} · outstanding wholesale{" "}
            <span className="text-foreground">
              {money(outstanding, groups[0]?.currency ?? "USD")}
            </span>
          </p>
          <div className="mt-4 space-y-6">
            {groups.map((g) => (
              <GroupBlock key={g.designerKey} group={g} busy={update.isPending} onAdvance={advance} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
