import { uniqueCollaborators } from "@/lib/uniqueCollaborators";
import { invitationEmailState, latestInvitationEmail, type InvitationEmailStatus } from "@/lib/invitationEmailStatus";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toDiscountFraction, tradePriceCents, clientPriceCents, clientUnitCents, discountPercentLabel, effectiveProjectMultiplier } from "@/lib/tradePricing";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageSquare, ThumbsDown, ThumbsUp, UserPlus, X, Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import BoardFeedbackPanel from "./BoardFeedbackPanel";
import { resolveSavedFinishes, type FinishSelection } from "./FinishesDrawer";
import { latestBoardFinishRequests, type BoardDraftSource } from "@/lib/boardDraftQuote";
import { useDraftQuoteCompiler } from "@/hooks/useDraftQuoteCompiler";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { formatMoneyIn } from "@/lib/displayMoney";
import { toast } from "@/hooks/use-toast";
import { useStudio } from "@/hooks/useStudio";
import InviteCollaboratorDialog from "./InviteCollaboratorDialog";
import BoardInviteEmailPreview from "./BoardInviteEmailPreview";

type Row = {
  id: string;
  product_id: string;
  approval_status: string;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  msrp_cents: number | null;
  currency: string;
  lead_time: string | null;
  ship_mode: string | null;
};

type Invite = { id: string; email: string; role: string; status: string; last_seen_at: string | null; created_at: string };
type Feedback = { id: string; item_id: string; reaction: string | null; comment: string | null; created_at: string; invite_id: string | null };

const STATUSES = ["pending", "approved", "rejected"] as const;

/** Small cropped finish swatch chips (fabric + wood) with label tooltips. */
export function FinishChips({ fo, size = "h-8 w-8" }: { fo?: { top?: string | null; base?: string | null; top_image?: string | null; base_image?: string | null; extra?: { name: string; img: string | null }[] } | null; size?: string }) {
  if (!fo) return null;
  const chips = [
    { name: fo.top, img: fo.top_image },
    { name: fo.base, img: fo.base_image },
    ...(fo.extra ?? []),
  ].filter((c) => c.name || c.img);
  if (!chips.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {chips.map((c, i) => (
        <span key={i} title={c.name ?? undefined} aria-label={c.name ?? undefined}
          className={`${size} shrink-0 overflow-hidden rounded-full border border-border/60 bg-[hsl(var(--product-canvas))]`}>
          {c.img ? <img src={c.img} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="block h-full w-full bg-muted" />}
        </span>
      ))}
    </span>
  );
}

