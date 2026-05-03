import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Loader2, Check, AlertCircle } from "lucide-react";
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
  projectType: "",
  rooms: [],
  styles: [],
  budget: "",
  timeline: "",
  notes: "",
};

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

export function BriefWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setStepIdx(0);
      setAnswers(initialAnswers);
      setOpen(true);
    };
    window.addEventListener("trade-brief:open", onOpen);
    return () => window.removeEventListener("trade-brief:open", onOpen);
  }, []);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const canAdvance = (() => {
    switch (step.id) {
      case "basics": return answers.projectName.trim().length > 0;
      case "scope": return answers.projectType !== "" && answers.rooms.length > 0;
      case "direction": return answers.styles.length > 0;
      case "constraints": return answers.budget !== "" && answers.timeline !== "";
      case "notes": return true;
    }
  })();

  const finish = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to save your brief.");
      return;
    }
    setSaving(true);
    try {
      const briefMd = formatBriefMarkdown(answers);
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: answers.projectName || "Untitled Project",
          client_name: answers.clientName || "",
          location: answers.location || "",
          notes: briefMd,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Brief saved as a new project.");
      setOpen(false);
      // Notify the concierge so it can confirm in chat
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
      // Best-effort navigation
      setTimeout(() => navigate(`/trade/projects/${data.id}`), 400);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save brief.");
    } finally {
      setSaving(false);
    }
  }, [answers, user, navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {step.title}
            <span className="font-body text-xs text-muted-foreground ml-2">Step {stepIdx + 1} of {STEPS.length}</span>
          </DialogTitle>
          <DialogDescription>{step.description}</DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < stepIdx ? "w-3 bg-accent" : i === stepIdx ? "w-6 bg-accent" : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="space-y-4 py-2">
          {step.id === "basics" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bw-name">Project name *</Label>
                <Input id="bw-name" value={answers.projectName} maxLength={100}
                  onChange={(e) => set("projectName", e.target.value)} placeholder="e.g. Soho Loft Refresh" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bw-client">Client (optional)</Label>
                <Input id="bw-client" value={answers.clientName} maxLength={100}
                  onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. The Tan Family" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bw-loc">Location (optional)</Label>
                <Input id="bw-loc" value={answers.location} maxLength={100}
                  onChange={(e) => set("location", e.target.value)} placeholder="e.g. Singapore" />
              </div>
            </>
          )}

          {step.id === "scope" && (
            <>
              <div className="space-y-1.5">
                <Label>Project type *</Label>
                <Chips options={PROJECT_TYPES} value={answers.projectType} onChange={(v) => set("projectType", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Rooms involved *</Label>
                <Chips options={ROOMS} value={answers.rooms} onChange={(v) => set("rooms", v)} multi />
              </div>
            </>
          )}

          {step.id === "direction" && (
            <div className="space-y-1.5">
              <Label>Pick one or more styles *</Label>
              <Chips options={STYLES} value={answers.styles} onChange={(v) => set("styles", v)} multi />
            </div>
          )}

          {step.id === "constraints" && (
            <>
              <div className="space-y-1.5">
                <Label>Budget *</Label>
                <Chips options={BUDGETS} value={answers.budget} onChange={(v) => set("budget", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Timeline *</Label>
                <Chips options={TIMELINES} value={answers.timeline} onChange={(v) => set("timeline", v)} />
              </div>
            </>
          )}

          {step.id === "notes" && (
            <div className="space-y-1.5">
              <Label htmlFor="bw-notes">Notes (optional)</Label>
              <Textarea id="bw-notes" value={answers.notes} maxLength={1500} rows={5}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Mood, materials, must-haves, things to avoid…" />
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" disabled={stepIdx === 0 || saving} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
          {isLast ? (
            <Button onClick={finish} disabled={!canAdvance || saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Save brief
            </Button>
          ) : (
            <Button onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))} disabled={!canAdvance}>
              Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
