import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Check, KeyRound } from "lucide-react";

/**
 * Super-admin only: copy the current session's access token so it can be
 * exported as E2E_USER_ACCESS_TOKEN when running the /trade concierge
 * end-to-end tests locally. Read-only, never persisted anywhere.
 */
export function E2ETokenCopier() {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copyToken = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) {
        toast.error("No active session — sign in first.");
        return;
      }
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("Access token copied. Paste as E2E_USER_ACCESS_TOKEN.");
      setTimeout(() => setCopied(false), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to copy token");
    } finally {
      setBusy(false);
    }
  };

  const copyExport = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("No active session — sign in first.");
        return;
      }
      await navigator.clipboard.writeText(`export E2E_USER_ACCESS_TOKEN="${token}"`);
      toast.success("Shell export copied. Paste into your terminal.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to copy");
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
            end-to-end tests without spelunking DevTools. Token expires ~1h.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={copyToken}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-[11px] font-body text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy raw token"}
            </button>
            <button
              onClick={copyExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-[11px] font-body text-foreground hover:border-foreground/30 transition-colors"
            >
              <Copy className="h-3 w-3" />
              Copy shell export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
