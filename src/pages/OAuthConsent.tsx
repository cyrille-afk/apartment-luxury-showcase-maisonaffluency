import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

// Consent screen for external OAuth clients (ChatGPT extension) connecting to
// the Maison Affluency MCP server. Signed-out members are sent to /trade/login
// with ?next= so they return here with the same authorization_id.
export default function OAuthConsent() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const authorizationId = new URLSearchParams(window.location.search).get("authorization_id") ?? "";
  const [details, setDetails] = useState<{ clientName: string; scopes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!authorizationId) { setError("Missing authorization request."); return; }
    if (!user) {
      const next = `${window.location.pathname}${window.location.search}`;
      navigate(`/trade/login?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await (supabase.auth as any).oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) { setError(error?.message ?? "This authorization request is invalid or expired."); return; }
      if ("redirect_url" in data && !("authorization_id" in data)) { window.location.href = data.redirect_url; return; }
      setDetails({
        clientName: data.client?.name || data.client?.client_name || "An external application",
        scopes: String(data.scope ?? "").split(" ").filter(Boolean),
      });
    })();
  }, [loading, user, authorizationId, navigate]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const api = (supabase.auth as any).oauth;
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await api.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (error || !data?.redirect_url) { setError(error?.message ?? "Could not complete the request."); setBusy(false); return; }
    window.location.href = data.redirect_url;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md border border-border bg-card p-8 space-y-6">
        <p className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Maison Affluency · Trade</p>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <h1 className="font-serif text-2xl text-foreground">Connect {details.clientName}</h1>
            <p className="text-sm text-muted-foreground">
              {details.clientName} is requesting access to your trade account
              {user?.email ? <> (<span className="text-foreground">{user.email}</span>)</> : null}: browse the catalogue,
              list your active project folders and stage pieces into them. Trade pricing stays on maisonaffluency.com.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Approve</Button>
              <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>Deny</Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