export default function ProcurementBoardPanel({ boardId, boardTitle, projectId, items, finishOverrides = {}, onOpenFinishes, onDraftChange, onRequestedFinishes }: {
  boardId: string;
  boardTitle?: string;
  projectId?: string | null;
  onDraftChange?: (draft: ReturnType<typeof useDraftQuoteCompiler>) => void;
  onRequestedFinishes?: (finishes: Record<string, FinishSelection>) => void;
  onOpenFinishes?: (itemId: string) => void;
  finishOverrides?: Record<string, { label: string; price_cents: number | null; image_url: string | null; top?: string | null; base?: string | null; top_image?: string | null; base_image?: string | null; extra?: { name: string; img: string | null }[] }>;
  items: Array<{ id: string; product_id: string; approval_status: string; product?: { product_name: string; brand_name: string; image_url: string | null } }>;
}) {
  const { clientSafe, setClientSafe } = useClientSafeMode();
  const { currentStudio } = useStudio();
  const [pricing, setPricing] = useState<Map<string, any>>(new Map());
  const [discountPct, setDiscountPct] = useState(0); // fraction (0.10 = 10%)
  const [multiplier, setMultiplier] = useState(1);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [emailStatuses, setEmailStatuses] = useState<InvitationEmailStatus[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [statusOverride, setStatusOverride] = useState<Record<string, string>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackSenders, setFeedbackSenders] = useState<Record<string, string>>({});
  const [requestedFinishes, setRequestedFinishes] = useState<Record<string, FinishSelection>>({});
  const [savedStatuses, setSavedStatuses] = useState<Record<string, string>>({});
  const [syncReady, setSyncReady] = useState(false);
  const requests = useMemo(() => latestBoardFinishRequests(feedback), [feedback]);
  const requestKey = JSON.stringify(requests);
  useEffect(() => {
    let alive = true;
    setSyncReady(false);
    const selected = items.filter((item) => requests[item.id]).map((item) => ({ id: item.id, product_id: item.product_id, variant_label: requests[item.id] }));
    resolveSavedFinishes(selected, true).then((resolved) => {
      if (!alive) return;
      for (const item of selected) if (!resolved[item.id]) resolved[item.id] = { label: item.variant_label, price_cents: null, image_url: null };
      setRequestedFinishes(resolved); onRequestedFinishes?.(resolved); setSyncReady(true);
    }).catch(() => { if (alive) setSyncReady(false); });
    return () => { alive = false; };
  }, [boardId, productIdsKey(items), requestKey, onRequestedFinishes]);
  const effectiveFinishes = { ...finishOverrides, ...requestedFinishes };

  useEffect(() => {
    supabase.from("client_board_items").select("id, notes").eq("board_id", boardId)
      .then(({ data }) => setNotes(Object.fromEntries((data || []).map((d: any) => [d.id, d.notes || ""]))));
  }, [boardId, items.length]);

  const saveNote = async (id: string, value: string) => {
    const v = value.trim().slice(0, 2000);
    const { error } = await supabase.from("client_board_items").update({ notes: v || null }).eq("id", id);
    if (error) { toast({ title: "Could not save note", variant: "destructive" }); return false; }
    setNotes((n) => ({ ...n, [id]: v }));
    return true;
  };

  const productIds = useMemo(() => items.map((i) => i.product_id).join(","), [items]);

  useEffect(() => {
    const ids = productIds ? productIds.split(",") : [];
    if (!ids.length) return;
    supabase
      .from("trade_products")
      .select("id, trade_price_cents, currency, lead_time, lead_time_weeks_min, lead_time_weeks_max, default_ship_mode")
      .in("id", ids)
      .then(({ data }) => setPricing(new Map((data || []).map((p: any) => [p.id, p]))));
    supabase.rpc("current_trade_discount_pct" as any).then(({ data }) => setDiscountPct(toDiscountFraction(data)));
  }, [productIds]);

  // Quote-synced pieces carry the configured net snapshot saved on the quote line.
  const [quoteNet, setQuoteNet] = useState<Map<string, { net: number; currency: string; quantity: number }>>(new Map());
  useEffect(() => {
    (async () => {
      const { data: links } = await supabase.from("client_board_items").select("id, source_quote_item_id").eq("board_id", boardId).not("source_quote_item_id", "is", null);
      const ids = (links || []).map((l: any) => l.source_quote_item_id);
      if (!ids.length) return setQuoteNet(new Map());
      const { data: qi } = await supabase.from("trade_quote_items").select("id, unit_price_cents, unit_price_currency, quantity").in("id", ids);
      const byQi = new Map((qi || []).map((q: any) => [q.id, q]));
      const m = new Map<string, { net: number; currency: string; quantity: number }>();
      for (const l of links as any[]) {
        const q: any = byQi.get(l.source_quote_item_id);
        if (q) m.set(l.id, { net: q.unit_price_cents == null ? NaN : Math.round(Number(q.unit_price_cents)), currency: q.unit_price_currency || "EUR", quantity: q.quantity });
      }
      setQuoteNet(m);
    })();
  }, [boardId, productIds]);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from("client_boards").select("project_id").eq("id", boardId).maybeSingle();
      const pid = (b as any)?.project_id;
      if (!pid) return setMultiplier(effectiveProjectMultiplier(null, currentStudio?.default_project_markup_percentage));
      const { data: p } = await supabase.from("projects").select("trade_multiplier").eq("id", pid).maybeSingle();
      setMultiplier(effectiveProjectMultiplier((p as any)?.trade_multiplier, currentStudio?.default_project_markup_percentage));
    })();
  }, [boardId, currentStudio?.default_project_markup_percentage]);

  const loadCollab = useCallback(async () => {
    const [{ data: inv }, { data: fb }, delivery, { data: senders }, saved] = await Promise.all([
      supabase.from("board_invites").select("id, email, role, status, last_seen_at, created_at").eq("board_id", boardId).neq("status", "revoked").order("created_at"),
      supabase.from("board_item_feedback").select("id, item_id, reaction, comment, created_at, invite_id").eq("board_id", boardId).order("created_at", { ascending: false }),
      supabase.rpc("board_invitation_email_status", { _board_id: boardId }),
      supabase.from("board_invites").select("id, email").eq("board_id", boardId),
      supabase.from("client_board_items").select("id, approval_status").eq("board_id", boardId),
    ]);
    setInvites((inv as Invite[]) || []);
    setFeedback((fb as Feedback[]) || []);
    setFeedbackSenders(Object.fromEntries((senders || []).map((sender) => [sender.id, sender.email])));
    setEmailStatuses(delivery.error ? [] : delivery.data || []);
    if (!saved.error) { setSavedStatuses(Object.fromEntries((saved.data || []).map((item) => [item.id, item.approval_status]))); setStatusOverride({}); }
  }, [boardId]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void loadCollab(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("ma:quote-folder-linked", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ma:quote-folder-linked", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadCollab]);

  useEffect(() => {
    loadCollab();
    const ch = supabase
      .channel(`board-feedback-${boardId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "board_item_feedback", filter: `board_id=eq.${boardId}` }, () => loadCollab())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "board_item_feedback" }, () => loadCollab())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "client_board_items", filter: `board_id=eq.${boardId}` }, (p: any) => {
        if (p.new?.id && p.new?.approval_status) setStatusOverride((s) => ({ ...s, [p.new.id]: p.new.approval_status }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [boardId, loadCollab]);

  const rows: Row[] = items.map((i) => {
    const p = pricing.get(i.product_id) || {};
    const fo = effectiveFinishes[i.id];
    const savedNet = quoteNet.get(i.id);
    const lead = p.lead_time || (p.lead_time_weeks_min ? `${p.lead_time_weeks_min}–${p.lead_time_weeks_max ?? p.lead_time_weeks_min} wks` : null);
    return {
      id: i.id,
      product_id: i.product_id,
      approval_status: statusOverride[i.id] ?? savedStatuses[i.id] ?? i.approval_status ?? "pending",
      product_name: i.product?.product_name || "Selected piece",
      brand_name: i.product?.brand_name || null,
      image_url: fo?.image_url || i.product?.image_url || null,
      msrp_cents: requests[i.id] ? requestedFinishes[i.id]?.price_cents ?? null : savedNet && Number.isFinite(savedNet.net)
        ? Math.round(savedNet.net / Math.max(0.01, 1 - discountPct))
        : fo?.price_cents ?? (p.trade_price_cents || null),
      currency: quoteNet.get(i.id)?.currency || p.currency || "EUR",
      lead_time: lead,
      ship_mode: p.default_ship_mode || null,
    };
  });
  const draftSources: BoardDraftSource[] = rows.map((row) => ({ ...row, quantity: quoteNet.get(row.id)?.quantity ?? 1,
    retailCents: row.msrp_cents, netCents: requests[row.id] ? null : Number.isFinite(quoteNet.get(row.id)?.net) ? quoteNet.get(row.id)?.net : null,
    finish: effectiveFinishes[row.id] ?? null, requested: Boolean(requests[row.id]) }));
  const draftKey = JSON.stringify(draftSources);
  const stableSources = useMemo(() => draftSources, [draftKey]);
  const compiled = useDraftQuoteCompiler(stableSources, discountPct, multiplier);
  useEffect(() => { onDraftChange?.({ ...compiled, ready: compiled.ready && syncReady }); }, [compiled, syncReady, onDraftChange]);

  const setStatus = async (id: string, status: string) => {
    setStatusOverride((s) => ({ ...s, [id]: status }));
    const { error } = await supabase.from("client_board_items").update({ approval_status: status }).eq("id", id);
    if (error) { setStatusOverride((s) => { const next = { ...s }; delete next[id]; return next; }); toast({ title: "Could not update status", variant: "destructive" }); }
    else void loadCollab();
  };

  const revoke = async (ids: string[]) => {
    await supabase.from("board_invites").update({ status: "revoked" }).in("id", ids);
    loadCollab();
  };

  const fbFor = (itemId: string) => feedback.filter((f) => f.item_id === itemId);
  const inviteEmail = (id: string | null) => id ? feedbackSenders[id] || "Client" : "Client";
  const feedbackRow = rows.find((row) => row.id === feedbackFor);
  useEffect(() => { if (clientSafe) setFeedbackFor(null); }, [clientSafe]);

  return (
    <section className="mb-10 border border-border/60 bg-card">
      {/* Master toggle + collaborators */}
      <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3" data-felix-target="client-view-toggle">
           <span className={`font-body text-[10px] uppercase tracking-[0.2em] ${!clientSafe ? "text-foreground" : "text-muted-foreground"}`}>{clientSafe ? "Studio View" : "Studio Internal Matrix"}</span>
          <Switch checked={clientSafe} onCheckedChange={setClientSafe} aria-label="Toggle client editorial presentation" />
          <span className={`font-body text-[10px] uppercase tracking-[0.2em] ${clientSafe ? "text-foreground" : "text-muted-foreground"}`}>Client Editorial Presentation</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {uniqueCollaborators(invites).map((inv) => {
            const delivery = latestInvitationEmail(inv.ids, emailStatuses);
            const emailState = invitationEmailState(delivery?.email_status);
            return (
            <Badge key={inv.id} variant="outline" className="gap-1.5 rounded-none font-body text-[10px] font-normal">
              <span className={`h-1.5 w-1.5 rounded-full ${inv.status === "accepted" || inv.last_seen_at ? "bg-primary" : "bg-muted-foreground/50"}`} />
              {inv.email} · {inv.role === "client" ? "Client" : "Contractor"} · {inv.status === "accepted" ? "joined" : inv.last_seen_at ? "viewed" : "pending"}
              <span className={emailState.tone} title={`${emailState.detail}${delivery?.updated_at ? ` Last update: ${new Date(delivery.updated_at).toLocaleString()}` : ""}`} aria-live="polite">· {emailState.label}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => revoke(inv.ids)} aria-label={`Revoke ${inv.email}`} className="ml-1 h-5 w-5 shrink-0 cursor-pointer opacity-60 hover:opacity-100"><X className="h-3 w-3" /></Button>
            </Badge>
          ); })}
          <BoardInviteEmailPreview boardTitle={boardTitle} projectId={projectId} studioName={currentStudio?.name} itemCount={items.length} />
          <Button size="sm" variant="outline" className="gap-1.5 rounded-none" data-felix-target="invite-collaborator" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Invite Collaborator
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!clientSafe ? (
           <motion.div key="matrix" data-trade-sensitive initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-x-auto">
            <table className="w-full table-fixed font-body text-[11px] leading-tight">
              <colgroup>
                <col className="w-11" /><col /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[6%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[7%]" /><col className="w-[11%]" /><col className="w-12" />
              </colgroup>
              <thead className="border-b border-border/60 text-left text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5" /><th className="px-2">Product</th><th className="px-2">Manufacturer</th>
                  <th className="px-2 text-right">Trade Price</th><th className="px-2 text-right">Margin</th><th className="px-2 text-right">Client Price</th>
                  <th className="px-2">Lead Time</th><th className="px-2">Shipping</th><th className="px-2">Status</th><th className="px-2"><span className="sr-only">Messages</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const trade = tradePriceCents(r.msrp_cents, discountPct);
                  const client = clientUnitCents(r.msrp_cents, discountPct, multiplier);
                  const fb = fbFor(r.id);
                  return (
                    <tr key={r.id} className="border-b border-border/40 align-middle">
                      <td className="px-2 py-1">{r.image_url ? (onOpenFinishes ? <button type="button" onClick={() => onOpenFinishes(r.id)} aria-label={`Open ${r.product_name}`} className="block cursor-pointer"><img src={r.image_url} alt="" className="h-8 w-8 bg-[hsl(var(--product-canvas))] object-contain" loading="lazy" /></button> : <img src={r.image_url} alt="" className="h-8 w-8 bg-[hsl(var(--product-canvas))] object-contain" loading="lazy" />) : <div className="h-8 w-8 bg-muted" />}</td>
                      <td className="px-2 py-1 text-foreground" title={r.product_name}><span className="block truncate">{r.product_name}</span>{effectiveFinishes[r.id] && <span className="flex flex-wrap items-center gap-1.5"><FinishChips fo={effectiveFinishes[r.id]} size="h-5 w-5" /><span className="min-w-0 text-[10px] text-muted-foreground">{effectiveFinishes[r.id].label}</span>{requests[r.id] && <span className="border-l border-primary/40 pl-1.5 text-[9px] text-primary">Client requested</span>}</span>}</td>
                      <td className="truncate px-2 text-muted-foreground" title={r.brand_name ?? ""}>{r.brand_name ?? "—"}</td>
                      <td className="px-2 text-right tabular-nums">{formatMoneyIn(trade, r.currency, requests[r.id] ? "Price verification needed" : "On request")}</td>
                      <td className="px-2 text-right tabular-nums">{r.msrp_cents ? discountPercentLabel(discountPct) : "—"}</td>
                      <td className="px-2 text-right tabular-nums">{formatMoneyIn(client, r.currency, "On request")}</td>
                      <td className="truncate px-2">{r.lead_time ?? "—"}</td>
                      <td className="truncate px-2 capitalize">{r.ship_mode ?? "—"}</td>
                      <td className="px-2">
                        <select value={r.approval_status} onChange={(e) => setStatus(r.id, e.target.value)} className={`h-6 w-full border px-1 text-[10px] capitalize ${r.approval_status === "approved" ? "border-emerald-700 bg-emerald-600 font-semibold text-white" : r.approval_status === "rejected" ? "border-destructive bg-destructive font-semibold text-destructive-foreground" : "border-border/60 bg-background"}`} aria-label={`Status for ${r.product_name}`}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 text-center">
                        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" onClick={() => setFeedbackFor(r.id)} aria-label={`Feedback and notes for ${r.product_name}`} className={`h-8 w-8 cursor-pointer rounded-none ${fb.length ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:text-foreground"}`}>
                            <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger><TooltipContent>Client feedback &amp; private notes</TooltipContent></Tooltip></TooltipProvider>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Add products to start the matrix.</td></tr>}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <motion.div key="editorial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="grid grid-cols-1 gap-x-8 gap-y-12 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <article key={r.id} className="flex flex-col">
                <div className="relative aspect-[4/5] bg-[hsl(var(--product-canvas))] p-6">
                  {onOpenFinishes && (
                    <button type="button" onClick={() => onOpenFinishes(r.id)} aria-label={`Materials and finishes for ${r.product_name}`}
                      className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 border border-border/60 bg-background/85 px-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-foreground backdrop-blur-sm transition-colors hover:bg-background">
                      <Box className="h-3.5 w-3.5" strokeWidth={1.5} /> 3D View
                    </button>
                  )}
                  {(finishOverrides[r.id]?.image_url || r.image_url) && <img src={finishOverrides[r.id]?.image_url || r.image_url!} alt={r.product_name} onClick={onOpenFinishes ? () => onOpenFinishes(r.id) : undefined} className={`h-full w-full object-contain${onOpenFinishes ? " cursor-pointer" : ""}`} loading="lazy" />}
                </div>
                <div className="mt-4 flex min-h-[96px] flex-1 flex-col justify-between">
                  <div>
                    <h3 className="font-display text-lg text-foreground">{r.product_name}</h3>
                    {finishOverrides[r.id] && (
                      <p className="mt-1 flex items-start gap-2 font-body text-xs text-muted-foreground">
                        <FinishChips fo={finishOverrides[r.id]} />
                        <span className="line-clamp-2">{finishOverrides[r.id].label}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    {r.approval_status === "approved" && <p className="mb-1 flex items-center gap-1 font-body text-[10px] uppercase tracking-[0.18em] text-primary"><Heart className="h-3 w-3 fill-current" /> Approved</p>}
                     <p className="font-body text-sm text-foreground">{formatMoneyIn(clientUnitCents(r.msrp_cents, discountPct, multiplier), r.currency, "Price upon Request")}</p>
                    {r.lead_time && <p className="mt-0.5 font-body text-xs text-muted-foreground">Lead time {r.lead_time}</p>}
                  </div>
                </div>
              </article>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
       {!clientSafe && <div data-client-placeholder aria-hidden="true" className="grid grid-cols-1 gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3"><div className="aspect-[4/5] animate-pulse bg-muted/60" /><div className="aspect-[4/5] animate-pulse bg-muted/60" /><div className="aspect-[4/5] animate-pulse bg-muted/60" /></div>}

      {!clientSafe && feedbackRow && <BoardFeedbackPanel key={feedbackRow.id} productName={feedbackRow.product_name}
        entries={fbFor(feedbackRow.id).map((entry) => ({ ...entry, sender: inviteEmail(entry.invite_id) }))}
        note={notes[feedbackRow.id] || ""} onClose={() => setFeedbackFor(null)} onSave={(value) => saveNote(feedbackRow.id, value)} />}
      <InviteCollaboratorDialog open={inviteOpen} onOpenChange={setInviteOpen} boardId={boardId} onInvited={loadCollab} />
    </section>
  );
}
