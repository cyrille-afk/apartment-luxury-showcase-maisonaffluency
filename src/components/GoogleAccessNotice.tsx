import { Link } from "@/lib/router-compat";
import { GoogleAccessRequestForm } from "@/components/GoogleAccessRequestForm";
import { useState } from "react";

/**
 * Guidance that sits under the Google sign-in button.
 *
 * One short, muted line: the earlier multi-paragraph explanation quoted
 * Google's own error wording and read as technical filler, so it is gone.
 * Google sign-in is an internal-team matter — everyone else signs in with
 * email and password.
 *
 * showAccessRequest keeps the inline request form on the full-page trade
 * sign-in only, so the sign-in lightbox stays clean. showApplyLink is
 * switched off where the page already carries its own footer link.
 */
export function GoogleAccessNotice({
  showNote = true,
  showApplyLink = true,
  showAccessRequest = false,
}: {
  showNote?: boolean;
  showApplyLink?: boolean;
  showAccessRequest?: boolean;
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  return (
    <div className="mt-3 space-y-2 font-body text-[11px] leading-relaxed text-muted-foreground/80">
      {showNote && (
        <p>
          Google Sign-In is for internal staff only. If you are a Trade Member
          and prefer Google access, please contact{" "}
          <a
            href="mailto:trade@maisonaffluency.com"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            trade@maisonaffluency.com
          </a>{" "}
          to whitelist your email.
        </p>
      )}
      {showApplyLink && (
        <Link
          to="/trade-program?intent=apply"
          className="inline-block text-foreground underline underline-offset-4"
        >
          Don’t have an account? Apply for the Trade Program.
        </Link>
      )}
      {showAccessRequest && (
        <details className="pt-1" onToggle={event => setRequestOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-sm text-foreground underline underline-offset-4">
            Request Google sign-in access
          </summary>
          {requestOpen && (
            <div className="pt-3">
              <GoogleAccessRequestForm />
            </div>
          )}
        </details>
      )}
    </div>
  );
}
