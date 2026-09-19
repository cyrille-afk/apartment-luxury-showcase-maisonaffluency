import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** Reminder entity family: quote_unpaid, cart or funnel_card. */
  entityType: string;
  entityId: string;
}

/**
 * Manual override on a funnel card: when ON, the automated reminder engine
 * skips this client entirely, no matter how many days have passed.
 */
export default function FunnelReminderPauseToggle({ entityType, entityId }: Props) {
  const { toast } = useToast();
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("funnel_reminder_pauses")
      .select("paused")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setPaused(Boolean(data?.paused));
      });
    return () => {
      active = false;
    };
  }, [entityType, entityId]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    const previous = paused;
    setPaused(next);
    const { error } = await supabase.from("funnel_reminder_pauses").upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        paused: next,
        reason: next ? "manual_pause" : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,entity_id" },
    );
    setBusy(false);
    if (error) {
      setPaused(previous);
      toast({
        title: "Could not update reminders",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: next ? "Reminders paused" : "Reminders resumed",
      description: next
        ? "No automatic follow-ups will be sent for this client."
        : "Automatic follow-ups will resume on the spaced schedule.",
    });
  };

  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-border/70 pt-2.5">
      <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <BellOff className="h-3 w-3" /> Pause reminders
      </span>
      <Switch
        checked={paused}
        disabled={busy}
        onCheckedChange={toggle}
        aria-label="Pause automatic reminders for this quote"
        className="scale-75"
      />
    </div>
  );
}
