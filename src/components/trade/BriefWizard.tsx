import { useEffect, useState, useCallback, useMemo } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Loader2, Check, AlertCircle, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

type Answers = {
  projectName: string;
  clientName: string;
  location: string;
  projectType: string; // residential, hospitality, etc.
  rooms: string[];
  styles: string[];
  budget: string;
  timeline: string;
  notes: string;
};

const PROJECT_TYPES = ["Residential", "Hospitality", "Yacht", "Office", "Retail"];
const ROOMS = ["Living", "Dining", "Bedroom", "Kitchen", "Bathroom", "Outdoor", "Office", "Lobby"];
const STYLES = ["Contemporary", "Mid-century", "Art Deco", "Minimalist", "Maximalist", "Organic Modern", "Classic"];
const BUDGETS = ["< $25k", "$25k–$100k", "$100k–$500k", "$500k+"];
const TIMELINES = ["< 1 month", "1–3 months", "3–6 months", "6+ months"];

function Chips({ options, value, onChange, multi }: { options: string[]; value: string | string[]; onChange: (v: any) => void; multi?: boolean }) {
  const isActive = (o: string) => multi ? (value as string[]).includes(o) : value === o;
  const toggle = (o: string) => {
    if (multi) {
      const arr = value as string[];
      onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    } else {
      onChange(value === o ? "" : o);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={cn(
            "rounded-full border px-3 py-1 font-body text-xs transition-colors",
            isActive(o)
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-foreground hover:border-foreground/40"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const STEPS = [
  { id: "basics", title: "Project basics", description: "A name to remember it by, and where it sits." },
  { id: "scope", title: "Scope", description: "What kind of project, and which rooms?" },
  { id: "direction", title: "Creative direction", description: "Styles you're drawn to." },
  { id: "constraints", title: "Budget & timeline", description: "Rough ranges — we'll refine later." },
  { id: "notes", title: "Anything else?", description: "Mood, must-haves, things to avoid." },
] as const;

const initialAnswers: Answers = {
  projectName: "",
  clientName: "",
  location: "",
  projectType: "Residential",
  rooms: ["Living"],
  styles: ["Contemporary"],
  budget: "$25k–$100k",
  timeline: "1–3 months",
  notes: "",
};

const DRAFT_KEY = "trade_brief_wizard_draft";
const SYNC_PREF_KEY = "trade_brief_wizard_cloud_sync";
const MAX_AUTO_RETRIES = 3;

const briefSchema = z.object({
  projectName: z.string().trim().min(2, "Give your project a short name (2+ characters).").max(100, "Keep it under 100 characters."),
  clientName: z.string().trim().max(100, "Keep it under 100 characters.").optional().or(z.literal("")),
  location: z.string().trim().max(100, "Keep it under 100 characters.").optional().or(z.literal("")),
  projectType: z.string().min(1, "Pick a project type."),
  rooms: z.array(z.string()).min(1, "Pick at least one room."),
  styles: z.array(z.string()).min(1, "Pick at least one style direction."),
  budget: z.string().min(1, "Pick a rough budget — we'll refine later."),
  timeline: z.string().min(1, "Pick a timeline — we'll refine later."),
  notes: z.string().max(1500, "Keep notes under 1500 characters.").optional().or(z.literal("")),
});

type FieldErrors = Partial<Record<keyof Answers, string>>;

const STEP_FIELDS: Record<(typeof STEPS)[number]["id"], (keyof Answers)[]> = {
  basics: ["projectName", "clientName", "location"],
  scope: ["projectType", "rooms"],
  direction: ["styles"],
  constraints: ["budget", "timeline"],
  notes: ["notes"],
};

function validateAll(a: Answers): FieldErrors {
  const result = briefSchema.safeParse(a);
  if (result.success) return {};
  const errs: FieldErrors = {};
  for (const issue of result.error.issues) {
    const k = issue.path[0] as keyof Answers;
    if (k && !errs[k]) errs[k] = issue.message;
  }
  return errs;
}

const formatBriefMarkdown = (a: Answers) => {
  const lines: string[] = [];
  lines.push(`# Project Brief — ${a.projectName || "Untitled"}`);
  if (a.clientName) lines.push(`**Client:** ${a.clientName}`);
  if (a.location) lines.push(`**Location:** ${a.location}`);
  if (a.projectType) lines.push(`**Type:** ${a.projectType}`);
  lines.push("");
  if (a.rooms.length) lines.push(`**Rooms:** ${a.rooms.join(", ")}`);
  if (a.styles.length) lines.push(`**Style direction:** ${a.styles.join(", ")}`);
  if (a.budget) lines.push(`**Budget:** ${a.budget}`);
  if (a.timeline) lines.push(`**Timeline:** ${a.timeline}`);
  if (a.notes) {
    lines.push("", "## Notes", a.notes);
  }
  return lines.join("\n");
};

// Parse a previously-saved brief markdown back into structured hints we can reuse as defaults.
function parseBriefMarkdown(md: string | null | undefined): Partial<Answers> {
  if (!md) return {};
  const out: Partial<Answers> = {};
  const pick = (label: string) => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i");
    const m = md.match(re);
    return m?.[1]?.trim();
  };
  const type = pick("Type"); if (type && PROJECT_TYPES.includes(type)) out.projectType = type;
  const rooms = pick("Rooms"); if (rooms) {
    const arr = rooms.split(",").map((r) => r.trim()).filter((r) => ROOMS.includes(r));
    if (arr.length) out.rooms = arr;
  }
  const styles = pick("Style direction"); if (styles) {
    const arr = styles.split(",").map((s) => s.trim()).filter((s) => STYLES.includes(s));
    if (arr.length) out.styles = arr;
  }
  const budget = pick("Budget"); if (budget && BUDGETS.includes(budget)) out.budget = budget;
  const timeline = pick("Timeline"); if (timeline && TIMELINES.includes(timeline)) out.timeline = timeline;
  return out;
}

async function buildPrefill(userId: string): Promise<Partial<Answers>> {
  const prefill: Partial<Answers> = {};
  try {
    const [profileRes, projectRes] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name, company, country").eq("id", userId).maybeSingle(),
      supabase.from("projects").select("client_name, location, notes").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const profile: any = profileRes.data || {};
    const project: any = projectRes.data || {};

    // Location: prefer most recent project location; fall back to profile country.
    if (project.location) prefill.location = project.location;
    else if (profile.country) prefill.location = profile.country;

    // Client: reuse last project client (often the firm/family they work with).
    if (project.client_name) prefill.clientName = project.client_name;
    else if (profile.company) prefill.clientName = profile.company;

    // Inherit creative direction & constraints from the last brief if we can parse it.
    Object.assign(prefill, parseBriefMarkdown(project.notes));
  } catch (e) {
    console.warn("BriefWizard prefill failed", e);
  }
  return prefill;
}

export function BriefWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof Answers, boolean>>>({});
  const [showStepErrors, setShowStepErrors] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [lastCompletedStep, setLastCompletedStep] = useState(-1);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, setSavedTick] = useState(0);
  const [cloudSync, setCloudSync] = useState<boolean>(() => {
    try { return localStorage.getItem(SYNC_PREF_KEY) !== "0"; } catch { return true; }
  });
  const [cloudStatus, setCloudStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [syncRetries, setSyncRetries] = useState(0);

  // Restore draft if any
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.answers) setAnswers({ ...initialAnswers, ...parsed.answers });
        if (typeof parsed?.stepIdx === "number") setStepIdx(parsed.stepIdx);
        if (typeof parsed?.lastCompletedStep === "number") setLastCompletedStep(parsed.lastCompletedStep);
        if (typeof parsed?.savedAt === "number") setSavedAt(parsed.savedAt);
      }
    } catch {}
  }, []);

  // Hydrate from cloud once user is known + sync enabled; pick whichever side is newer.
  useEffect(() => {
    if (!user || !cloudSync || cloudHydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("brief_drafts")
          .select("payload, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) { setCloudHydrated(true); return; }
        if (data?.payload) {
          const cloudTs = new Date(data.updated_at).getTime();
          const localTs = savedAt ?? 0;
          if (cloudTs > localTs + 1500) {
            const p = data.payload as any;
            if (p.answers) setAnswers({ ...initialAnswers, ...p.answers });
            if (typeof p.stepIdx === "number") setStepIdx(p.stepIdx);
            if (typeof p.lastCompletedStep === "number") setLastCompletedStep(p.lastCompletedStep);
            setSavedAt(cloudTs);
            setPrefilled(true);
            toast.success("Resumed your brief from another device.");
          }
        }
      } catch {}
      finally { if (!cancelled) setCloudHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, [user, cloudSync, cloudHydrated, savedAt]);

  // Persist draft (debounced) locally + optionally to cloud
  useEffect(() => {
    const t = setTimeout(async () => {
      const ts = Date.now();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, stepIdx, lastCompletedStep, savedAt: ts }));
        setSavedAt(ts);
      } catch {}
      if (user && cloudSync && cloudHydrated) {
        setCloudStatus("syncing");
        try {
          const { error } = await (supabase as any)
            .from("brief_drafts")
            .upsert({
              user_id: user.id,
              payload: { answers, stepIdx, lastCompletedStep },
              updated_at: new Date(ts).toISOString(),
            }, { onConflict: "user_id" });
          setCloudStatus(error ? "error" : "synced");
        } catch {
          setCloudStatus("error");
        }
      }
    }, 700);
    return () => clearTimeout(t);
  }, [answers, stepIdx, lastCompletedStep, user, cloudSync, cloudHydrated]);

  // Tick to refresh the "saved Xs ago" label while dialog is open
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setSavedTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [open]);

  const toggleCloudSync = useCallback(async (next: boolean) => {
    setCloudSync(next);
    try { localStorage.setItem(SYNC_PREF_KEY, next ? "1" : "0"); } catch {}
    if (!user) return;
    if (next) {
      setCloudHydrated(false); // re-hydrate / push current state
      toast.success("Cloud sync on — your brief will follow you across devices.");
    } else {
      try { await (supabase as any).from("brief_drafts").delete().eq("user_id", user.id); } catch {}
      setCloudStatus("idle");
      toast.success("Cloud sync off — draft kept only on this device.");
    }
  }, [user]);

  const syncNow = useCallback(async () => {
    if (!user || !cloudSync) return;
    setCloudStatus("syncing");
    const ts = Date.now();
    try {
      // 1) Push current local state immediately
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, stepIdx, lastCompletedStep, savedAt: ts }));
      setSavedAt(ts);
      const { error: upsertErr } = await (supabase as any)
        .from("brief_drafts")
        .upsert({
          user_id: user.id,
          payload: { answers, stepIdx, lastCompletedStep },
          updated_at: new Date(ts).toISOString(),
        }, { onConflict: "user_id" });
      if (upsertErr) throw upsertErr;

      // 2) Pull latest from cloud to resolve any conflicts (server wins if newer)
      const { data, error: fetchErr } = await (supabase as any)
        .from("brief_drafts")
        .select("payload, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (data?.payload) {
        const cloudTs = new Date(data.updated_at).getTime();
        const localTs = ts;
        if (cloudTs > localTs + 500) {
          const p = data.payload as any;
          if (p.answers) setAnswers({ ...initialAnswers, ...p.answers });
          if (typeof p.stepIdx === "number") setStepIdx(p.stepIdx);
          if (typeof p.lastCompletedStep === "number") setLastCompletedStep(p.lastCompletedStep);
          setSavedAt(cloudTs);
          toast.success("Merged newer cloud draft.");
        } else {
          toast.success("Synced to cloud.");
        }
      } else {
        toast.success("Synced to cloud.");
      }
      setCloudStatus("synced");
    } catch (e: any) {
      console.error(e);
      setCloudStatus("error");
      toast.error(e?.message || "Sync failed — try again.");
    }
  }, [user, cloudSync, answers, stepIdx, lastCompletedStep]);

  // One-time profile/last-project prefill applied to defaults (only if no draft exists yet).
  useEffect(() => {
    if (!user || prefilled) return;
    let cancelled = false;
    const hasDraft = (() => { try { return !!localStorage.getItem(DRAFT_KEY); } catch { return false; } })();
    if (hasDraft) { setPrefilled(true); return; }
    buildPrefill(user.id).then((p) => {
      if (cancelled || Object.keys(p).length === 0) { setPrefilled(true); return; }
      setAnswers((prev) => ({ ...prev, ...p }));
      setPrefilled(true);
    });
    return () => { cancelled = true; };
  }, [user, prefilled]);

  useEffect(() => {
    const onOpen = async () => {
      // keep draft if present, otherwise start fresh with defaults + prefill
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const resumeIdx = Math.min(
            typeof parsed?.stepIdx === "number" ? parsed.stepIdx : 0,
            STEPS.length - 1
          );
          const lastDone = typeof parsed?.lastCompletedStep === "number" ? parsed.lastCompletedStep : -1;
          if (lastDone >= 0 && STEPS[resumeIdx]) {
            toast.success(`Resumed where you left off — “${STEPS[resumeIdx].title}”.`);
          }
        } else {
          setStepIdx(0);
          const base = { ...initialAnswers };
          if (user) {
            const p = await buildPrefill(user.id);
            Object.assign(base, p);
          }
          setAnswers(base);
          if (Object.keys(base).some((k) => (base as any)[k] !== (initialAnswers as any)[k])) {
            toast.success("Pre-filled a few fields from your last project — tweak as needed.");
          }
        }
      } catch {
        setStepIdx(0);
        setAnswers(initialAnswers);
      }
      setTouched({});
      setShowStepErrors(false);
      setOpen(true);
    };
    window.addEventListener("trade-brief:open", onOpen);
    return () => window.removeEventListener("trade-brief:open", onOpen);
  }, [user]);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  const allErrors = useMemo(() => validateAll(answers), [answers]);
  const stepFieldKeys = STEP_FIELDS[step.id];
  const stepErrors: FieldErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const k of stepFieldKeys) if (allErrors[k]) out[k] = allErrors[k];
    return out;
  }, [allErrors, stepFieldKeys]);
  const stepHasErrors = Object.keys(stepErrors).length > 0;
  const fieldError = (k: keyof Answers) =>
    (touched[k] || showStepErrors) ? stepErrors[k] : undefined;

  const tryAdvance = () => {
    if (stepHasErrors) {
      setShowStepErrors(true);
      const first = Object.values(stepErrors)[0];
      if (first) toast.error(first);
      return;
    }
    setShowStepErrors(false);
    setLastCompletedStep((prev) => Math.max(prev, stepIdx));
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const jumpToFirstInvalidStep = () => {
    for (let i = 0; i < STEPS.length; i++) {
      const id = STEPS[i].id;
      if (STEP_FIELDS[id].some((k) => allErrors[k])) {
        setStepIdx(i);
        setShowStepErrors(true);
        const k = STEP_FIELDS[id].find((k) => allErrors[k])!;
        toast.error(allErrors[k]!);
        return true;
      }
    }
    return false;
  };

  const finish = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to save your brief.");
      return;
    }
    if (Object.keys(allErrors).length > 0) {
      jumpToFirstInvalidStep();
      return;
    }
    setSaving(true);
    try {
      const briefMd = formatBriefMarkdown(answers);
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: answers.projectName.trim() || "Untitled Project",
          client_name: answers.clientName?.trim() || "",
          location: answers.location?.trim() || "",
          notes: briefMd,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      if (cloudSync) {
        try { await (supabase as any).from("brief_drafts").delete().eq("user_id", user.id); } catch {}
      }
      toast.success("Brief saved as a new project.");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("concierge:stage", {
        detail: {
          openPanel: true,
          message: `✓ Brief captured — I've created **${answers.projectName}** for you. Want me to propose a starter tearsheet based on these answers?`,
          actions: [
            { label: "Yes, propose pieces", prompt: `Based on this brief, propose 6–10 starter pieces:\n\n${briefMd}` },
            { label: "Open the project", prompt: `__nav:/trade/projects/${data.id}__` },
          ],
        },
      }));
      setTimeout(() => navigate(`/trade/projects/${data.id}`), 400);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save brief.");
    } finally {
      setSaving(false);
    }
  }, [answers, user, navigate, allErrors, cloudSync]);

  const ErrorMsg = ({ msg }: { msg?: string }) =>
    msg ? (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" /> {msg}
      </p>
    ) : null;

  const resetDraft = () => {
    setAnswers(initialAnswers);
    setStepIdx(0);
    setTouched({});
    setShowStepErrors(false);
    setLastCompletedStep(-1);
    setSavedAt(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    if (user && cloudSync) {
      (supabase as any).from("brief_drafts").delete().eq("user_id", user.id).then(() => {});
    }
    toast.success("Draft cleared — sensible defaults restored.");
  };

  const savedLabel = useMemo(() => {
    if (!savedAt) return null;
    const diff = Math.max(0, Date.now() - savedAt);
    if (diff < 5_000) return "Saved just now";
    if (diff < 60_000) return `Saved ${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `Saved ${Math.round(diff / 60_000)}m ago`;
    return `Saved ${Math.round(diff / 3_600_000)}h ago`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAt, open]);

  const saveAndExit = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, stepIdx, savedAt: Date.now() }));
    } catch {}
    setOpen(false);
    toast.success("Draft saved — pick up where you left off anytime.");
    window.dispatchEvent(new CustomEvent("concierge:stage", {
      detail: {
        openPanel: true,
        message: `Saved your brief draft${answers.projectName ? ` for **${answers.projectName}**` : ""}. Resume whenever you're ready.`,
        actions: [{ label: "Resume brief", prompt: "__concierge:start_brief__" }],
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o && open && !saving) {
        // Auto-save draft when user dismisses (X / overlay / Esc)
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, stepIdx, savedAt: Date.now() })); } catch {}
      }
      setOpen(o);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center justify-between gap-2">
            <span>
              {step.title}
              <span className="font-body text-xs text-muted-foreground ml-2">Step {stepIdx + 1} of {STEPS.length}</span>
            </span>
            <span className="flex items-center gap-2 font-body text-[10px] font-normal text-muted-foreground">
              {savedLabel && (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-accent" /> {savedLabel}
                </span>
              )}
            </span>
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-2">
            <span>{step.description}</span>
            {user && (
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-accent cursor-pointer"
                    checked={cloudSync}
                    onChange={(e) => toggleCloudSync(e.target.checked)}
                  />
                  Sync across devices
                </label>
                {cloudSync && (
                  <button
                    type="button"
                    onClick={syncNow}
                    disabled={cloudStatus === "syncing"}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Push local draft / pull latest cloud draft"
                  >
                    {cloudStatus === "syncing" ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-2.5 w-2.5" />
                    )}
                    Sync now
                  </button>
                )}
                {cloudSync && cloudStatus === "synced" && <Check className="h-2.5 w-2.5 text-accent" />}
                {cloudSync && cloudStatus === "error" && <AlertCircle className="h-2.5 w-2.5 text-destructive" />}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step-by-step progress indicator */}
        <div className="flex items-center gap-0 mb-4">
          {STEPS.map((s, i) => {
            const hasErr = STEP_FIELDS[s.id].some((k) => allErrors[k]);
            const isCurrent = i === stepIdx;
            const isPast = i < stepIdx;
            const isFuture = i > stepIdx;
            return (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => { setShowStepErrors(false); setStepIdx(i); }}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  className={cn(
                    "flex flex-col items-center gap-1 group min-w-0 flex-1",
                    isFuture && "cursor-not-allowed opacity-60"
                  )}
                  disabled={isFuture}
                >
                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all border-2 shrink-0",
                    isCurrent
                      ? "border-accent bg-accent text-accent-foreground ring-2 ring-accent/20"
                      : isPast
                        ? hasErr
                          ? "border-destructive/70 bg-destructive/10 text-destructive"
                          : "border-accent bg-accent/10 text-accent"
                        : "border-muted bg-background text-muted-foreground group-hover:border-muted-foreground/40"
                  )}>
                    {isPast && !hasErr ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                  </div>
                  <span className={cn(
                    "text-[10px] font-body leading-tight truncate max-w-full px-0.5",
                    isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {s.title}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-1 min-w-[16px] transition-colors",
                    i < stepIdx ? "bg-accent" : "bg-border"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4 py-2">
          {step.id === "basics" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bw-name">Project name *</Label>
                <Input id="bw-name" value={answers.projectName} maxLength={100}
                  onChange={(e) => set("projectName", e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, projectName: true }))}
                  placeholder="e.g. Soho Loft Refresh"
                  aria-invalid={!!fieldError("projectName")} />
                <ErrorMsg msg={fieldError("projectName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bw-client">Client (optional)</Label>
                <Input id="bw-client" value={answers.clientName} maxLength={100}
                  onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. The Tan Family" />
                <ErrorMsg msg={fieldError("clientName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bw-loc">Location (optional)</Label>
                <Input id="bw-loc" value={answers.location} maxLength={100}
                  onChange={(e) => set("location", e.target.value)} placeholder="e.g. Singapore" />
                <ErrorMsg msg={fieldError("location")} />
              </div>
            </>
          )}

          {step.id === "scope" && (
            <>
              <div className="space-y-1.5">
                <Label>Project type *</Label>
                <Chips options={PROJECT_TYPES} value={answers.projectType} onChange={(v) => set("projectType", v)} />
                <ErrorMsg msg={fieldError("projectType")} />
              </div>
              <div className="space-y-1.5">
                <Label>Rooms involved *</Label>
                <Chips options={ROOMS} value={answers.rooms} onChange={(v) => set("rooms", v)} multi />
                <ErrorMsg msg={fieldError("rooms")} />
              </div>
            </>
          )}

          {step.id === "direction" && (
            <div className="space-y-1.5">
              <Label>Pick one or more styles *</Label>
              <Chips options={STYLES} value={answers.styles} onChange={(v) => set("styles", v)} multi />
              <ErrorMsg msg={fieldError("styles")} />
            </div>
          )}

          {step.id === "constraints" && (
            <>
              <div className="space-y-1.5">
                <Label>Budget *</Label>
                <Chips options={BUDGETS} value={answers.budget} onChange={(v) => set("budget", v)} />
                <ErrorMsg msg={fieldError("budget")} />
              </div>
              <div className="space-y-1.5">
                <Label>Timeline *</Label>
                <Chips options={TIMELINES} value={answers.timeline} onChange={(v) => set("timeline", v)} />
                <ErrorMsg msg={fieldError("timeline")} />
              </div>
            </>
          )}

          {step.id === "notes" && (
            <div className="space-y-1.5">
              <Label htmlFor="bw-notes">Notes (optional)</Label>
              <Textarea id="bw-notes" value={answers.notes} maxLength={1500} rows={5}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Mood, materials, must-haves, things to avoid…" />
              <p className="text-[11px] text-muted-foreground text-right">{answers.notes.length}/1500</p>
              <ErrorMsg msg={fieldError("notes")} />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={stepIdx === 0 || saving} onClick={() => { setShowStepErrors(false); setStepIdx((i) => Math.max(0, i - 1)); }}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={resetDraft} disabled={saving}
              className="text-xs text-muted-foreground hover:text-foreground">
              Reset
            </Button>
          </div>
          {isLast ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={saveAndExit} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save & exit
              </Button>
              <Button onClick={finish} disabled={saving}>
                {saving ? <DotCircleLoader size="sm" className="h-3.5 w-3.5 mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Save brief
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={saveAndExit} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save & exit
              </Button>
              <Button onClick={tryAdvance} disabled={saving}>
                Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
