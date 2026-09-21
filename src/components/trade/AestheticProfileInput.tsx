/**
 * Editable Aesthetic Profile cell.
 *
 * Replaces a static text cell with an inline text area that writes the
 * `aesthetic_profile` column on blur. A brief "Saved" marker confirms the write
 * and fades after one second.
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

const AestheticProfileInput = ({ leadId, studioName, value, onChange }: Props) => {
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
    const previous = value;
    onChange(next);
    setSaving(true);
    const { error } = await supabase
      .from("acquisition_leads")
      .update({ aesthetic_profile: next })
      .eq("id", leadId);
    setSaving(false);
    if (error) {
      setDraft(previous ?? "");
      onChange(previous);
      toast.error(`Could not update ${studioName} profile.`);
      return;
    }
    flash();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={persist}
        onKeyDown={handleKeyDown}
        disabled={saving}
        placeholder="Click to add material syntax notes…"
        rows={2}
        className="w-full resize-none rounded-none border border-border bg-background p-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none focus:ring-0 disabled:opacity-60"
      />
      <span
        aria-live="polite"
        className={`absolute right-2 top-2 text-[9px] uppercase tracking-[0.18em] text-emerald-600 transition-opacity duration-300 ${
          saved ? "opacity-100" : "opacity-0"
        }`}
      >
        Saved
      </span>
    </div>
  );
};

export default AestheticProfileInput;
