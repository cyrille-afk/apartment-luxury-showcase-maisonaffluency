import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useSalesFunnel } from "@/hooks/useSalesFunnel";

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

const TradeAdminSalesFunnel = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [days, setDays] = useState(90);
  const [open, setOpen] = useState<string | null>(null);
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
  const widest = Math.max(1, ...stages.map((s) => s.entries.length));

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
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
            Everything that started but never completed — with automatic reminders sent daily.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setDays(r.id)}
              className={`border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.18em] transition-colors ${
                days === r.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <DotCircleLoader />
        </div>
      ) : (
        <>
          <div className="mb-10 space-y-3">
            {stages.map((stage) => {
              const pct = Math.round((stage.entries.length / widest) * 100);
              const isOpen = open === stage.key;
              return (
                <div key={stage.key} className="border border-border bg-card">
                  <button
                    onClick={() => setOpen(isOpen ? null : stage.key)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="font-body text-[11px] uppercase tracking-[0.2em] text-foreground">
                          {stage.title}
                        </p>
                        <span className="font-body text-lg text-foreground">
                          {stage.entries.length}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        {stage.description}
                      </p>
                      <div className="mt-3 h-1 w-full bg-muted">
                        <div className="h-1 bg-foreground/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border">
                      {stage.entries.length === 0 ? (
                        <p className="px-5 py-4 font-body text-sm text-muted-foreground">
                          Nothing stalled here.
                        </p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {stage.entries.map((e) => (
                            <li
                              key={e.id}
                              className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-body text-sm text-foreground">
                                  {e.label}
                                </p>
                                <p className="truncate font-body text-xs text-muted-foreground">
                                  {e.sublabel} · {relative(e.createdAt)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-4">
                                {e.amountLabel && (
                                  <span className="font-body text-xs text-muted-foreground">
                                    {e.amountLabel}
                                  </span>
                                )}
                                {e.email && (
                                  <a
                                    href={`mailto:${e.email}`}
                                    className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                                  >
                                    <Mail className="h-3.5 w-3.5" /> Email
                                  </a>
                                )}
                                {e.href && (
                                  <Link
                                    to={e.href}
                                    className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.18em] text-foreground"
                                  >
                                    Open <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="border border-border bg-card px-5 py-4">
              <p className="font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Completed in this period
              </p>
              <p className="mt-2 font-display text-3xl text-foreground">{data?.converted ?? 0}</p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                Paid orders and settled quotations.
              </p>
            </div>

            <div className="border border-border bg-card px-5 py-4">
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
