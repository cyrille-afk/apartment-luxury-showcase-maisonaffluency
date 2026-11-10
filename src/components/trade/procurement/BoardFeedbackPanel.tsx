import { useState } from "react";
import { Heart, MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type BoardFeedbackEntry = { id: string; reaction: string | null; comment: string | null; created_at: string; sender: string };

export default function BoardFeedbackPanel({ productName, entries, note, onClose, onSave }: {
  productName: string; entries: BoardFeedbackEntry[]; note: string; onClose: () => void;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setResult(null);
    try {
      const saved = await onSave(draft);
      setResult(saved ? "Note saved" : "Could not save note. Please try again.");
    } catch { setResult("Could not save note. Please try again."); }
    finally { setSaving(false); }
  };
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" data-trade-sensitive className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px] motion-reduce:animate-none" overlayClassName="bg-foreground/20 backdrop-blur-sm motion-reduce:animate-none">
        <SheetHeader className="shrink-0 border-b border-border px-8 pb-6 pt-10 text-left">
          <SheetTitle className="pr-8 font-display text-2xl font-normal">Client Feedback History</SheetTitle>
          <SheetDescription className="font-body text-sm">{productName}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
          {entries.length ? <ol className="space-y-7">
            {[...entries].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((entry) => (
              <li key={entry.id} className="border-b border-border/60 pb-6 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="break-words font-body text-sm font-medium text-foreground">{entry.sender}</p>
                  <time dateTime={entry.created_at} className="font-body text-[11px] text-muted-foreground">{new Date(entry.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                </div>
                {entry.reaction && <p className="mt-3 flex items-center gap-2 font-body text-xs text-foreground">
                  {entry.reaction === "heart" ? <Heart className="h-3.5 w-3.5" /> : entry.reaction === "up" ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                  {entry.reaction === "down" ? "Disliked selection" : entry.reaction === "heart" ? "Approved selection" : "Liked selection"}
                </p>}
                {entry.comment && <p className="mt-3 whitespace-pre-wrap break-words font-body text-sm leading-relaxed text-foreground">{entry.comment}</p>}
              </li>
            ))}
          </ol> : <div className="flex items-center gap-3 font-body text-sm text-muted-foreground"><MessageSquare className="h-4 w-4" />No client feedback yet.</div>}
        </div>
        <div className="max-h-[45dvh] shrink-0 overflow-y-auto border-t border-border bg-muted/40 px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <label htmlFor="studio-private-note" className="mb-4 block font-body text-xs font-medium text-foreground">Internal Studio Notes (Private)</label>
          <Textarea id="studio-private-note" value={draft} onChange={(event) => { setDraft(event.target.value); setResult(null); }} maxLength={2000} rows={4} placeholder="Procurement notes, flags, client summary…" className="resize-none rounded-none bg-background font-body text-sm" />
          <div className="mt-4 flex items-center justify-between gap-4">
            <p role="status" className="font-body text-xs text-muted-foreground">{result}</p>
            <Button size="sm" disabled={saving} variant="outline" onClick={save} className="shrink-0 cursor-pointer rounded-none">{saving ? "Saving…" : "Save note"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}