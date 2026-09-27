import { useCallback, useEffect, useMemo, useState } from "react";
import { trimLogoUrl } from "@/lib/cloudinaryLogo";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Heart, MessageSquare, ThumbsDown, ThumbsUp, Plus, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatMoneyIn } from "@/lib/displayMoney";
import FinishesDrawer, { resolveFinishFrom, type FinishSelection, type PreloadedFinishes } from "@/components/trade/procurement/FinishesDrawer";
import { FinishChips } from "@/components/trade/procurement/ProcurementBoardPanel";

type Item = {
  id: string; product_id: string; product_name: string; image_url: string | null; msrp_cents: number | null; currency: string;
  lead_time: string | null; finish: string | null; approval_status: string; my_reaction: string | null;
  variant_label: string | null; fabric_label: string | null; wood_label: string | null; my_finish: string | null;
};
type Shared = {
  board_title: string; client_name: string | null; studio_name: string; studio_logo_url: string | null;
  project_name: string | null; hide_maison_branding: boolean;
  role: "client" | "contractor"; invite_email: string; claimed: boolean; items: Item[];
};

const PENDING_KEY = "ma_pending_board_claim";
const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

export default function SharedProcurementBoard() {
  const { token: first = "", projectSlug, boardSlug } = useParams();
  const second = boardSlug;
  const param = second ? `${projectSlug}/${second}` : first;
  const isLegacy = !second && /^[0-9a-f]{48}$/.test(first);
  const [token, setToken] = useState<string>(() => (isLegacy ? first : readSession(param)));
  const { user } = useAuth();
  const [data, setData] = useState<Shared | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [microPrompt, setMicroPrompt] = useState(false);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [catalog, setCatalog] = useState<Record<string, PreloadedFinishes> | null>(null);
  const [picks, setPicks] = useState<Record<string, FinishSelection>>({});
  const [drawerFor, setDrawerFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setData(undefined); return; }
    setLoadError(false);
    const { data: d, error } = await supabase.rpc("get_shared_board" as any, { _token: token });
    if (error) { setLoadError(true); setData(null); return; }
    if (!d && !isLegacy) { clearSession(param); setToken(""); return; }
    // Legacy token links: remember the session and mask the address as the project slug.
    if (d && isLegacy) {
      const sh = d as Shared;
      const slug = sh.project_name ? `${slugify(sh.project_name)}/${slugify(sh.board_title)}` : `board/${slugify(sh.board_title)}`;
      writeSession(slug, token); window.history.replaceState(null, "", `/shared/board/${slug}`);
    }
    setData((d as Shared) ?? null);
  }, [token, isLegacy, param]);

  useEffect(() => { load(); }, [load]);

  // Link a freshly signed-in account to this invite (referral + contractor access).
  useEffect(() => {
    if (!user || !data || data.claimed) return;
    if (localStorage.getItem(PENDING_KEY) !== token) return;
    supabase.rpc("claim_board_invite" as any, { _token: token }).then(({ error }) => {
      localStorage.removeItem(PENDING_KEY);
      if (!error) { toast({ title: "Your account is now linked to this board" }); load(); }
    });
  }, [user, data, token, load]);

  // White-label: strip every platform-branded node (static head metadata,
  // JSON-LD, canonical, static hero, noscript fallback) and keep stripping
  // anything re-injected later; swap the favicon for the studio logo.
  const whiteLabel = !!data && data.role === "client" && data.hide_maison_branding;
  useEffect(() => {
    if (!whiteLabel || !data) return;
    const brand = /affluency/i;
    const scrub = () => {
      document.querySelectorAll("#static-hero, #static-designers-hero, noscript").forEach((n) => n.remove());
      document.head.querySelectorAll("meta, link:not([rel='stylesheet']):not([rel='modulepreload']), script[type='application/ld+json']")
        .forEach((n) => { if (brand.test(n.outerHTML)) n.remove(); });
    };
    scrub();
    if (data.studio_logo_url) {
      const icon = document.createElement("link");
      icon.rel = "icon"; icon.href = data.studio_logo_url;
      document.head.appendChild(icon);
    }
    const obs = new MutationObserver(scrub);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [whiteLabel, data]);

  const react = async (item: Item, reaction: "up" | "down" | "heart") => {
    const { error } = await supabase.rpc("submit_board_feedback" as any, { _token: token, _item_id: item.id, _reaction: reaction, _comment: null });
    if (error) { toast({ title: "Could not save", variant: "destructive" }); return; }
    toast({ title: reaction === "heart" ? `${item.product_name} approved` : "Feedback shared with your designer" });
    if (!user) setMicroPrompt(true);
    load();
  };

  const sendComment = async (itemId: string) => {
    const text = comment.trim().slice(0, 1000);
    if (!text) return;
    const { error } = await supabase.rpc("submit_board_feedback" as any, { _token: token, _item_id: itemId, _reaction: null, _comment: text });
    if (error) { toast({ title: "Could not send comment", variant: "destructive" }); return; }
    setComment(""); setCommentFor(null);
    toast({ title: "Comment sent to your designer" });
    if (!user) setMicroPrompt(true);
  };

  // Catalogue finish data (variants, cropped swatches, 3D models) via the invite token.
  useEffect(() => {
    if (!data) return;
    supabase.rpc("get_shared_board_finishes" as any, { _token: token }).then(({ data: c }) => setCatalog((c as any) || {}));
  }, [data, token]);

  // Card state: the client's own request wins over the designer's saved finish.
  const resolved = useMemo(() => {
    const out: Record<string, FinishSelection> = {};
    if (!data || !catalog) return out;
    for (const it of data.items) {
      const c = catalog[it.product_id];
      if (!c) continue;
      if (picks[it.id]) { out[it.id] = picks[it.id]; continue; }
      const [mt, mb] = (it.my_finish || "").split(" / ");
      const src = it.my_finish ? { fabric_label: mt || null, wood_label: mb || null } : it;
      if (!(src.fabric_label || src.wood_label || (src as any).variant_label)) continue;
      out[it.id] = resolveFinishFrom(src, c, c.swatches || []);
    }
    return out;
  }, [data, catalog, picks]);

  // Drawer selections stay local until the client presses the action button.
  const [drawerPicks, setDrawerPicks] = useState<Record<string, FinishSelection>>({});
  const chooseFinish = (item: Item, sel: FinishSelection) => {
    const base = resolved[item.id];
    const same = base && (base.top ?? null) === (sel.top ?? null) && (base.base ?? null) === (sel.base ?? null);
    setDrawerPicks((p) => { const n = { ...p }; if (same) delete n[item.id]; else n[item.id] = sel; return n; });
  };
  const submitDecision = async (item: Item, changed: boolean) => {
    const sel = drawerPicks[item.id];
    if (changed && sel) {
      const text = `Finish request: ${[sel.top, sel.base].filter(Boolean).join(" / ") || sel.label}`;
      const { error } = await supabase.rpc("submit_board_feedback" as any, { _token: token, _item_id: item.id, _reaction: null, _comment: text });
      if (error) { toast({ title: "Could not send your proposal", variant: "destructive" }); return; }
      setPicks((p) => ({ ...p, [item.id]: sel }));
      toast({ title: `Finish update proposed to ${data?.studio_name ?? "your designer"}` });
    } else {
      const { error } = await supabase.rpc("submit_board_feedback" as any, { _token: token, _item_id: item.id, _reaction: "heart", _comment: null });
      if (error) { toast({ title: "Could not save your approval", variant: "destructive" }); return; }
      toast({ title: `${item.product_name} approved` });
    }
    setDrawerPicks((p) => { const n = { ...p }; delete n[item.id]; return n; });
    setDrawerFor(null);
    if (!user) setMicroPrompt(true);
    load();
  };

  const drawerItem = data?.items.find((i) => i.id === drawerFor) ?? null;
  const contractorLocked = data?.role === "contractor" && !(user && data.claimed);

  if (!token) return <AccessGate slug={param} onVerified={(t) => { writeSession(param, t); setToken(t); }} />;
  if (data === undefined) return <div className="min-h-screen bg-background" />;
  if (data === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <Helmet><title>Link unavailable — Maison Affluency</title><meta name="robots" content="noindex" /></Helmet>
        <div>
          <h1 className="font-display text-2xl text-foreground">{loadError ? "We couldn't open this board" : "This link is no longer available"}</h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">{loadError ? "Please try again. If it continues, ask your designer to resend the invitation." : "Please ask your designer for a new invitation."}</p>
          {loadError && <Button variant="outline" className="mt-5 rounded-none" onClick={load}>Try Again</Button>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      onClickCapture={(e) => {
        if (contractorLocked && !signupOpen && !(e.target as HTMLElement).closest("[data-allow-guest]")) {
          e.preventDefault(); e.stopPropagation(); setSignupOpen(true);
        }
      }}
    >
      <Helmet><title>{`${data.project_name || data.board_title} — ${data.studio_name}`}</title><meta name="robots" content="noindex" /></Helmet>

      {data.role === "client" && !data.hide_maison_branding && (
        <div className="border-b border-border/60 bg-muted/30 py-2 text-center font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Viewing Project Portfolio via Maison Affluency Trade Network
        </div>
      )}

      <header className="mx-auto max-w-6xl px-6 pb-10 pt-14 text-center">
        {data.studio_logo_url && <img src={trimLogoUrl(data.studio_logo_url) ?? ""} alt={data.studio_name} className="mx-auto mb-6 h-14 object-contain" />}
        <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{data.studio_name}</p>
        <h1 className="mt-3 font-display text-3xl text-foreground md:text-4xl">{data.project_name || data.board_title}</h1>
        {data.project_name && <p className="mt-2 font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">{data.board_title}</p>}
        {data.client_name && <p className="mt-2 font-body text-sm text-muted-foreground">Prepared for {data.client_name}</p>}
        {data.role === "contractor" && user && data.claimed && (
          <ContractorAdd token={token} onAdded={load} />
        )}
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-x-10 gap-y-16 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item, i) => {
          const fo = resolved[item.id];
          return (
          <motion.article key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.4) }}>
            <div className="relative aspect-[4/5] bg-[hsl(var(--product-canvas))] p-6">
              {(fo?.image_url || item.image_url) && <img src={fo?.image_url || item.image_url || ""} alt={item.product_name} className="h-full w-full object-contain" loading="lazy" />}
              {catalog?.[item.product_id] && (catalog[item.product_id].variants?.length > 0) && (
                <button type="button" data-allow-guest="" onClick={() => setDrawerFor(item.id)} aria-label={`3D View — choose finishes for ${item.product_name}`}
                  className="absolute left-3 top-3 flex items-center gap-1.5 border border-border/60 bg-background/90 px-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.16em] text-foreground backdrop-blur transition-colors hover:border-foreground">
                  <Box className="h-3.5 w-3.5" /> 3D View
                </button>
              )}
            </div>
            <h2 className="mt-4 font-display text-lg text-foreground">{item.product_name}</h2>
            {fo ? (
              <div className="mt-1.5 flex items-center gap-2">
                <FinishChips fo={fo} size="h-7 w-7" />
                <p className="font-body text-xs text-muted-foreground">{fo.label}</p>
              </div>
            ) : item.finish && <p className="mt-0.5 font-body text-xs text-muted-foreground">{item.finish}</p>}
            {picks[item.id] && <p className="mt-1 font-body text-[10px] uppercase tracking-[0.16em] text-primary">Your request sent to {data.studio_name}</p>}
            <p className="mt-1 font-body text-sm text-foreground">{formatMoneyIn(fo?.price_cents ?? item.msrp_cents, item.currency)}</p>
            {item.lead_time && <p className="mt-0.5 font-body text-xs text-muted-foreground">Lead time {item.lead_time}</p>}

            <div className="mt-4 flex items-center gap-1" data-allow-guest={data.role === "client" ? "" : undefined}>
              <FeedbackButton label="Heart to approve" active={item.my_reaction === "heart"} onClick={() => react(item, "heart")}><Heart className={`h-4 w-4 ${item.my_reaction === "heart" ? "fill-current" : ""}`} /></FeedbackButton>
              <FeedbackButton label="Like" active={item.my_reaction === "up"} onClick={() => react(item, "up")}><ThumbsUp className="h-4 w-4" /></FeedbackButton>
              <FeedbackButton label="Dislike" active={item.my_reaction === "down"} onClick={() => react(item, "down")}><ThumbsDown className="h-4 w-4" /></FeedbackButton>
              <FeedbackButton label="Comment" active={commentFor === item.id} onClick={() => setCommentFor(commentFor === item.id ? null : item.id)}><MessageSquare className="h-4 w-4" /></FeedbackButton>
            </div>
            <AnimatePresence>
              {commentFor === item.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" data-allow-guest="">
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Share a thought with your designer" className="mt-3 rounded-none text-sm" />
                  <Button size="sm" className="mt-2 rounded-none" onClick={() => sendComment(item.id)}>Send</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
          );
        })}
      </main>

      {drawerItem && catalog?.[drawerItem.product_id] && (
        <div data-allow-guest="">
          <FinishesDrawer
            open={!!drawerFor}
            onOpenChange={(o) => { if (!o) { setDrawerPicks((p) => { const n = { ...p }; delete n[drawerItem.id]; return n; }); setDrawerFor(null); } }}
            productId={drawerItem.product_id}
            productName={drawerItem.product_name}
            baseImage={drawerItem.image_url}
            clientMode
            initialTop={resolved[drawerItem.id]?.top}
            initialBase={resolved[drawerItem.id]?.base}
            preloaded={catalog[drawerItem.product_id]}
            onSelect={(sel) => chooseFinish(drawerItem, sel)}
            footer={(() => {
              const changed = !!drawerPicks[drawerItem.id];
              return (
                <Button className="h-11 w-full rounded-none font-body text-[11px] uppercase tracking-[0.2em]" onClick={() => submitDecision(drawerItem, changed)}>
                  {changed ? "Propose Finish Update" : "Approve Selection"}
                </Button>
              );
            })()}
          />
        </div>
      )}

      <AnimatePresence>
        {microPrompt && !user && !signupOpen && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} data-allow-guest=""
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-center gap-4 border border-border bg-card p-4 shadow-lg">
            <p className="flex-1 font-body text-xs text-foreground">Save your approval choices and sync with your designer by creating a secure password.</p>
            <Button size="sm" className="rounded-none" onClick={() => setSignupOpen(true)}>Create</Button>
            <button onClick={() => setMicroPrompt(false)} aria-label="Dismiss"><X className="h-4 w-4 text-muted-foreground" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <SignupOverlay
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        data={data}
        token={token}
      />
    </div>
  );
}

function FeedbackButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center border transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border/60 text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function SignupOverlay({ open, onClose, data, token }: { open: boolean; onClose: () => void; data: Shared; token: string }) {
  const [email, setEmail] = useState(data.invite_email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password });
    if (!parsed.success) { setErr(parsed.error.issues[0].message); return; }
    setBusy(true); setErr(null);
    localStorage.setItem(PENDING_KEY, token);
    const { data: res, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `https://www.maisonaffluency.com${window.location.pathname}` },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (res.session) onClose(); else setSent(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-allow-guest=""
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
          <motion.div initial={{ y: 16 }} animate={{ y: 0 }} className="relative w-full max-w-md bg-card p-8">
            <button onClick={onClose} className="absolute right-4 top-4" aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
            {sent ? (
              <div className="text-center">
                <h2 className="font-display text-2xl text-foreground">Check your email</h2>
                <p className="mt-3 font-body text-sm text-muted-foreground">Confirm your address, and you will return to this board with your account linked.</p>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl text-foreground">
                  {data.role === "contractor" ? "Claim your Trade ID" : "Save your choices"}
                </h2>
                <p className="mt-3 font-body text-sm text-muted-foreground">
                  {data.role === "contractor"
                    ? `${data.studio_name} has invited you to collaborate on Maison Affluency. Claim your Trade ID to add pieces to this board.`
                    : `Create a secure password to keep your approvals in sync with ${data.studio_name}.`}
                </p>
                <form onSubmit={submit} className="mt-6 space-y-3">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="Email" className="rounded-none" autoComplete="email" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} placeholder="Password" className="rounded-none" autoComplete="new-password" />
                  {err && <p className="font-body text-xs text-destructive">{err}</p>}
                  <Button type="submit" disabled={busy} className="w-full rounded-none">{busy ? "Creating…" : "Create Account"}</Button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ContractorAdd({ token, onAdded }: { token: string; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; product_name: string; brand_name: string | null }[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("trade_products").select("id, product_name, brand_name").eq("is_active", true)
        .ilike("product_name", `%${term.replace(/[%_]/g, "")}%`).limit(8);
      setResults((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const add = async (id: string) => {
    const { error } = await supabase.rpc("contractor_add_board_item" as any, { _token: token, _product_id: id });
    if (error) { toast({ title: "Could not add piece", variant: "destructive" }); return; }
    toast({ title: "Added to the board" }); setQ(""); onAdded();
  };
  return (
    <div className="relative mx-auto mt-8 max-w-md text-left">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalogue to add a piece" className="rounded-none" />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full border border-border bg-card shadow-md">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => add(r.id)} className="flex w-full items-center justify-between px-3 py-2 text-left font-body text-sm hover:bg-muted">
                <span>{r.product_name}</span><Plus className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Per-guest, per-board session cookie; each verified email gets its own token.
const cookieName = (slug: string) => `ma_bs_${slug.replace(/[^a-z0-9]+/gi, "_")}`;
function readSession(slug: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${cookieName(slug)}=([0-9a-f]{48})`));
  return m ? m[1] : "";
}
function writeSession(slug: string, token: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${cookieName(slug)}=${token}; Path=/shared/board; Max-Age=${60 * 60 * 24 * 30}; SameSite=Strict${secure}`;
}
function clearSession(slug: string) {
  document.cookie = `${cookieName(slug)}=; Path=/shared/board; Max-Age=0; SameSite=Strict`;
}

function slugify(t: string) {
  return (t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function AccessGate({ slug, onVerified }: { slug: string; onVerified: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const call = async (body: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke("board-access", { body: { slug, ...body } });
    if (error) {
      let msg = "Access denied.";
      try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* keep default */ }
      throw new Error(msg);
    }
    return data as any;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    // Read the live DOM value too: browser autofill can fill the field without firing onChange.
    const domEmail = (e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>('input[type="email"]')?.value;
    const raw = (domEmail || email || "").trim();
    if (raw !== email) setEmail(raw);
    const parsed = z.string().trim().email().max(255).safeParse(raw);
    if (!parsed.success) { setErr("Enter a valid email"); return; }
    setBusy(true);
    try {
      if (step === "email") { await call({ action: "request", email: parsed.data }); setStep("code"); }
      else {
        if (!/^\d{6}$/.test(code)) { setErr("Enter the 6-digit code"); setBusy(false); return; }
        const r = await call({ action: "verify", email: parsed.data, code });
        onVerified(r.token);
      }
    } catch (x: any) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Helmet><title>Private board</title><meta name="robots" content="noindex" /></Helmet>
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Private Project Board</p>
        <h1 className="mt-3 font-display text-2xl text-foreground">{step === "email" ? "Verify your email" : "Enter your code"}</h1>
        <p className="mt-2 font-body text-sm text-muted-foreground">
          {step === "email" ? "Enter the email address your designer invited." : `We sent a 6-digit code to ${email}.`}
        </p>
        <div className="mt-6 space-y-3 text-left">
          {step === "email" ? (
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="name@example.com" className="rounded-none" autoComplete="email" name="email" onInput={(e) => setEmail((e.target as HTMLInputElement).value)} autoFocus />
          ) : (
            <Input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="rounded-none text-center tracking-[0.5em]" autoComplete="one-time-code" autoFocus />
          )}
          {err && <p className="font-body text-xs text-destructive">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full rounded-none">{busy ? "Please wait…" : step === "email" ? "Send Code" : "Open Board"}</Button>
          {step === "code" && <button type="button" className="w-full font-body text-xs text-muted-foreground underline" onClick={() => { setStep("email"); setCode(""); }}>Use a different email</button>}
        </div>
      </form>
    </div>
  );
}
