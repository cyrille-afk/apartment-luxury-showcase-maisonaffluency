import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  GitBranch,
  RefreshCw,
  CircleDashed,
  ExternalLink,
} from "lucide-react";

type SyncStatus = {
  repo: string;
  branch: string;
  deployed: { commitSha: string | null };
  syncState: "in_sync" | "ahead_of_github" | "unknown";
  commit: {
    sha: string;
    shortSha: string;
    message: string;
    committedAt: string | null;
    url: string | null;
  };
  check: {
    name: string;
    status: string;
    conclusion: string | null;
    url: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  fetchedAt: string;
};

const timeAgo = (iso: string | null) => {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function GitHubSyncStatusPanel() {
  const [data, setData] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("github-sync-status");
    if (err) {
      setError(err.message ?? "Failed to load GitHub status");
      setData(null);
    } else if (res?.error) {
      setError(res.error);
      setData(null);
    } else {
      setData(res as SyncStatus);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const check = data?.check ?? null;
  const passing = check?.status === "completed" && check?.conclusion === "success";
  const failing = check?.status === "completed" && check?.conclusion && check.conclusion !== "success";
  const running = check && check.status !== "completed";

  return (
    <section
      aria-label="GitHub sync status"
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg text-foreground">GitHub Sync</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          aria-label="Refresh GitHub status"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <p className="font-body text-sm text-destructive">GitHub status unavailable: {error}</p>
      )}

      {!error && !data && (
        <p className="font-body text-sm text-muted-foreground">Loading sync status…</p>
      )}

      {data && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-body text-sm text-muted-foreground">
              {data.repo} · {data.branch}
            </span>
            {data.commit.url ? (
              <a
                href={data.commit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-sm text-foreground underline underline-offset-2"
              >
                {data.commit.shortSha}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-mono text-sm text-foreground">{data.commit.shortSha}</span>
            )}
            <span className="font-body text-xs text-muted-foreground">
              {timeAgo(data.commit.committedAt)}
            </span>
          </div>
          <p className="font-body text-sm text-muted-foreground line-clamp-1">
            {data.commit.message}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-sm text-muted-foreground">playwright-visual</span>
            {passing && (
              <Badge className="gap-1 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30">
                <CheckCircle2 className="h-3.5 w-3.5" /> Passed
              </Badge>
            )}
            {failing && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3.5 w-3.5" /> Failed ({check!.conclusion})
              </Badge>
            )}
            {running && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running
              </Badge>
            )}
            {!check && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <CircleDashed className="h-3.5 w-3.5" /> No run for this commit
              </Badge>
            )}
            {check?.url && (
              <a
                href={check.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-body text-xs text-muted-foreground underline underline-offset-2"
              >
                View run <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
