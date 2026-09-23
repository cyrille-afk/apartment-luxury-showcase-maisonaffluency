/**
 * Multi-contact editor for an acquisition lead.
 *
 * Each row is one team member: a name and an email address. Names are
 * persisted joined with " & " into `founder_name` (the email greeting renders
 * it verbatim: "Dear Jane Doe & John Smith"); emails are persisted into
 * `executive_emails[]`, which the dispatch function treats as the recipient
 * list — every address entered here receives the invitation.
 *
 * Rows save on blur / Enter / explicit Save, with optimistic update, rollback
 * on failure, and a fading "Saved" marker.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Save, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Contact = { name: string; email: string };

type Props = {
  leadId: string;
  studioName: string;
  founderName: string | null;
  executiveEmails: string[] | null;
  onChange: (next: { founderName: string | null; executiveEmails: string[] }) => void;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function splitNames(value: string | null): string[] {
  return String(value ?? "")
    .split(/\s*(?:&|,|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const LeadContactsEditor = ({
  leadId,
  studioName,
  founderName,
  executiveEmails,
  onChange,
}: Props) => {
  const buildRows = (): Contact[] => {
    const names = splitNames(founderName);
    const emails = (executiveEmails ?? []).map((e) => String(e).trim()).filter(Boolean);
    const count = Math.max(names.length, emails.length);
    if (count === 0) return [];
    return Array.from({ length: count }, (_, i) => ({
      name: names[i] ?? "",
      email: emails[i] ?? "",
    }));
  };

  const [rows, setRows] = useState<Contact[]>(buildRows);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);
  // Set while the admin is typing in this editor. Prevents the props-sync
  // effect (which fires after our own optimistic save) from clobbering text
  // that has not been persisted yet.
  const dirty = useRef(false);

  useEffect(() => {
    if (dirty.current) return;
    setRows(buildRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [founderName, executiveEmails]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const flash = () => {
    setSaved(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaved(false), 1400);
  };

  const persist = async (nextRows: Contact[]) => {
    const clean = nextRows
      .map((r) => ({ name: r.name.trim(), email: r.email.trim().toLowerCase() }))
      .filter((r) => r.name || r.email);
    const bad = clean.find((r) => r.email && !EMAIL_RE.test(r.email));
    if (bad) {
      toast.error(`"${bad.email}" is not a valid email address.`);
      return;
    }
    const nextNames = clean.map((r) => r.name).filter(Boolean);
    const nextEmails = Array.from(new Set(clean.map((r) => r.email).filter(Boolean)));
    const nextFounder = nextNames.length > 0 ? nextNames.join(" & ") : null;

    const previous = { founderName, executiveEmails: executiveEmails ?? [] };
    onChange({ founderName: nextFounder, executiveEmails: nextEmails });
    setSaving(true);
    const { error } = await supabase
      .from("acquisition_leads")
      .update({ founder_name: nextFounder, executive_emails: nextEmails })
      .eq("id", leadId);
    setSaving(false);
    if (error) {
      setRows(buildRows());
      onChange(previous);
      toast.error(`Could not update ${studioName} contacts.`);
      return;
    }
    flash();
  };

  const setRow = (i: number, patch: Partial<Contact>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { name: "", email: "" }]);

  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    void persist(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="w-full min-w-[230px] space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          <UserRound className="h-3 w-3" />
          Recipients
        </span>
        <span
          aria-live="polite"
          className={`text-[9px] uppercase tracking-[0.18em] text-emerald-600 transition-opacity duration-300 ${
            saved ? "opacity-100" : "opacity-0"
          }`}
        >
          {saving ? "Saving…" : "Saved"}
        </span>
      </div>

      {rows.map((row, i) => (
        <div
          key={i}
          className="group flex items-center gap-1 border border-border/60 bg-muted/20 px-1.5 py-1 focus-within:border-foreground"
        >
          <input
            type="text"
            value={row.name}
            onChange={(e) => setRow(i, { name: e.target.value })}
            onBlur={() => void persist(rows)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder="Name"
            aria-label={`Contact ${i + 1} name for ${studioName}`}
            className="w-[45%] min-w-0 bg-transparent px-1 py-0.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-60"
          />
          <input
            type="email"
            value={row.email}
            onChange={(e) => setRow(i, { email: e.target.value })}
            onBlur={() => void persist(rows)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder="email@studio.com"
            aria-label={`Contact ${i + 1} email for ${studioName}`}
            className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            disabled={saving}
            aria-label={`Remove contact ${i + 1}`}
            className="shrink-0 p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        disabled={saving}
        className="inline-flex items-center gap-1.5 border border-dashed border-border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        {rows.length === 0 ? "Add recipient" : "Add another recipient"}
      </button>
      {rows.some((r) => r.name || r.email) && (
        <button
          type="button"
          onClick={() => void persist(rows)}
          disabled={saving}
          className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          Save
        </button>
      )}
    </div>
  );
};

export default LeadContactsEditor;
