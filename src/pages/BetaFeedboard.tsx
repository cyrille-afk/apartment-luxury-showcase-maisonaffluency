import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";

type Lane = "bug_hunt" | "workflow" | "copilot";
type Entry = {
  id: string;
  user_id: string;
  lane: Lane;
  title: string;
  observations: string | null;
  screenshot_path: string | null;
  created_at: string;
};

const LANES: { key: Lane; title: string; hint: string }[] = [
  { key: "bug_hunt", title: "BUG HUNT", hint: "Interface alignment issues, text truncations or broken loops." },
  { key: "workflow", title: "WORKFLOW REFINEMENTS", hint: "Pricing matrix calculations or navigation speeds." },
  { key: "copilot", title: "CO-PILOT REQUESTS", hint: "New AI extension features or custom document sheets." },
];

export default function BetaFeedboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLane, setOpenLane] = useState<Lane | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("beta_feedback_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load feedback");
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8 bg-background text-foreground">
      <Helmet><title>Beta Feedboard — Maison Affluency</title><meta name="robots" content="noindex" /></Helmet>
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Private Beta</p>
        <h1 className="font-display text-3xl">Beta Feedboard</h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-muted-foreground">
          Log bugs, refinements and co-pilot ideas. Your name and the time are attached automatically.
        </p>
      </header>

      <div className="flex flex-col gap-6 md:flex-row">
        {LANES.map((lane) => {
          const items = entries.filter((e) => e.lane === lane.key);
          return (
            <section key={lane.key} className="flex min-w-0 flex-1 flex-col border border-border bg-card">
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <h2 className="font-body text-xs font-medium tracking-[0.18em]">{lane.title}</h2>
                  <p className="mt-1 font-body text-[11px] text-muted-foreground">{lane.hint}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-[10px] tracking-[0.15em]" onClick={() => setOpenLane(lane.key)}>
                  <Plus className="mr-1 h-3 w-3" /> LOG AN ENTRY
                </Button>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {loading ? (
                  <p className="p-4 font-body text-xs text-muted-foreground">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="p-4 font-body text-xs text-muted-foreground">No entries yet.</p>
                ) : items.map((e) => <EntryCard key={e.id} entry={e} />)}
              </div>
            </section>
          );
        })}
      </div>

      <EntryDrawer lane={openLane} onClose={() => setOpenLane(null)} onSaved={load} />
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!entry.screenshot_path) return;
    supabase.storage.from("beta-feedback").createSignedUrl(entry.screenshot_path, 300)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [entry.screenshot_path]);
  return (
    <article className="p-4">
      <h3 className="font-body text-sm font-medium break-words">{entry.title}</h3>
      {entry.observations && <p className="mt-1 whitespace-pre-wrap break-words font-body text-xs text-muted-foreground">{entry.observations}</p>}
      {url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Screenshot" className="mt-3 max-h-40 w-full border border-border object-contain" /></a>}
      <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {new Date(entry.created_at).toLocaleString()}
      </p>
    </article>
  );
}

function EntryDrawer({ lane, onClose, onSaved }: { lane: Lane | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setTitle(""); setObs(""); setFile(null); };
  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please attach an image");
    if (f.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB");
    setFile(f);
  };

  const submit = async () => {
    if (!user || !lane || !title.trim()) return;
    setSaving(true);
    let screenshot_path: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("beta-feedback").upload(path, file, { contentType: file.type });
      if (error) { setSaving(false); return toast.error("Screenshot upload failed"); }
      screenshot_path = path;
    }
    const { error } = await supabase.from("beta_feedback_entries").insert({
      user_id: user.id, lane, title: title.trim().slice(0, 200), observations: obs.trim().slice(0, 5000) || null, screenshot_path,
    });
    setSaving(false);
    if (error) return toast.error("Could not save entry");
    toast.success("Entry logged");
    reset(); onClose(); onSaved();
  };

  return (
    <Sheet open={!!lane} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Log an entry — {LANES.find((l) => l.key === lane)?.title}</SheetTitle>
          <SheetDescription className="font-body text-xs">Your account and the time are recorded automatically.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Title</label>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Observations</label>
            <Textarea rows={5} value={obs} maxLength={5000} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-6 text-center transition-colors ${drag ? "border-foreground bg-muted" : "border-border"}`}
          >
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {file ? (
              <div className="flex items-center gap-2 font-body text-xs">
                <ImageIcon className="h-4 w-4" /> {file.name}
                <button type="button" aria-label="Remove screenshot" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="font-body text-xs text-muted-foreground">Drop an interface screenshot or click to browse</p>
              </>
            )}
          </div>
          <Button onClick={submit} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Submit entry"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
