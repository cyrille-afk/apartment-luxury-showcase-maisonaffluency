import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageSquare, ThumbsDown, ThumbsUp, UserPlus, X, Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { formatMoneyIn } from "@/lib/displayMoney";
import { toast } from "@/hooks/use-toast";
import InviteCollaboratorDialog from "./InviteCollaboratorDialog";

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

type Invite = { id: string; email: string; role: string; status: string; last_seen_at: string | null };
type Feedback = { id: string; item_id: string; reaction: string | null; comment: string | null; created_at: string; invite_id: string | null };

const STATUSES = ["pending", "approved", "rejected"] as const;

/** Small cropped finish swatch chips (fabric + wood) with label tooltips. */
export function FinishChips({ fo, size = "h-8 w-8" }: { fo?: { top?: string | null; base?: string | null; top_image?: string | null; base_image?: string | null } | null; size?: string }) {
  if (!fo) return null;
  const chips = [
    { name: fo.top, img: fo.top_image },
    { name: fo.base, img: fo.base_image },
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

export default function ProcurementBoardPanel({ boardId, items, finishOverrides = {}, onOpenFinishes }: {
  boardId: string;
  onOpenFinishes?: (itemId: string) => void;
  finishOverrides?: Record<string, { label: string; price_cents: number | null; image_url: string | null; top?: string | null; base?: string | null; top_image?: string | null; base_image?: string | null }>;
  items: Array<{ id: string; product_id: string; approval_status: string; product?: { product_name: string; brand_name: string; image_url: string | null } }>;
}) {
  const { clientSafe, setClientSafe } = useClientSafeMode();
  const [pricing, setPricing] = useState<Map<string, any>>(new Map());
  const [discountPct, setDiscountPct] = useState(0);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [statusOverride, setStatusOverride] = useState<Record<string, string>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");

  useEffect(() => {
    supabase.from("client_board_items").select("id, notes").eq("board_id", boardId)
      .then(({ data }) => setNotes(Object.fromEntries((data || []).map((d: any) => [d.id, d.notes || ""]))));
  }, [boardId, items.length]);

  const saveNote = async (id: string, value: string) => {
    const v = value.trim().slice(0, 2000);
    setNotes((n) => ({ ...n, [id]: v }));
    const { error } = await supabase.from("client_board_items").update({ notes: v || null }).eq("id", id);
    if (error) toast({ title: "Could not save note", variant: "destructive" });
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
    supabase.rpc("current_trade_discount_pct" as any).then(({ data }) => setDiscountPct(Number(data) || 0));
  }, [productIds]);

  const loadCollab = useCallback(async () => {
    const [{ data: inv }, { data: fb }] = await Promise.all([
      supabase.from("board_invites").select("id, email, role, status, last_seen_at").eq("board_id", boardId).neq("status", "revoked").order("created_at"),
      supabase.from("board_item_feedback").select("id, item_id, reaction, comment, created_at, invite_id").eq("board_id", boardId).order("created_at", { ascending: false }),
    ]);
    setInvites((inv as Invite[]) || []);
    setFeedback((fb as Feedback[]) || []);
  }, [boardId]);

  useEffect(() => {
    loadCollab();
    const ch = supabase
      .channel(`board-feedback-${boardId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "board_item_feedback", filter: `board_id=eq.${boardId}` }, () => loadCollab())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [boardId, loadCollab]);

  const rows: Row[] = items.map((i) => {
    const p = pricing.get(i.product_id) || {};
    const fo = finishOverrides[i.id];
    const lead = p.lead_time || (p.lead_time_weeks_min ? `${p.lead_time_weeks_min}–${p.lead_time_weeks_max ?? p.lead_time_weeks_min} wks` : null);
    return {
      id: i.id,
      product_id: i.product_id,
      approval_status: statusOverride[i.id] ?? i.approval_status ?? "pending",
      product_name: i.product?.product_name || "Selected piece",
      brand_name: i.product?.brand_name || null,
      image_url: fo?.image_url || i.product?.image_url || null,
      msrp_cents: fo?.price_cents ?? (p.trade_price_cents || null),
      currency: p.currency || "EUR",
      lead_time: lead,
      ship_mode: p.default_ship_mode || null,
    };
  });

  const setStatus = async (id: string, status: string) => {
    setStatusOverride((s) => ({ ...s, [id]: status }));
    const { error } = await supabase.from("client_board_items").update({ approval_status: status }).eq("id", id);
    if (error) toast({ title: "Could not update status", variant: "destructive" });
  };

  const revoke = async (id: string) => {
    await supabase.from("board_invites").update({ status: "revoked" }).eq("id", id);
    loadCollab();
  };

  const fbFor = (itemId: string) => feedback.filter((f) => f.item_id === itemId);
  const inviteEmail = (id: string | null) => invites.find((i) => i.id === id)?.email ?? "Guest";

  return (
    <section className="mb-10 border border-border/60 bg-card">
      {/* Master toggle + collaborators */}
      <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className={`font-body text-[10px] uppercase tracking-[0.2em] ${!clientSafe ? "text-foreground" : "text-muted-foreground"}`}>Studio Internal Matrix</span>
          <Switch checked={clientSafe} onCheckedChange={setClientSafe} aria-label="Toggle client editorial presentation" />
          <span className={`font-body text-[10px] uppercase tracking-[0.2em] ${clientSafe ? "text-foreground" : "text-muted-foreground"}`}>Client Editorial Presentation</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invites.map((inv) => (
            <Badge key={inv.id} variant="outline" className="gap-1.5 rounded-none font-body text-[10px] font-normal">
              <span className={`h-1.5 w-1.5 rounded-full ${inv.status === "accepted" || inv.last_seen_at ? "bg-primary" : "bg-muted-foreground/50"}`} />
              {inv.email} · {inv.role === "client" ? "Client" : "Contractor"} · {inv.status === "accepted" ? "joined" : inv.last_seen_at ? "viewed" : "pending"}
              <button onClick={() => revoke(inv.id)} aria-label={`Revoke ${inv.email}`} className="ml-1 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          <Button size="sm" variant="outline" className="gap-1.5 rounded-none" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Invite Collaborator
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!clientSafe ? (
          <motion.div key="matrix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-x-auto">
            <table className="w-full table-fixed font-body text-[11px] leading-tight">
              <colgroup>
                <col className="w-11" /><col className="w-[16%]" /><col className="w-[9%]" /><col className="w-[7%]" /><col className="w-[5%]" /><col className="w-[7%]" /><col className="w-[9%]" /><col className="w-[6%]" /><col className="w-[10%]" /><col />
              </colgroup>
              <thead className="border-b border-border/60 text-left text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5" /><th className="px-2">Product</th><th className="px-2">Manufacturer</th>
                  <th className="px-2 text-right">Trade Price</th><th className="px-2 text-right">Margin</th><th className="px-2 text-right">Client Price</th>
                  <th className="px-2">Lead Time</th><th className="px-2">Shipping</th><th className="px-2">Status</th><th className="px-2">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const trade = r.msrp_cents ? Math.round(r.msrp_cents * (1 - discountPct / 100)) : null;
                  const fb = fbFor(r.id);
                  const hearts = fb.filter((f) => f.reaction === "heart").length;
                  const ups = fb.filter((f) => f.reaction === "up").length;
                  const downs = fb.filter((f) => f.reaction === "down").length;
                  const comments = fb.filter((f) => f.comment);
                  return (
                    <tr key={r.id} className="border-b border-border/40 align-middle">
                      <td className="px-2 py-1">{r.image_url ? <img src={r.image_url} alt="" className="h-8 w-8 bg-[hsl(var(--product-canvas))] object-contain" loading="lazy" /> : <div className="h-8 w-8 bg-muted" />}</td>
                      <td className="truncate px-2 text-foreground" title={r.product_name}>{r.product_name}{finishOverrides[r.id] && <span className="flex items-center gap-1.5"><FinishChips fo={finishOverrides[r.id]} size="h-5 w-5" /><span className="truncate text-[10px] text-muted-foreground">{finishOverrides[r.id].label}</span></span>}</td>
                      <td className="truncate px-2 text-muted-foreground" title={r.brand_name ?? ""}>{r.brand_name ?? "—"}</td>
                      <td className="px-2 text-right tabular-nums">{formatMoneyIn(trade, r.currency, "On request")}</td>
                      <td className="px-2 text-right tabular-nums">{r.msrp_cents ? `${discountPct}%` : "—"}</td>
                      <td className="px-2 text-right tabular-nums">{formatMoneyIn(r.msrp_cents, r.currency, "On request")}</td>
                      <td className="truncate px-2">{r.lead_time ?? "—"}</td>
                      <td className="truncate px-2 capitalize">{r.ship_mode ?? "—"}</td>
                      <td className="px-2">
                        <select value={r.approval_status} onChange={(e) => setStatus(r.id, e.target.value)} className="h-6 w-full border border-border/60 bg-background px-1 text-[10px] capitalize" aria-label={`Status for ${r.product_name}`}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 text-muted-foreground">
                        <Popover onOpenChange={(o) => o && setDraft(notes[r.id] || "")}>
                          <PopoverTrigger asChild>
                            <button type="button" aria-label={`Feedback and notes for ${r.product_name}`} className="group flex h-7 w-full items-center gap-2 border border-transparent px-1.5 text-left transition-colors hover:border-border/60 hover:bg-muted/30 focus:border-border focus:outline-none">
                              {hearts > 0 && <span className="flex shrink-0 items-center gap-0.5"><Heart className="h-3 w-3 fill-current text-primary" />{hearts}</span>}
                              {ups > 0 && <span className="flex shrink-0 items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{ups}</span>}
                              {downs > 0 && <span className="flex shrink-0 items-center gap-0.5"><ThumbsDown className="h-3 w-3" />{downs}</span>}
                              <span className="min-w-0 flex-1 truncate">
                                {comments[0] ? <span className="text-foreground">“{comments[0].comment}”</span> : notes[r.id] ? <span className="italic">{notes[r.id]}</span> : <span className="opacity-0 transition-opacity group-hover:opacity-60">Add note…</span>}
                              </span>
                              {comments.length > 1 && <span className="flex shrink-0 items-center gap-0.5"><MessageSquare className="h-3 w-3" />{comments.length}</span>}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-80 rounded-none p-0">
                            {comments.length > 0 && (
                              <div className="max-h-48 overflow-y-auto border-b border-border/60 px-4 py-3">
                                <p className="mb-2 font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Client feedback</p>
                                {comments.map((c) => (
                                  <div key={c.id} className="mb-2 last:mb-0">
                                    <p className="font-body text-xs text-foreground">{c.comment}</p>
                                    <p className="font-body text-[10px] text-muted-foreground">{inviteEmail(c.invite_id)} · {new Date(c.created_at).toLocaleString()}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="px-4 py-3">
                              <p className="mb-2 font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Internal note · studio only</p>
                              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} rows={3} placeholder="Procurement notes, flags, client summary…" className="rounded-none font-body text-xs" />
                              <div className="mt-2 flex justify-end">
                                <Button size="sm" className="h-7 rounded-none text-[11px]" onClick={() => saveNote(r.id, draft)}>Save note</Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
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
                  {(finishOverrides[r.id]?.image_url || r.image_url) && <img src={finishOverrides[r.id]?.image_url || r.image_url!} alt={r.product_name} className="h-full w-full object-contain" loading="lazy" />}
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
                    <p className="font-body text-sm text-foreground">{formatMoneyIn(r.msrp_cents, r.currency)}</p>
                    {r.lead_time && <p className="mt-0.5 font-body text-xs text-muted-foreground">Lead time {r.lead_time}</p>}
                  </div>
                </div>
              </article>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <InviteCollaboratorDialog open={inviteOpen} onOpenChange={setInviteOpen} boardId={boardId} onInvited={loadCollab} />
    </section>
  );
}
