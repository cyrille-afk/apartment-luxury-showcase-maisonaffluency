import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useDesignerCommissions,
  useUpdatePayoutStatus,
  type DesignerGroup,
  type PayoutStatus,
} from "@/hooks/useDesignerCommissions";

const FILTERS: { id: "all" | PayoutStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
];

const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const StatusPill = ({ status }: { status: PayoutStatus }) => (
  <span
    className={cn(
      "inline-flex items-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
      status === "pending" && "bg-accent/15 text-accent",
      status === "approved" && "bg-primary/10 text-primary",
      status === "paid" && "bg-emerald-900/15 text-emerald-800 dark:text-emerald-300",
    )}
  >
    {status}
  </span>
);

const GroupBlock = ({
  group,
  onApprove,
  onMarkPaid,
  busy,
}: {
  group: DesignerGroup;
  onApprove: (g: DesignerGroup) => void;
  onMarkPaid: (g: DesignerGroup) => void;
  busy: boolean;
}) => {
  const approvedIds = group.rows.filter((r) => r.payoutStatus === "approved");
  return (
    <section className="border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div>
          <h2 className="font-display text-lg text-foreground">{group.designerName}</h2>
          <p className="font-body text-xs text-muted-foreground">
            {group.rows.length} line item{group.rows.length === 1 ? "" : "s"} · {group.currency}
            {group.pendingCount > 0 && (
              <span className="ml-2 text-accent">{group.pendingCount} pending approval</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {group.pendingCount > 0 && (
            <Button size="sm" disabled={busy} onClick={() => onApprove(group)} className="font-body">
              <BadgeCheck className="mr-1.5 h-4 w-4" /> Approve for payout
            </Button>
          )}
          {approvedIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onMarkPaid(group)}
              className="font-body"
            >
              <Check className="mr-1.5 h-4 w-4" /> Mark paid
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {[
          { label: "Gross sales", value: money(group.grossSales, group.currency) },
          { label: "Total deductions", value: money(group.totalDeductions, group.currency) },
          { label: "Net earnings", value: money(group.netEarnings, group.currency) },
          {
            label: "Effective rate",
            value: group.grossSales
              ? `${((group.netEarnings / group.grossSales) * 100).toFixed(1)}%`
              : "—",
          },
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
        <table className="w-full min-w-[820px] border-t border-border font-body text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-normal">Item</th>
              <th className="px-4 py-2 text-right font-normal">Gross</th>
              <th className="px-4 py-2 text-right font-normal">Trade discount</th>
              <th className="px-4 py-2 text-right font-normal">Stripe fee</th>
              <th className="px-4 py-2 text-right font-normal">Platform fee</th>
              <th className="px-4 py-2 text-right font-normal">Net payout</th>
              <th className="px-4 py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.id} className="border-t border-border/60">
                <td className="px-4 py-2.5">
                  <span className="text-foreground">{row.productTitle ?? "Line item"}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {row.orderRef ?? ""} · {row.commissionRatePct}% ·{" "}
                    {row.discountAbsorbedBy === "designer" ? "designer-absorbed" : "platform-absorbed"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {money(row.grossAmount, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  −{money(row.tradeDiscountApplied, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  −{money(row.stripeFeeCents, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  −{money(row.platformFee, row.currency)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
                  {money(row.designerNetPayout, row.currency)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={row.payoutStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default function TradeAdminCommissions() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | PayoutStatus>("all");
  const { data: groups, isLoading } = useDesignerCommissions(!!isAdmin, filter);
  const update = useUpdatePayoutStatus();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <DotCircleLoader />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const run = async (g: DesignerGroup, status: PayoutStatus) => {
    const ids = g.rows
      .filter((r) => (status === "approved" ? r.payoutStatus === "pending" : r.payoutStatus === "approved"))
      .map((r) => r.id);
    if (!ids.length) return;
    try {
      await update.mutateAsync({ ids, status });
      toast({
        title: status === "approved" ? "Approved for payout" : "Marked as paid",
        description: `${g.designerName} — ${ids.length} line item${ids.length === 1 ? "" : "s"}.`,
      });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    }
  };

  const totalNet = (groups ?? []).reduce((a, g) => a + g.netEarnings, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Helmet>
        <title>Designer Commissions Ledger | Maison Affluency</title>
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
            <Wallet className="h-6 w-6 text-accent" /> Designer Commissions Ledger
          </h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Per-line commission splits recorded at settlement. All figures are exact minor units.
          </p>
        </div>
        <div className="flex gap-1">
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
          No commission records yet. Ledger entries are created automatically when an order settles.
        </p>
      ) : (
        <>
          <p className="mt-5 font-body text-xs text-muted-foreground">
            {groups.length} designer{groups.length === 1 ? "" : "s"} · net payable{" "}
            <span className="text-foreground">
              {money(totalNet, groups[0]?.currency ?? "USD")}
            </span>
          </p>
          <div className="mt-4 space-y-6">
            {groups.map((g) => (
              <GroupBlock
                key={g.designerKey}
                group={g}
                busy={update.isPending}
                onApprove={(x) => run(x, "approved")}
                onMarkPaid={(x) => run(x, "paid")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
