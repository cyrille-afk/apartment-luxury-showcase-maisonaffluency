import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Save, Plus, Trash2, ArrowUp, ArrowDown, Eye, RotateCcw, Check,
  Search, Loader2, AlertTriangle,
} from "lucide-react";

/** Mirrors the icon map used by QuickTour so admins can pick a valid name. */
const ICON_OPTIONS = ["MapPin", "Users", "FileText", "Sparkles", "Image", "Box", "Compass", "BookOpen", "FolderOpen"] as const;

interface Step {
  id?: string;
  step_key: string;
  title: string;
  body: string;
  path: string;
  icon: string;
  cta_label: string;
  sort_order: number;
  is_active: boolean;
}

interface ButtonCfg { label: string; prompt: string; primary?: boolean; }

interface FlowConfig {
  greeting_template: string;
  buttons: ButtonCfg[];
  is_enabled: boolean;
}

interface UserRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  has_seen_trade_intro: boolean | null;
}

const DEFAULT_GREETING =
  "Welcome to Maison Affluency{first_name_comma} — I'm {concierge_name}. Want a quick tour, or shall we start from a brief?\n\n_Tip: you can rename me any time — I'll answer to whatever feels right._";

const TradeAdminOnboarding = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FlowConfig>({
    greeting_template: DEFAULT_GREETING,
    buttons: [],
    is_enabled: true,
  });
  const [steps, setSteps] = useState<Step[]>([]);
  const [stats, setStats] = useState<{ total: number; completed: number; pending: number } | null>(null);

  // user reset
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserRow[]>([]);
  const [userSearching, setUserSearching] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: cfg }, { data: stepRows }, { data: statRows }] = await Promise.all([
        supabase.from("onboarding_flow_config").select("greeting_template, buttons, is_enabled").eq("id", "default").maybeSingle(),
        supabase.from("onboarding_tour_steps").select("*").order("sort_order", { ascending: true }),
        supabase.rpc("admin_onboarding_stats"),
      ]);
      if (cancelled) return;
      if (cfg) {
        setConfig({
          greeting_template: cfg.greeting_template || DEFAULT_GREETING,
          buttons: Array.isArray(cfg.buttons) ? (cfg.buttons as ButtonCfg[]) : [],
          is_enabled: cfg.is_enabled ?? true,
        });
      }
      if (stepRows) setSteps(stepRows as Step[]);
      if (statRows && statRows[0]) {
        const r = statRows[0] as any;
        setStats({ total: Number(r.total_users), completed: Number(r.completed), pending: Number(r.pending) });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const renderedGreeting = useMemo(() => {
    return config.greeting_template
      .replace(/\{first_name_comma\}/g, ", Alex")
      .replace(/\{first_name\}/g, "Alex")
      .replace(/\{concierge_name\}/g, "Inès");
  }, [config.greeting_template]);

  // ---- mutations -----------------------------------------------------------
  const saveConfig = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("onboarding_flow_config")
      .update({
        greeting_template: config.greeting_template,
        buttons: config.buttons as any,
        is_enabled: config.is_enabled,
      })
      .eq("id", "default");
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Welcome panel saved" });
  };

  const upsertStep = async (s: Step) => {
    const payload: any = {
      step_key: s.step_key.trim(),
      title: s.title,
      body: s.body,
      path: s.path,
      icon: s.icon,
      cta_label: s.cta_label,
      sort_order: s.sort_order,
      is_active: s.is_active,
    };
    if (s.id) {
      const { error } = await supabase.from("onboarding_tour_steps").update(payload).eq("id", s.id);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    } else {
      const { data, error } = await supabase.from("onboarding_tour_steps").insert(payload).select("*").single();
      if (error) { toast({ title: "Add failed", description: error.message, variant: "destructive" }); return; }
      setSteps((prev) => prev.map((x) => x === s ? (data as Step) : x));
    }
    toast({ title: "Step saved" });
  };

  const deleteStep = async (s: Step) => {
    if (!s.id) {
      setSteps((prev) => prev.filter((x) => x !== s));
      return;
    }
    if (!window.confirm(`Delete step “${s.title}”?`)) return;
    const { error } = await supabase.from("onboarding_tour_steps").delete().eq("id", s.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    setSteps((prev) => prev.filter((x) => x.id !== s.id));
    toast({ title: "Step deleted" });
  };

  const addStep = () => {
    setSteps((prev) => [...prev, {
      step_key: `step-${prev.length + 1}`,
      title: `${prev.length + 1}. New step`,
      body: "Describe what the user should do here.",
      path: "/trade",
      icon: "MapPin",
      cta_label: prev.length === 0 ? "Get started" : "Next",
      sort_order: (prev.at(-1)?.sort_order ?? 0) + 10,
      is_active: true,
    }]);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[idx];
    const b = steps[target];
    const newSteps = [...steps];
    newSteps[idx] = { ...b, sort_order: a.sort_order };
    newSteps[target] = { ...a, sort_order: b.sort_order };
    setSteps(newSteps);
    if (a.id) await supabase.from("onboarding_tour_steps").update({ sort_order: b.sort_order }).eq("id", a.id);
    if (b.id) await supabase.from("onboarding_tour_steps").update({ sort_order: a.sort_order }).eq("id", b.id);
  };

  const updateStepLocal = (idx: number, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  // ---- user reset ----------------------------------------------------------
  const searchUsers = async () => {
    setUserSearching(true);
    const q = userQuery.trim();
    let query = supabase
      .from("profiles")
      .select("id, email, first_name, last_name, has_seen_trade_intro")
      .order("email", { ascending: true })
      .limit(20);
    if (q) {
      query = query.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    }
    const { data, error } = await query;
    setUserSearching(false);
    if (error) { toast({ title: "Search failed", description: error.message, variant: "destructive" }); return; }
    setUserResults((data as UserRow[]) || []);
  };

  const resetForUser = async (u: UserRow) => {
    const { error } = await supabase.rpc("admin_reset_onboarding_for_user", { _user_id: u.id });
    if (error) { toast({ title: "Reset failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reset", description: `${u.email || u.id} will see the welcome flow on next /trade visit.` });
    setUserResults((prev) => prev.map((r) => r.id === u.id ? { ...r, has_seen_trade_intro: false } : r));
  };

  const previewMyOwnFlow = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ has_seen_trade_intro: false }).eq("id", user.id);
    try {
      localStorage.removeItem("trade_quick_tour_done");
      localStorage.removeItem("trade_quick_tour_step");
    } catch {}
    toast({ title: "Reset for you", description: "Visit /trade to see the welcome flow." });
  };

  // ---- render --------------------------------------------------------------
  return (
    <>
      <Helmet><title>Onboarding flow — Trade Admin — Maison Affluency</title></Helmet>
      <div className="max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> First-login flow
          </h1>
          <button
            onClick={previewMyOwnFlow}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md font-body text-xs hover:bg-muted transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Preview on my account
          </button>
        </div>
        <p className="font-body text-sm text-muted-foreground mb-6">
          Edit the welcome panel and Quick Tour shown to a trade user the first time they land on <code className="px-1 bg-muted rounded">/trade</code>. Changes apply immediately.
        </p>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <Stat label="Total trade users" value={stats.total} />
            <Stat label="Completed onboarding" value={stats.completed} accent />
            <Stat label="Pending" value={stats.pending} />
          </div>
        )}

        {loading ? (
          <div className="py-20 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {/* Welcome panel editor */}
            <Section title="1. Welcome panel">
              <div className="flex items-center gap-3 mb-4 p-3 rounded-md border border-border bg-muted/30">
                <input
                  id="enabled"
                  type="checkbox"
                  checked={config.is_enabled}
                  onChange={(e) => setConfig({ ...config, is_enabled: e.target.checked })}
                />
                <label htmlFor="enabled" className="font-body text-sm text-foreground">
                  Show the welcome panel to first-time trade users
                </label>
              </div>

              <Label>Greeting template</Label>
              <p className="font-body text-[11px] text-muted-foreground mb-2">
                Variables: <code>{`{first_name}`}</code>, <code>{`{first_name_comma}`}</code> (renders as <code>{`, Alex`}</code> when known), <code>{`{concierge_name}`}</code>. Markdown is supported.
              </p>
              <textarea
                value={config.greeting_template}
                onChange={(e) => setConfig({ ...config, greeting_template: e.target.value })}
                rows={5}
                className={inputClass}
              />

              <div className="mt-3 p-3 rounded-md bg-card border border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Preview</div>
                <div className="whitespace-pre-wrap font-body text-sm text-foreground">{renderedGreeting}</div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Label className="!mb-0">Action buttons</Label>
                <button
                  onClick={() => setConfig({ ...config, buttons: [...config.buttons, { label: "New action", prompt: "__concierge:start_brief__" }] })}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] uppercase tracking-widest border border-border rounded-md hover:bg-muted"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-2 mt-2">
                {config.buttons.map((b, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      placeholder="Label"
                      value={b.label}
                      onChange={(e) => {
                        const next = [...config.buttons];
                        next[i] = { ...b, label: e.target.value };
                        setConfig({ ...config, buttons: next });
                      }}
                      className={`${inputClass} col-span-4`}
                    />
                    <input
                      placeholder="Prompt or __concierge:action__"
                      value={b.prompt}
                      onChange={(e) => {
                        const next = [...config.buttons];
                        next[i] = { ...b, prompt: e.target.value };
                        setConfig({ ...config, buttons: next });
                      }}
                      className={`${inputClass} col-span-6 font-mono text-xs`}
                    />
                    <label className="col-span-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <input type="checkbox" checked={!!b.primary} onChange={(e) => {
                        const next = [...config.buttons];
                        next[i] = { ...b, primary: e.target.checked };
                        setConfig({ ...config, buttons: next });
                      }} /> Primary
                    </label>
                    <button
                      onClick={() => setConfig({ ...config, buttons: config.buttons.filter((_, idx) => idx !== i) })}
                      className="col-span-1 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive"
                      aria-label="Remove button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {config.buttons.length === 0 && (
                  <p className="font-body text-xs text-muted-foreground italic">No buttons. The panel will show only the greeting.</p>
                )}
                <p className="font-body text-[11px] text-muted-foreground mt-2">
                  Special prompts handled by the AI Concierge: <code>__concierge:start_tour__</code>, <code>__concierge:start_brief__</code>, <code>__concierge:rename__</code>. Anything else is sent as a normal user message.
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-foreground text-background font-body text-xs uppercase tracking-widest rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save welcome panel"}
                </button>
              </div>
            </Section>

            {/* Tour steps */}
            <Section title={`2. Quick Tour steps (${steps.length})`}>
              <div className="space-y-3">
                {steps.map((s, idx) => (
                  <div key={s.id || `new-${idx}`} className="rounded-lg border border-border p-4 bg-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-display text-sm text-foreground">Step {idx + 1}</div>
                      <div className="flex items-center gap-1.5">
                        <IconBtn onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn onClick={() => move(idx, 1)} disabled={idx === steps.length - 1} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn onClick={() => deleteStep(s)} title="Delete" danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-3">
                      <Field className="col-span-4" label="Step key">
                        <input className={inputClass} value={s.step_key} onChange={(e) => updateStepLocal(idx, { step_key: e.target.value })} />
                      </Field>
                      <Field className="col-span-4" label="Icon">
                        <select className={inputClass} value={s.icon} onChange={(e) => updateStepLocal(idx, { icon: e.target.value })}>
                          {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </Field>
                      <Field className="col-span-3" label="Active">
                        <label className="flex items-center gap-2 h-10">
                          <input type="checkbox" checked={s.is_active} onChange={(e) => updateStepLocal(idx, { is_active: e.target.checked })} />
                          <span className="font-body text-xs text-muted-foreground">Show in tour</span>
                        </label>
                      </Field>
                      <Field className="col-span-1" label="Order">
                        <input type="number" className={inputClass} value={s.sort_order} onChange={(e) => updateStepLocal(idx, { sort_order: parseInt(e.target.value || "0", 10) })} />
                      </Field>

                      <Field className="col-span-8" label="Title">
                        <input className={inputClass} value={s.title} onChange={(e) => updateStepLocal(idx, { title: e.target.value })} />
                      </Field>
                      <Field className="col-span-4" label="CTA label">
                        <input className={inputClass} value={s.cta_label} onChange={(e) => updateStepLocal(idx, { cta_label: e.target.value })} />
                      </Field>

                      <Field className="col-span-12" label="Path (where to take the user)">
                        <input className={`${inputClass} font-mono text-xs`} value={s.path} onChange={(e) => updateStepLocal(idx, { path: e.target.value })} />
                      </Field>

                      <Field className="col-span-12" label="Body">
                        <textarea rows={3} className={inputClass} value={s.body} onChange={(e) => updateStepLocal(idx, { body: e.target.value })} />
                      </Field>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => upsertStep(s)}
                        className="inline-flex items-center gap-2 px-4 py-1.5 bg-foreground text-background font-body text-[11px] uppercase tracking-widest rounded-md hover:opacity-90"
                      >
                        <Check className="h-3 w-3" /> {s.id ? "Save step" : "Create step"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button onClick={addStep} className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-md font-body text-xs hover:bg-muted">
                  <Plus className="h-3.5 w-3.5" /> Add a step
                </button>
              </div>
              <p className="font-body text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                Reorder writes immediately, but field edits save only when you press <strong className="font-medium">Save step</strong>.
              </p>
            </Section>

            {/* Per-user reset */}
            <Section title="3. Replay the flow for a specific user">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    placeholder="Search by email or name…"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") searchUsers(); }}
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <button onClick={searchUsers} disabled={userSearching} className="px-4 py-2 bg-foreground text-background font-body text-xs uppercase tracking-widest rounded-md hover:opacity-90 disabled:opacity-50">
                  {userSearching ? "Searching…" : "Search"}
                </button>
              </div>

              {userResults.length > 0 && (
                <div className="mt-4 border border-border rounded-md divide-y divide-border">
                  {userResults.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="font-body text-sm text-foreground truncate">{u.email || u.id}</div>
                        <div className="font-body text-[11px] text-muted-foreground">
                          {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                          {" · "}
                          {u.has_seen_trade_intro ? "Completed" : "Pending"}
                        </div>
                      </div>
                      <button
                        onClick={() => resetForUser(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md font-body text-[11px] uppercase tracking-widest hover:bg-muted"
                      >
                        <RotateCcw className="h-3 w-3" /> Reset
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
const inputClass =
  "w-full px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-colors";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10 pb-10 border-b border-border last:border-b-0">
    <h2 className="font-display text-lg text-foreground mb-4">{title}</h2>
    {children}
  </section>
);

const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <label className={`font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block ${className}`}>{children}</label>
);

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <Label>{label}</Label>
    {children}
  </div>
);

const IconBtn = ({ children, onClick, disabled, title, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; danger?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ${danger ? "hover:text-destructive hover:border-destructive" : ""}`}
  >
    {children}
  </button>
);

const Stat = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <div className="rounded-lg border border-border p-4 bg-card">
    <div className={`font-display text-2xl ${accent ? "text-accent" : "text-foreground"} tabular-nums`}>{value}</div>
    <div className="font-body text-[11px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
  </div>
);

export default TradeAdminOnboarding;
