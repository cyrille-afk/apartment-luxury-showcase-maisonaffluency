import { useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Instagram, Mail, PackageOpen, ShoppingBag, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useSalesFunnel, type FunnelEntry } from "@/hooks/useSalesFunnel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabaseImageTransform } from "@/lib/supabaseImage";
import FunnelPayLinkBlock from "@/components/trade/FunnelPayLinkBlock";
import FunnelReminderPauseToggle from "@/components/trade/FunnelReminderPauseToggle";
import SimulatePaymentLink from "@/components/trade/SimulatePaymentLink";

const RANGES = [
  { id: 7, label: "Last 7 days" },
  { id: 30, label: "Last 30 days" },
  { id: 90, label: "Last 90 days" },
  { id: 3650, label: "All time" },
];

const relative = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const EntryCard = ({ entry, urgent = false, quoteCard = false }: { entry: FunnelEntry; urgent?: boolean; quoteCard?: boolean }) => (
  <article
    className={cn(
      "group border bg-card p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft",
      urgent ? "border-accent/80 shadow-soft" : "border-border hover:border-primary/40",
      entry.paidViaStripe &&
        "border-emerald-900/40 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-3 motion-safe:duration-500",
    )}
  >
    <div className="flex gap-3">
      <div className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden bg-muted">
        {entry.imageUrl ? (
          <img
            src={supabaseImageTransform(entry.imageUrl, { width: 160, quality: 70 })}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <PackageOpen className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-[15px] leading-tight text-foreground">
            {entry.label}
          </h3>
          <span className="shrink-0 font-body text-[10px] text-muted-foreground">
            {relative(entry.createdAt)}
          </span>
        </div>
        <p className="mt-1 truncate font-body text-[11px] text-muted-foreground">
          {entry.email || entry.sublabel}
        </p>
        {entry.email && entry.sublabel && (
          <p className="mt-0.5 truncate font-body text-[10px] text-muted-foreground/80">
            {entry.sublabel}
          </p>
        )}
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-2.5">
      {entry.amountLabel ? (
        <span className="font-body text-[11px] font-medium text-foreground">{entry.amountLabel}</span>
      ) : (
        <span className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {entry.paidViaStripe ? "Settled deposit" : urgent ? "Draft quotation" : "Follow up"}
        </span>
      )}
      {entry.paidViaStripe ? (
        <span className="inline-flex items-center gap-1.5 bg-[hsl(155_45%_16%)] px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(150_35%_88%)]">
          <Check className="h-3 w-3" /> Paid via Stripe
        </span>
      ) : entry.href ? (
        <Button asChild variant={urgent ? "default" : "ghost"} size="sm" className="h-7 px-2 text-[10px] uppercase tracking-[0.12em]">
          <Link to={entry.href}>
            {urgent ? "Resume draft" : "Open"} <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      ) : entry.email ? (
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase tracking-[0.12em]">
          <a href={`mailto:${entry.email}`}><Mail className="h-3 w-3" /> Email</a>
        </Button>
      ) : null}
    </div>
    {!entry.paidViaStripe && (
      <FunnelReminderPauseToggle
        entityType={urgent || quoteCard ? "quote_unpaid" : entry.email && !entry.href ? "cart" : "funnel_card"}
        entityId={entry.id}
      />
    )}
    {!entry.paidViaStripe && (
      <FunnelPayLinkBlock
        label={entry.label}
        email={entry.email}
        quoteId={urgent || quoteCard ? entry.id : null}
        cardId={entry.id}
        cardStage={urgent ? "draft_quotes" : quoteCard ? "sent_unpaid" : "lead_capture"}
        recipientName={entry.sublabel}
        productName={entry.productName ?? entry.label}
        finish={entry.finish}
        leadTime={entry.leadTime}
        maisonRef={urgent || quoteCard ? `QU-${entry.id.slice(0, 6).toUpperCase()}` : null}
      />
    )}
    <SimulatePaymentLink
      cardId={entry.id}
      cardStage={entry.originStage ?? (urgent ? "draft_quotes" : "lead_capture")}
      label={entry.label}
      email={entry.email}
      quoteId={urgent ? entry.id : null}
      alreadyPaid={Boolean(entry.paidViaStripe)}
    />
  </article>
);

const PipelineColumn = ({
  title,
  count,
  children,
  className,
  urgent = false,
  headerDetails,
}: {
  title: string;
  count: number;
  children: ReactNode;
  className?: string;
  urgent?: boolean;
  headerDetails?: ReactNode;
}) => (
  <section className={cn("min-w-[250px] border-t-2 border-border pt-4", urgent && "border-accent", className)}>
    <div className="mb-4 px-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full bg-primary", urgent && "bg-accent")} />
          <h2 className="truncate font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
            {title}
          </h2>
        </div>
        <span
          className={cn(
            "flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-muted px-2 font-body text-xs font-semibold text-foreground",
            urgent && "bg-accent text-accent-foreground motion-safe:animate-pulse",
          )}
        >
          {count}
        </span>
      </div>
      {headerDetails}
    </div>
    <div className={cn("min-h-[420px] space-y-3 border border-border bg-muted/30 p-3", urgent && "bg-accent/5")}>{children}</div>
  </section>
);

