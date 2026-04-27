/**
 * /trade/custom-requests — designer's inbox of bespoke / customisation requests
 * sent to the Maison Affluency concierge. Trade users see their own submissions;
 * admins see all and can reply directly with concierge notes + status updates.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, Wand2, Inbox, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type CustomRequest = {
  id: string;
  product_name: string;
  brand_name: string | null;
  status: string;
  dimension_changes: string | null;
  finish_notes: string | null;
  com_col_fabric: string | null;
  quantity: number;
  target_lead_weeks: number | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  user_id: string;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  in_review: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  quoted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  declined: "bg-destructive/10 text-destructive border-destructive/30",
  completed: "bg-foreground/10 text-foreground border-foreground/30",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_review: "In Review",
  quoted: "Quoted",
  declined: "Declined",
  completed: "Completed",
};

const STATUS_OPTIONS = ["new", "in_review", "quoted", "declined", "completed"] as const;
const ADMIN_NOTES_MAX = 4000;

export default function TradeCustomRequests() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { admin_notes: string; status: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId || loading || requests.length === 0) return;
    const el = document.getElementById(`cr-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightId(focusId);
    const t = setTimeout(() => setHighlightId(null), 2400);
    return () => clearTimeout(t);
  }, [focusId, loading, requests]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("trade_custom_requests")
        .select("id, product_name, brand_name, status, dimension_changes, finish_notes, com_col_fabric, quantity, target_lead_weeks, notes, admin_notes, created_at, user_id")
        .order("created_at", { ascending: false });
      if (!error && data) setRequests(data as CustomRequest[]);
      setLoading(false);
    })();
  }, [user]);

  const getDraft = (r: CustomRequest) =>
    drafts[r.id] ?? { admin_notes: r.admin_notes ?? "", status: r.status };

  const isDirty = (r: CustomRequest) => {
    const d = drafts[r.id];
    if (!d) return false;
    return d.admin_notes !== (r.admin_notes ?? "") || d.status !== r.status;
  };

  const saveReply = async (r: CustomRequest) => {
    const d = getDraft(r);
    const trimmed = d.admin_notes.trim();
    if (trimmed.length > ADMIN_NOTES_MAX) {
      toast({ title: "Note too long", description: `Maximum ${ADMIN_NOTES_MAX} characters.`, variant: "destructive" });
      return;
    }
    setSavingId(r.id);
    const { error } = await supabase
      .from("trade_custom_requests")
      .update({ admin_notes: trimmed || null, status: d.status })
      .eq("id", r.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Couldn't save reply", description: error.message, variant: "destructive" });
      return;
    }
    setRequests((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, admin_notes: trimmed || null, status: d.status } : x)),
    );
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    toast({ title: "Reply sent", description: "The trade user will see your concierge note." });
  };

  const headline = useMemo(
    () =>
      isAdmin
        ? "Manage every bespoke request from the Maison Affluency concierge inbox — reply, update status, and keep clients informed."
        : "Track every customisation request — dimension tweaks, COM/COL fabric, alternative finishes — sent to our concierge. Submit new requests from any product page.",
    [isAdmin],
  );

  return (
    <>
      <Helmet><title>Custom Requests — Trade Portal</title></Helmet>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Wand2 className="h-4 w-4 text-foreground" />
              <span className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {isAdmin ? "Concierge Inbox" : "Bespoke"}
              </span>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full border border-foreground/20 px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.12em] text-foreground">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">
              Custom Requests
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-1.5 max-w-2xl">
              {headline}
            </p>
          </div>
        </div>

        {authLoading || loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <p className="font-body text-sm text-muted-foreground">Sign in to view your custom requests.</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No custom requests yet.</p>
            <p className="font-body text-xs text-muted-foreground/70 mt-1">
              Open any product and select <span className="text-foreground">Request Customisation</span> to start.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const statusKey = r.status in STATUS_STYLES ? r.status : "new";
              const draft = getDraft(r);
              const dirty = isDirty(r);
              return (
                <div key={r.id} className="border border-border rounded-lg p-4 md:p-5 bg-background">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base md:text-lg text-foreground tracking-wide truncate">
                        {r.product_name}
                      </h3>
                      {r.brand_name && (
                        <p className="font-body text-xs text-muted-foreground mt-0.5">{r.brand_name}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full border font-body text-[10px] uppercase tracking-[0.12em] ${STATUS_STYLES[statusKey]}`}>
                      {STATUS_LABELS[statusKey] || statusKey}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {r.dimension_changes && <Row label="Dimensions" value={r.dimension_changes} />}
                    {r.finish_notes && <Row label="Finish" value={r.finish_notes} />}
                    {r.com_col_fabric && <Row label="COM / COL" value={r.com_col_fabric} />}
                    {r.target_lead_weeks != null && <Row label="Target lead" value={`${r.target_lead_weeks} wks`} />}
                    <Row label="Quantity" value={String(r.quantity)} />
                    <Row label="Submitted" value={new Date(r.created_at).toLocaleDateString()} />
                  </dl>

                  {r.notes && (
                    <p className="mt-3 pt-3 border-t border-border font-body text-xs text-muted-foreground">
                      <span className="text-foreground/70 uppercase tracking-wider text-[10px] mr-2">Notes</span>
                      {r.notes}
                    </p>
                  )}

                  {isAdmin ? (
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="font-body text-[10px] uppercase tracking-[0.12em] text-foreground/70">
                          Concierge Reply
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            Status
                          </label>
                          <select
                            value={draft.status}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [r.id]: { ...getDraft(r), status: e.target.value },
                              }))
                            }
                            className="bg-background border border-border rounded-md px-2 py-1.5 font-body text-xs text-foreground focus:outline-none focus:border-foreground/40"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <textarea
                        value={draft.admin_notes}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...getDraft(r), admin_notes: e.target.value.slice(0, ADMIN_NOTES_MAX) },
                          }))
                        }
                        rows={4}
                        placeholder="Write your concierge response — pricing guidance, lead time, fabric availability, etc."
                        className="w-full bg-background border border-border rounded-md px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 resize-y"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-body text-[10px] text-muted-foreground/70">
                          {draft.admin_notes.length} / {ADMIN_NOTES_MAX}
                        </span>
                        <div className="flex items-center gap-2">
                          {dirty && (
                            <button
                              onClick={() =>
                                setDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[r.id];
                                  return next;
                                })
                              }
                              className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
                            >
                              Discard
                            </button>
                          )}
                          <button
                            onClick={() => saveReply(r)}
                            disabled={!dirty || savingId === r.id}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-foreground/20 bg-foreground text-background rounded-md font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {savingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Save reply
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    r.admin_notes && (
                      <div className="mt-3 pt-3 border-t border-border bg-muted/30 -mx-4 -mb-4 md:-mx-5 md:-mb-5 px-4 md:px-5 py-3 rounded-b-lg">
                        <p className="font-body text-[10px] uppercase tracking-[0.12em] text-foreground/70 mb-1">
                          Concierge response
                        </p>
                        <p className="font-body text-sm text-foreground whitespace-pre-wrap">{r.admin_notes}</p>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{label}</dt>
      <dd className="font-body text-sm text-foreground">{value}</dd>
    </div>
  );
}
