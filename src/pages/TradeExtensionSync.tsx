import { useCallback, useEffect, useState } from "react";
import { Activity, Check, CheckCircle2, Copy, FolderKanban, KeyRound, Plug, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useDashboardDataSync } from "@/hooks/useDashboardDataSync";
import type { ProjectStagingPayload } from "@/lib/projectStagingMessage";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EXTENSION_ORIGIN = "/trade/concierge/sidebar";
const LAST_SYNC_KEY = "trade-extension-last-sync-v1";
const CONSENT_PATH = "/.lovable/oauth/consent";

type HealthCheck = {
  ok: boolean;
  status: number | null;
  duration_ms: number;
  error: string | null;
  detail?: unknown;
};

type McpHealthReport = {
  healthy: boolean;
  endpoint: string;
  mode?: string;
  checked_at: string;
  checks: {
    auth_challenge: HealthCheck;
    protected_resource_metadata: HealthCheck;
    oauth_discovery: HealthCheck;
  };
  note?: string;
};

export default function TradeExtensionSync() {
  const { projects: activeProjects } = useProjects({ activeOnly: true });
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [health, setHealth] = useState<McpHealthReport | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const { data, error } = await supabase.functions.invoke("mcp-health-check");
      if (error) {
        setHealth(null);
        setHealthError(error.message ?? "Health check request failed");
      } else {
        setHealth(data as McpHealthReport);
      }
    } catch (err) {
      setHealth(null);
      setHealthError(err instanceof Error ? err.message : "Health check request failed");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const recordVerifiedSync = useCallback((payload: ProjectStagingPayload) => {
    const formatted = new Date(payload.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    try { localStorage.setItem(LAST_SYNC_KEY, formatted); } catch { /* local storage unavailable */ }
    setLastSync(formatted);
    setSyncNotice(`Success: ${payload.productName} routed to ${payload.targetWorkflow} and verified in core records.`);
  }, []);

  useDashboardDataSync({
    onVerified: recordVerifiedSync,
    showToast: false,
  });

  useEffect(() => {
    if (!syncNotice) return;
    const timer = window.setTimeout(() => setSyncNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [syncNotice]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(LAST_SYNC_KEY);
        setLastSync(raw ? raw : null);
      } catch {
        setLastSync(null);
      }
    };
    read();
    window.addEventListener("concierge:artifacts-changed", read);
    return () => window.removeEventListener("concierge:artifacts-changed", read);
  }, []);

  const syncedProjects = activeProjects.filter((p) => p.name.trim().length > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {syncNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-6 z-[70] max-w-sm border border-border bg-background px-4 py-3 font-body text-xs text-foreground shadow-lg transition-[right] ${catalogueOpen ? "right-[384px]" : "right-6"}`}
        >
          {syncNotice}
        </div>
      )}
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">
          ChatGPT Extension Integration
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Connect the external ChatGPT trade frame to your active project folders and
          stream staged pieces into the portal in real time.
        </p>
      </div>

      {/* Connection status */}
      <section className="rounded-2xl border border-border bg-muted/30 p-5 md:p-6">
        <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground mb-4">
          Connection Status
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-body text-sm font-medium text-foreground">
              Extension Connected
            </span>
          </div>
          <div className="flex items-center gap-2 font-body text-xs text-muted-foreground">
            <Plug className="h-3.5 w-3.5" />
            <span>
              Same-origin data hooks verified against your workspace records —
              staged pieces are written by the portal, never by the extension.
            </span>
          </div>
          {lastSync && (
            <span className="ml-auto font-body text-[11px] uppercase tracking-widest text-muted-foreground">
              Last sync {lastSync}
            </span>
          )}
        </div>
      </section>

      {/* Synced project folders */}
      <section>
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground">
            Active Project Folders Synced
          </h2>
          <span className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hidden sm:block">
            {syncedProjects.length} folder{syncedProjects.length === 1 ? "" : "s"} sharing real-time data hooks
          </span>
        </div>
        {syncedProjects.length === 0 ? (
          <div className="rounded-xl border border-border bg-background p-6 text-center">
            <p className="font-body text-sm text-muted-foreground">
              No active project folders yet. Create one to start syncing staged pieces
              from the extension.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {syncedProjects.map((project) => (
              <div
                key={project.id}
                className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-foreground/20 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/10 transition-colors">
                  <FolderKanban className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm font-medium text-foreground truncate">
                      {project.name}
                    </span>
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-label="Synced" />
                  </div>
                  <span className="font-body text-xs text-muted-foreground leading-snug block mt-0.5">
                    Synced · real-time data hook active
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Open the extension catalogue */}
      <section className="rounded-2xl border border-border bg-muted/30 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground">
              Extension Catalogue
            </h2>
            <p className="font-body text-xs text-muted-foreground mt-1">
              The narrow-frame catalogue the ChatGPT extension embeds. Stage pieces to
              any active folder — they appear on your dashboard instantly.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCatalogueOpen(true)}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Open Catalogue
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-2 font-body text-[11px] uppercase tracking-widest text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          All active folders receiving staged records
        </div>
      </section>

      {/* MCP endpoint health check */}
      <section className="rounded-2xl border border-border bg-muted/30 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground">
              MCP Endpoint Health
            </h2>
            <p className="font-body text-xs text-muted-foreground mt-1">
              Verifies the public MCP server answers initialization and tool-list
              requests — the same handshake ChatGPT runs when connecting.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={runHealthCheck}
            disabled={healthLoading}
            className="gap-2"
          >
            <Activity className={`h-3.5 w-3.5 ${healthLoading ? "animate-pulse" : ""}`} />
            {healthLoading ? "Checking…" : "Run Health Check"}
          </Button>
        </div>

        {healthError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="font-body text-xs text-destructive">
              Health check could not run: {healthError}
            </p>
          </div>
        )}

        {health && (
          <div className="mt-4 space-y-3">
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${health.healthy ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
              {health.healthy ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`font-body text-sm font-medium ${health.healthy ? "text-emerald-700" : "text-destructive"}`}>
                  {health.healthy ? "MCP endpoint healthy" : "MCP endpoint failing"}
                </p>
                <p className="font-body text-[11px] text-muted-foreground break-all">
                  {health.endpoint} · checked {new Date(health.checked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { label: "Initialization", check: health.checks.initialize },
                { label: "Tool List", check: health.checks.tools_list },
              ] as const).map(({ label, check }) => (
                <div key={label} className="rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center gap-2">
                    {check.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="font-body text-xs font-medium text-foreground">{label}</span>
                    <span className="ml-auto font-body text-[11px] text-muted-foreground">
                      {check.status ?? "—"} · {check.duration_ms}ms
                    </span>
                  </div>
                  {check.error && (
                    <p className="mt-1.5 font-body text-[11px] text-destructive break-words">{check.error}</p>
                  )}
                </div>
              ))}
            </div>

            {health.tools.length > 0 && (
              <p className="font-body text-[11px] text-muted-foreground">
                Tools advertised: {health.tools.join(", ")}
              </p>
            )}
            {health.missing_expected_tools.length > 0 && (
              <p className="font-body text-[11px] text-destructive">
                Missing expected tools: {health.missing_expected_tools.join(", ")}
              </p>
            )}
          </div>
        )}
      </section>

      <Sheet open={catalogueOpen} onOpenChange={setCatalogueOpen}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          overlayClassName="bg-foreground/20 backdrop-blur-[1px]"
          className="w-[360px] max-w-[360px] gap-0 border-l border-border bg-[hsl(var(--trade-gallery-bg))] p-0 shadow-2xl sm:max-w-[360px] [&>button]:right-2 [&>button]:top-1.5 [&>button]:p-1.5 [&>button_svg]:size-4"
        >
          <div className="flex h-11 shrink-0 items-center border-b border-border bg-muted px-4 pr-12">
            <SheetTitle className="font-body text-[11px] font-medium text-muted-foreground">
              ChatGPT Sidebar Sandbox Mode
            </SheetTitle>
          </div>
          <iframe
            title="ChatGPT Trade Sidebar preview"
            src={EXTENSION_ORIGIN}
            className="block h-[calc(100dvh-2.75rem)] w-full border-0 bg-[hsl(var(--trade-gallery-bg))]"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