const GroupLabel = ({ children, count }: { children: ReactNode; count: number }) => (
  <div className="flex items-center justify-between gap-3 px-1 pt-1">
    <p className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{children}</p>
    <span className="font-body text-[10px] text-muted-foreground">{count}</span>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex min-h-20 items-center justify-center border border-dashed border-border bg-background/60 px-4 text-center">
    <p className="font-body text-xs text-muted-foreground">{label}</p>
  </div>
);

const AcquisitionEntryCard = ({ entry }: { entry: FunnelEntry }) => (
  <article className="border border-border bg-card p-3 transition-colors hover:border-primary/40">
    <div className="flex items-start gap-3">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-[15px] leading-tight text-foreground">{entry.label}</h3>
          <span className="shrink-0 font-body text-[10px] text-muted-foreground">{relative(entry.createdAt)}</span>
        </div>
        <p className="mt-1 truncate font-body text-[11px] text-muted-foreground">{entry.sublabel}</p>
        <p className="mt-0.5 truncate font-body text-[10px] text-muted-foreground/80">{entry.email}</p>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
      <span className="font-body text-[10px] uppercase tracking-[0.14em] text-emerald-600">Portal activated</span>
      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase tracking-[0.12em]">
        <Link to={entry.href || "/trade/admin/acquisitions"}>Open <ArrowRight className="h-3 w-3" /></Link>
      </Button>
    </div>
  </article>
);

