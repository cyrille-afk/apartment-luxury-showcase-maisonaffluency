import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Check, KeyRound } from "lucide-react";

/**
 * Super-admin only: copy the current session's access token so it can be
 * exported as E2E_USER_ACCESS_TOKEN when running the /trade concierge
 * end-to-end tests locally. Read-only, never persisted anywhere.
 *
 * Auto-refresh: if the current JWT expires in under 5 minutes (or is
 * already expired), we force `supabase.auth.refreshSession()` before
 * copying so the caller always gets a comfortably-live token.
 */
const REFRESH_THRESHOLD_SECONDS = 5 * 60;

async function getFreshAccessToken(): Promise<{ token: string; expiresAt: number } | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  let session = data.session;
  if (!session) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;
  const needsRefresh = !expiresAt || expiresAt - nowSec < REFRESH_THRESHOLD_SECONDS;

  if (needsRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    if (!refreshed.session) return null;
    session = refreshed.session;
  }

  return {
    token: session.access_token,
    expiresAt: session.expires_at ?? 0,
  };
}

function formatRemaining(expiresAt: number): string {
  const secondsLeft = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${mins}m ${secs}s`;
}

export function E2ETokenCopier() {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastCopiedAt, setLastCopiedAt] = useState<number | null>(null);

  const copyToken = async () => {
    setBusy(true);
    try {
      const fresh = await getFreshAccessToken();
      if (!fresh) {
        toast.error("No active session — sign in first.");
        return;
      }
      await navigator.clipboard.writeText(fresh.token);
      setCopied(true);
      setLastCopiedAt(fresh.expiresAt);
      toast.success(`Token copied — valid for ${formatRemaining(fresh.expiresAt)}.`);
      setTimeout(() => setCopied(false), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to copy token");
    } finally {
      setBusy(false);
    }
  };

  const copyExport = async () => {
    setBusy(true);
    try {
      const fresh = await getFreshAccessToken();
      if (!fresh) {
        toast.error("No active session — sign in first.");
        return;
      }
      await navigator.clipboard.writeText(`export E2E_USER_ACCESS_TOKEN="${fresh.token}"`);
      setLastCopiedAt(fresh.expiresAt);
      toast.success(`Shell export copied — valid for ${formatRemaining(fresh.expiresAt)}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to copy");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm text-foreground">E2E Test Token</div>
          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
            Copies your current session JWT so you can run the trade concierge
            end-to-end tests without spelunking DevTools. Auto-refreshes when
            the token has under 5 minutes left.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={copyToken}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-[11px] font-body text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {busy ? "Refreshing…" : copied ? "Copied" : "Copy raw token"}
            </button>
            <button
              onClick={copyExport}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-[11px] font-body text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            >
              <Copy className="h-3 w-3" />
              {busy ? "Refreshing…" : "Copy shell export"}
            </button>
          </div>
          {lastCopiedAt && (
            <p className="font-body text-[10px] text-muted-foreground mt-2">
              Last copied token expires at{" "}
              {new Date(lastCopiedAt * 1000).toLocaleTimeString()}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
