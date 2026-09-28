/**
 * Inbound Lead Response Templates — LinkedIn replies for studios requesting
 * live platform demos. Placeholders are highlighted and editable inline;
 * "Log Demo Booked" hands the lead into the Trade ID Audit checklist
 * (acquisition_demo_bookings).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarCheck, ChevronDown, ClipboardCheck, Copy, MessageSquareReply } from "lucide-react";

type LeadLite = { id: string; studio_name: string; founder_name: string | null };

type Template = { key: string; title: string; stage: string; body: string };

const TEMPLATES: Template[] = [
  {
    key: "demo_direct",
    title: "Option 1 — Direct & Action-Oriented",
    stage: "Targeted focus",
    body: `Hi [First Name],

Thanks for reaching out! I’d be glad to walk you through a live platform demo and show you how we handle high-throughput Trade ID generation for studios like [Studio Name].

Let's get something on the books. You can pick a time that works best for you directly via my scheduling link here: [Booking Link].

To ensure we tailor the demo specifically to your studio's setup, could you share a quick detail ahead of time? Are your current operations primarily focused on [Focus Area]?

Looking forward to connecting!

Best,
[Your Name]`,
  },
  {
    key: "demo_conversational",
    title: "Option 2 — Short & Conversational",
    stage: "High-friction pre-screen",
    body: `Hi [First Name], great to connect! I'd love to set up a live demo for the team at [Studio Name].

You can grab a convenient spot on my calendar here: [Booking Link].

If you have 60 seconds to spare before we meet, dropping your corporate email and current platform setup in our quick intake form ([Intake Link]) will help us customize the sandbox environment for your demo. See you soon!`,
  },
];

const AUDIT_ITEMS = [
  { key: "company_registration", label: "Company registration / Trade ID verified" },
  { key: "website_portfolio", label: "Website & portfolio reviewed" },
  { key: "linkedin_identity", label: "Contact identity matched on LinkedIn" },
  { key: "business_email", label: "Business email domain confirmed" },
  { key: "tier_assigned", label: "Trade tier assigned" },
];

const PH = /\[([^\]]+)\]/g;

function fill(body: string, vals: Record<string, string>) {
  return body.replace(PH, (m, k) => (vals[k]?.trim() ? vals[k].trim() : m));
}

function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <mark key={i} className="rounded-sm bg-primary/15 px-1 font-medium text-primary">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

export default function InboundLeadTemplates({ leads, openSignal }: { leads: LeadLite[]; openSignal?: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const checklistRef = useRef<HTMLDivElement>(null);

  // External "Open checklist" links bump openSignal to expand the panel and
  // scroll straight to the Trade ID Audit checklist.
  useEffect(() => {
    if (!openSignal) return;
    setOpen(true);
    const t = setTimeout(() => checklistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    return () => clearTimeout(t);
  }, [openSignal]);
  const [active, setActive] = useState(TEMPLATES[0].key);
  const [leadId, setLeadId] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [demoAt, setDemoAt] = useState("");

  const tpl = TEMPLATES.find((t) => t.key === active)!;
  const lead = leads.find((l) => l.id === leadId);
  const keys = useMemo(() => Array.from(new Set([...tpl.body.matchAll(PH)].map((m) => m[1]))), [tpl]);

  const auto: Record<string, string> = {
    "First Name": lead?.founder_name?.split(" ")[0] ?? "",
    "Studio Name": lead?.studio_name ?? "",
    "Focus Area": "cross-border trading infrastructure",
    "Demo Date": demoAt ? new Date(demoAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" }) : "",
  };
  const merged = { ...auto, ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v)) };
  const output = fill(tpl.body, merged);
  const unresolved = [...output.matchAll(PH)].map((m) => m[1]);

  const { data: bookings = [] } = useQuery({
    queryKey: ["acquisition-demo-bookings"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_demo_bookings")
        .select("id, lead_id, demo_at, audit_status, trade_id_audit, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    toast.success(unresolved.length ? `Copied — ${unresolved.length} placeholder(s) still open.` : "Template copied.");
  };

  const logBooking = async () => {
    if (!leadId) return toast.error("Select a lead first.");
    const { error } = await supabase.from("acquisition_demo_bookings").insert({
      lead_id: leadId,
      template_key: active,
      demo_at: demoAt ? new Date(demoAt).toISOString() : null,
      booking_link: merged["Booking Link"] || null,
    });
    if (error) return toast.error("Could not log the demo booking.");
    toast.success("Demo logged — added to the Trade ID Audit checklist.");
    qc.invalidateQueries({ queryKey: ["acquisition-demo-bookings"] });
  };

  const toggleAudit = async (b: (typeof bookings)[number], key: string, checked: boolean) => {
    const audit = { ...((b.trade_id_audit as Record<string, boolean>) ?? {}), [key]: checked };
    const done = AUDIT_ITEMS.filter((i) => audit[i.key]).length;
    const audit_status = done === AUDIT_ITEMS.length ? "verified" : done > 0 ? "in_review" : "pending";
    const { error } = await supabase
      .from("acquisition_demo_bookings")
      .update({ trade_id_audit: audit, audit_status, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) return toast.error("Checklist could not be saved.");
    qc.invalidateQueries({ queryKey: ["acquisition-demo-bookings"] });
  };

  return (
    <section className="mt-8 border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <MessageSquareReply className="h-4 w-4 text-primary" />
          <span className="text-[11px] uppercase tracking-[0.25em] text-foreground">Inbound Lead Response Templates</span>
          <Badge variant="outline" className="text-[10px]">LinkedIn · Demo requests</Badge>
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="grid gap-6 border-t border-border p-6 lg:grid-cols-[240px_1fr_320px]">
          <nav aria-label="Templates" className="space-y-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  active === t.key ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="block font-medium">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.stage}</span>
              </button>
            ))}
          </nav>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-background p-5">
              <Highlighted text={output} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copy} size="sm"><Copy className="mr-2 h-4 w-4" />Copy to clipboard</Button>
              <Button onClick={logBooking} size="sm" variant="outline"><CalendarCheck className="mr-2 h-4 w-4" />Log demo booked</Button>
              {unresolved.length > 0 && (
                <span className="text-xs text-muted-foreground">Open: {unresolved.join(", ")}</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Lead
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
              >
                <option value="">— Select studio —</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.studio_name}</option>)}
              </select>
            </label>
            {keys.includes("Demo Date") && (
              <label className="block text-xs font-medium text-muted-foreground">
                Demo date
                <Input type="datetime-local" value={demoAt} onChange={(e) => setDemoAt(e.target.value)} className="mt-1 h-9" />
              </label>
            )}
            {keys.filter((k) => k !== "Demo Date").map((k) => (
              <label key={k} className="block text-xs font-medium text-muted-foreground">
                {k}
                <Input
                  value={vals[k] ?? ""}
                  placeholder={auto[k] || `[${k}]`}
                  onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
                  className="mt-1 h-9"
                />
              </label>
            ))}
          </div>

          <p className="lg:col-span-3 rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground">
            <span className="font-medium">Downstream operations hook:</span> once {auto["First Name"] || "the lead"} books a demo, press “Log demo booked” to register {auto["Studio Name"] || "the studio"} into Phase 1 (Intake) of the Trade ID Audit checklist below.
          </p>

          <div className="lg:col-span-3" ref={checklistRef}>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-foreground">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Internal Operations & Trade ID Audit Checklist
            </h3>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No demos logged yet. Use “Log demo booked” to hand a lead off here.</p>
            ) : (
              <div className="divide-y divide-border border border-border">
                {bookings.map((b) => {
                  const audit = (b.trade_id_audit as Record<string, boolean>) ?? {};
                  const name = leads.find((l) => l.id === b.lead_id)?.studio_name ?? "Lead";
                  return (
                    <div key={b.id} className="grid gap-3 p-4 md:grid-cols-[220px_1fr]">
                      <div>
                        <p className="text-sm font-medium text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.demo_at ? new Date(b.demo_at).toLocaleString() : "Demo date TBC"}
                        </p>
                        <Badge variant={b.audit_status === "verified" ? "default" : "outline"} className="mt-2 text-[10px] capitalize">
                          {b.audit_status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {AUDIT_ITEMS.map((i) => (
                          <label key={i.key} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox checked={!!audit[i.key]} onCheckedChange={(c) => toggleAudit(b, i.key, c === true)} />
                            {i.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