const TradeAdminSalesFunnel = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [days, setDays] = useState(90);
  const { data, isLoading } = useSalesFunnel(days);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <DotCircleLoader />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/trade/dashboard" replace />;

  const stages = data?.stages ?? [];
  const stage = (key: string) => stages.find((item) => item.key === key)?.entries ?? [];
  const bags = stage("abandoned_bags");
  const requests = stage("not_quoted");
  const drafts = stage("draft_quotes");
  const sent = stage("sent_unpaid");
  const orders = stage("orders_pending");
  const stripePaid = stage("webhook_settled");
  const activatedAcquisitions = stage("acquisition_activated");
  const leadCount = bags.length + requests.length + activatedAcquisitions.length;
  const settlementCount = sent.length + orders.length + stripePaid.length;
  const acquisitionMetrics = data?.acquisitionMetrics ?? {
    totalEmailsSent: 0,
    totalDMsSent: 0,
    emailReplyRate: 0,
    dmHookRate: 0,
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-10 md:px-8">
      <Helmet>
        <title>Sales Funnel — Unfinished Quotes & Bags</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Link
        to="/trade/admin-dashboard"
        className="mb-8 inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground md:text-4xl">Sales funnel</h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Everything that started but never completed — with automatic reminders sent on a spaced
            schedule or paused manually.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDays(r.id)}
              className={`h-8 rounded-none px-3 font-body text-[11px] uppercase tracking-[0.18em] ${
                days === r.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <DotCircleLoader />
        </div>
      ) : (
        <>
          <div className="mb-10 overflow-x-auto pb-3">
            <div className="grid min-w-[960px] grid-cols-[0.88fr_1.45fr_1fr_0.8fr] gap-3 xl:gap-5">
              <PipelineColumn
                title="Leads Captured"
                count={leadCount}
                headerDetails={
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 font-body text-[10px] text-muted-foreground">
                        <Mail className="h-3 w-3" aria-hidden="true" /> Emails Sent: {acquisitionMetrics.totalEmailsSent}
                      </span>
                      <span className="inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 font-body text-[10px] text-muted-foreground">
                        <Instagram className="h-3 w-3 text-pink-500/70" aria-hidden="true" /> DMs Copied: {acquisitionMetrics.totalDMsSent}
                      </span>
                    </div>
                    <p className="whitespace-nowrap font-body text-[9px] font-normal text-muted-foreground">
                      Email Response: {acquisitionMetrics.emailReplyRate}% | DM Hook Rate: {acquisitionMetrics.dmHookRate}%
                    </p>
                  </div>
                }
              >
                <GroupLabel count={bags.length}>Shopping bags abandoned</GroupLabel>
                {bags.length ? bags.map((entry) => <EntryCard key={entry.id} entry={entry} />) : <EmptyState label="No abandoned bags" />}
                <GroupLabel count={requests.length}>Requests without a quote</GroupLabel>
                {requests.length ? requests.map((entry) => <EntryCard key={entry.id} entry={entry} />) : <EmptyState label="All requests are quoted" />}
                <GroupLabel count={activatedAcquisitions.length}>Portal-activated studios</GroupLabel>
                {activatedAcquisitions.length ? activatedAcquisitions.map((entry) => <AcquisitionEntryCard key={entry.id} entry={entry} />) : <EmptyState label="No activated studios yet" />}
              </PipelineColumn>

              <PipelineColumn title="Action Required" count={drafts.length} urgent>
                <div className="mb-3 flex items-center gap-2 border-b border-accent/40 px-1 pb-3">
                  <TrendingDown className="h-3.5 w-3.5 text-accent-foreground" />
                  <p className="font-body text-[10px] uppercase tracking-[0.16em] text-foreground">Quotes never sent</p>
                </div>
                {drafts.length ? drafts.map((entry) => <EntryCard key={entry.id} entry={entry} urgent />) : <EmptyState label="No drafts waiting" />}
              </PipelineColumn>

              <PipelineColumn title="Awaiting Settlement" count={settlementCount}>
                {stripePaid.length > 0 && (
                  <>
                    <GroupLabel count={stripePaid.length}>Paid via Stripe</GroupLabel>
                    {stripePaid.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} />
                    ))}
                  </>
                )}
                <GroupLabel count={sent.length}>Quotes sent, not paid</GroupLabel>
                {sent.length ? sent.map((entry) => <EntryCard key={entry.id} entry={entry} quoteCard />) : <EmptyState label="No unpaid quotations" />}
                <GroupLabel count={orders.length}>Orders awaiting payment</GroupLabel>
                {orders.length ? orders.map((entry) => <EntryCard key={entry.id} entry={entry} />) : <EmptyState label="No orders awaiting payment" />}
              </PipelineColumn>

              <PipelineColumn title="Conversions" count={data?.converted ?? 0}>
                <div className="flex min-h-[190px] flex-col items-center justify-center border border-primary/20 bg-primary/5 px-5 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </span>
                  <p className="mt-4 font-display text-5xl text-foreground">{data?.converted ?? 0}</p>
                  <p className="mt-2 font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Completed in this period</p>
                  <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">Paid orders and settled quotations.</p>
                </div>
                <div className="flex items-center gap-2 border border-border bg-card p-3">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <p className="font-body text-xs text-muted-foreground">Closed revenue, ready for fulfilment.</p>
                </div>
              </PipelineColumn>
            </div>
          </div>

           <div className="border-t border-border pt-6">
             <div className="bg-card px-1 py-2">
              <p className="flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5" /> Recent automatic reminders
              </p>
              {(data?.reminders.length ?? 0) === 0 ? (
                <p className="mt-3 font-body text-sm text-muted-foreground">
                  No reminders sent yet. The sweep runs once a day.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data!.reminders.slice(0, 8).map((r) => (
                    <li key={r.id} className="font-body text-xs text-muted-foreground">
                      <span className="text-foreground">{r.stage}</span> · {r.recipient_email} ·
                      reminder {r.reminder_number} · {relative(r.sent_at)}
                    </li>
                  ))}
                </ul>
              )}
             </div>
           </div>
        </>
      )}
    </div>
  );
};

export default TradeAdminSalesFunnel;
