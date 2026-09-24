import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, PauseCircle, RefreshCw } from "lucide-react";
import VisualThemeAnalysis, { type VisualThemeDna } from "@/components/trade/VisualThemeAnalysis";
import { WaitingClock } from "@/components/trade/TimeToApproval";

type Dna = VisualThemeDna & {
  status: string;
  error: string | null;
};
type Account = {
  id: string;
  email: string;
  studio_name: string | null;
  contact_name: string | null;
  website_or_ig: string | null;
  business_reg_number: string | null;
  status: "pending_review" | "on_hold" | "approved" | "rejected";
  created_at: string;
  radar_score: number | null;
  radar_flag: string | null;
  radar_status: string | null;
  studio_aesthetic_dna: Dna | Dna[] | null;
};

function priorityFor(score: number | null): { label: "High" | "Medium" | "Low"; variant: "default" | "secondary" | "destructive" } {
  if (score === null) return { label: "Low", variant: "secondary" };
  if (score >= 80) return { label: "High", variant: "default" };
  if (score >= 50) return { label: "Medium", variant: "secondary" };
  return { label: "Low", variant: "destructive" };
}

const STATUS_LABEL: Record<Account["status"], string> = {
  pending_review: "Pending Review",
  on_hold: "On Hold",
  approved: "Approved",
  rejected: "Rejected",
};

function linkFor(ref: string) {
  if (ref.startsWith("@")) return `https://www.instagram.com/${ref.slice(1)}/`;
  return /^https?:\/\//i.test(ref) ? ref : `https://${ref}`;
}

export default function TradeApplicationsQueue() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["trade-applications-queue", showDone],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("trade_accounts")
        .select(
          "id, email, studio_name, contact_name, website_or_ig, business_reg_number, status, created_at, radar_score, radar_flag, radar_status, studio_aesthetic_dna(status, aesthetic_label, aesthetic_summary, dominant_tones, historical_affinities, materials, image_urls, error)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (!showDone) q = q.in("status", ["pending_review", "on_hold"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Account[];
    },
  });

  const setStatus = async (a: Account, status: Account["status"]) => {
    setBusy(a.id + status);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("trade_accounts")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: u.user?.id ?? null })
      .eq("id", a.id);
    setBusy(null);
    if (error) return toast.error("Could not update the application.");
    toast.success(`${a.studio_name ?? a.email} — ${STATUS_LABEL[status]}`);
    qc.invalidateQueries({ queryKey: ["trade-applications-queue"] });
    qc.invalidateQueries({ queryKey: ["trade-time-to-approval"] });
  };

  const rerun = async (a: Account) => {
    setBusy(a.id + "dna");
    const { data, error } = await supabase.functions.invoke("analyze-studio-aesthetic", {
      body: { trade_account_id: a.id },
    });
    setBusy(null);
    if (error || data?.ok === false) toast.error(data?.error ?? "Analysis failed.");
    else toast.success("Aesthetic analysis updated.");
    qc.invalidateQueries({ queryKey: ["trade-applications-queue"] });
  };

  return (
    <section className="border border-border">
      <header className="flex flex-col gap-3 border-b border-border px-6 py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Inbound</p>
          <h2 className="font-serif text-2xl tracking-tight text-foreground">Trade Applications</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {showDone ? "Show open only" : "Show approved & rejected"}
        </button>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading applications…
        </div>
      ) : accounts.length === 0 ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">No applications awaiting review.</p>
      ) : (
        <ul className="divide-y divide-border">
          {accounts.map((a) => {
            const dna = Array.isArray(a.studio_aesthetic_dna) ? a.studio_aesthetic_dna[0] : a.studio_aesthetic_dna;
            return (
              <li key={a.id} className="bg-background">
                <div className="grid gap-5 px-6 py-5 md:grid-cols-[1.1fr_1fr_auto]">
                 <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{a.studio_name ?? "(studio not provided)"}</span>
                    <Badge variant={a.status === "approved" ? "default" : "outline"} className="rounded-none text-[10px] uppercase tracking-wider">
                      {STATUS_LABEL[a.status]}
                    </Badge>
                  </div>
                  {a.contact_name && <div className="text-muted-foreground">{a.contact_name}</div>}
                  <div className="text-muted-foreground">{a.email}</div>
                  {a.website_or_ig && (
                    <a href={linkFor(a.website_or_ig)} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                      {a.website_or_ig}
                    </a>
                  )}
                  {a.business_reg_number && <div className="text-xs text-muted-foreground">Reg. {a.business_reg_number}</div>}
                  <div className="pt-1">
                    <WaitingClock
                      createdAt={a.created_at}
                      open={a.status === "pending_review" || a.status === "on_hold"}
                      highIntent={a.radar_score !== null && a.radar_score >= 80}
                    />
                  </div>
                </div>

                 <div className="space-y-2 text-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI Critical Radar</p>
                  {a.radar_status === "scored" && a.radar_score !== null ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg text-foreground">{a.radar_score}/100</span>
                        <Badge variant={priorityFor(a.radar_score).variant} className="rounded-none text-[10px] uppercase tracking-wider">
                          {priorityFor(a.radar_score).label} priority
                        </Badge>
                      </div>
                      {a.radar_flag && <p className="text-muted-foreground">{a.radar_flag}</p>}
                    </>
                  ) : a.radar_status === "failed" ? (
                    <p className="text-destructive">Scoring failed{a.radar_flag ? `: ${a.radar_flag}` : ""}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Scoring…
                    </div>
                  )}
                </div>

                 <div className="flex flex-col gap-2 md:w-56">
                  <Button
                    onClick={() => setStatus(a, "approved")}
                    disabled={a.status === "approved" || busy !== null}
                    className="h-11 rounded-none text-[11px] uppercase tracking-[0.2em]"
                  >
                    {busy === a.id + "approved" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Approve Trade Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatus(a, "on_hold")}
                    disabled={a.status === "on_hold" || busy !== null}
                    className="h-11 rounded-none text-[11px] uppercase tracking-[0.2em]"
                  >
                    {busy === a.id + "on_hold" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                    Hold / Review
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rerun(a)}
                    disabled={busy === a.id + "dna" || busy !== null}
                    className="mt-1 rounded-none text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {busy === a.id + "dna" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Re-run analysis
                  </Button>
                </div>
                </div>

                {!dna || dna.status === "pending" || dna.status === "processing" ? (
                  <div className="flex items-center gap-2 border-t border-border px-6 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analysing portfolio…
                  </div>
                ) : dna.status === "failed" ? (
                  <>
                    <div className="border-t border-border px-6 pt-5 text-xs text-destructive">{dna.error ?? "Analysis failed"} — use “Re-run analysis” to retry.</div>
                    <VisualThemeAnalysis dna={dna} accountId={a.id} onSaved={() => qc.invalidateQueries({ queryKey: ["trade-applications-queue"] })} />
                  </>
                ) : (
                  <VisualThemeAnalysis dna={dna} accountId={a.id} onSaved={() => qc.invalidateQueries({ queryKey: ["trade-applications-queue"] })} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
