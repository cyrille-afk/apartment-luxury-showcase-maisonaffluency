import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Status = "new" | "contacted" | "booked" | "closed";

interface Brief {
  id: string;
  session_id: string | null;
  invited_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  project_summary: string | null;
  aesthetic: string | null;
  budget_band: string | null;
  sentiment: string | null;
  pieces_of_interest: Array<{ name: string; reason?: string }>;
  viewing_requested_at: string | null;
  status: Status;
  admin_notes: string | null;
  last_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<Status, string> = {
  new: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  contacted: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  booked: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  closed: "bg-neutral-500/15 text-neutral-600 border-neutral-500/30",
};

export default function TradeAdminCnBriefs() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cn_director_briefs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(`Load failed: ${error.message}`);
      setLoading(false);
      return;
    }
    setBriefs((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => briefs.filter((b) => statusFilter === "all" || b.status === statusFilter),
    [briefs, statusFilter],
  );
  const active = briefs.find((b) => b.id === activeId) || filtered[0] || null;

  useEffect(() => {
    setNotesDraft(active?.admin_notes || "");
  }, [active?.id]);

  const setStatus = async (id: string, status: Status) => {
    setSaving(true);
    const { error } = await supabase
      .from("cn_director_briefs")
      .update({ status })
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status → ${status}`);
    await load();
  };

  const saveNotes = async () => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("cn_director_briefs")
      .update({ admin_notes: notesDraft })
      .eq("id", active.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Notes saved");
    await load();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl">CN Director Briefs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Mandarin concierge hand-offs — high-intent Greater China conversations & viewing requests.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {(["all", "new", "contacted", "booked", "closed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  statusFilter === s
                    ? "border-foreground text-foreground bg-foreground/5"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          {/* List */}
          <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
            {filtered.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground p-4">No briefs.</p>
            ) : null}
            {filtered.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  active?.id === b.id
                    ? "border-foreground bg-foreground/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body text-sm font-medium truncate">
                    {b.invited_name || "Anonymous VIP"}
                  </span>
                  <Badge variant="outline" className={STATUS_COLORS[b.status]}>
                    {b.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {b.project_summary || "—"}
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                  {b.viewing_requested_at ? (
                    <span className="text-accent font-medium">📍 Viewing</span>
                  ) : null}
                  <span>{new Date(b.updated_at).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <Card className="p-6">
            {!active ? (
              <p className="text-muted-foreground text-sm">Select a brief.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-heading text-2xl">{active.invited_name || "Anonymous VIP"}</h2>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>Created {new Date(active.created_at).toLocaleString()}</span>
                      {active.viewing_requested_at ? (
                        <span className="text-accent">· Viewing requested {new Date(active.viewing_requested_at).toLocaleDateString()}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {(["new", "contacted", "booked", "closed"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={active.status === s ? "default" : "outline"}
                        onClick={() => setStatus(active.id, s)}
                        disabled={saving}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Email</div>
                    <div>{active.contact_email || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Phone / WeChat</div>
                    <div>{active.contact_phone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Budget</div>
                    <div>{active.budget_band || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Sentiment</div>
                    <div>{active.sentiment || "—"}</div>
                  </div>
                </div>

                {active.project_summary ? (
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Project</div>
                    <p className="text-sm">{active.project_summary}</p>
                  </div>
                ) : null}

                {active.aesthetic ? (
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Aesthetic</div>
                    <p className="text-sm">{active.aesthetic}</p>
                  </div>
                ) : null}

                {active.pieces_of_interest?.length ? (
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Pieces of interest</div>
                    <ul className="text-sm space-y-1">
                      {active.pieces_of_interest.map((p, i) => (
                        <li key={i}>· <strong>{p.name}</strong>{p.reason ? ` — ${p.reason}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-6">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Internal notes</div>
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    placeholder="Follow-up notes, next step, assigned director…"
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={saveNotes} disabled={saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Save notes
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
