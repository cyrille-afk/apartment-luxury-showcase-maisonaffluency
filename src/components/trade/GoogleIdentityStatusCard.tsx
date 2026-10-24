import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleIdentityStatus, type GoogleIdentityStatus } from "@/lib/googleIdentityStatus";

export default function GoogleIdentityStatusCard() {
  const [status, setStatus] = useState<GoogleIdentityStatus | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) setStatus(getGoogleIdentityStatus(data.user));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!status) return null;

  const Icon = status.kind === "matched" ? CheckCircle2 : status.kind === "not_linked" ? Info : AlertCircle;
  const iconClass = status.kind === "matched" ? "text-primary" : status.kind === "not_linked" ? "text-muted-foreground" : "text-destructive";

  return (
    <section className="mb-8 rounded-lg border border-border bg-muted/30 px-4 py-3" data-testid="google-identity-status">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
        <div className="font-body text-xs text-muted-foreground space-y-1">
          <div className="font-display text-sm text-foreground">Google sign-in</div>
          {status.kind === "matched" && (
            <p>Your Google account ({status.googleEmail}) matches your verified email. You can sign in with Google or your password.</p>
          )}
          {status.kind === "not_linked" && (
            <p>
              No Google account is connected. To sign in with Google, use a Google account with the same address as your
              verified email ({status.accountEmail}). A Google account with a different address opens a separate account
              instead — keep signing in with your email and password, or contact trade@maisonaffluency.com.
            </p>
          )}
          {status.kind === "mismatch" && (
            <p>
              Your Google account ({status.googleEmail || "unknown"}) doesn't match your verified email ({status.accountEmail}).
              Sign in with your email and password, and contact trade@maisonaffluency.com so the team can review your account.
            </p>
          )}
          {status.kind === "unverified" && (
            <p>
              Your email ({status.accountEmail}) isn't verified yet. Confirm it from the email we sent you before using a matching
              Google account to sign in.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
