/**
 * Inline-editable principal contact name(s) for an acquisition lead.
 *
 * Writes the existing `founder_name` column on blur. Multiple names are fine
 * ("Jane Doe & John Smith") — the acquisition email greeting renders the
 * value verbatim ("Dear Jane Doe & John Smith"). A brief "Saved" marker
 * confirms the write and fades after one second.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  leadId: string;
  studioName: string;
  value: string | null;
  onChange: (next: string | null) => void;
};

const ContactNameInput = ({ leadId, studioName, value, onChange }: Props) => {
  const [draft, setDraft] = useState(value ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const flash = () => {
    setSaved(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaved(false), 1000);
  };

  const persist = async () => {
    const next = draft.trim() || null;
    if (next === (value ?? null)) return;
    const previous = value;
    onChange(next);
    setSaving(true);
    const { error } = await supabase
      .from("acquisition_leads")
      .update({ founder_name: next })
      .eq("id", leadId);
    setSaving(false);
    if (error) {
      setDraft(previous ?? "");
      onChange(previous);
      toast.error(`Could not update ${studioName} contact.`);
      return;
    }
    flash();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={persist}
        onKeyDown={handleKeyDown}
        disabled={saving}
        placeholder="Add principal name(s)…"
        className="w-full rounded-none border border-transparent bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/50 hover:border-border focus:border-foreground focus:bg-background focus:outline-none focus:ring-0 disabled:opacity-60"
      />
      <span
        aria-live="polite"
        className={`pointer-events-none absolute right-1 top-0 text-[9px] uppercase tracking-[0.18em] text-emerald-600 transition-opacity duration-300 ${
          saved ? "opacity-100" : "opacity-0"
        }`}
      >
        Saved
      </span>
    </div>
  );
};

export default ContactNameInput;
