import { Link } from "@/lib/router-compat";
import { GoogleAccessRequestForm } from "@/components/GoogleAccessRequestForm";
import { useState } from "react";

/**
 * Guidance that sits beside the Google sign-in button.
 *
 * The wording is deliberately one line: the earlier multi-paragraph
 * org_internal explanation read as technical filler and pushed the useful
 * links out of view. Google sign-in is an internal-team matter — everyone
 * else signs in with email and password.
 *
 * showAccessRequest keeps the inline request form on the full-page trade
 * sign-in only, so the sign-in lightbox stays clean.
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
    <div className="mt-3 space-y-3 font-body text-xs leading-relaxed text-muted-foreground">
      {showNote && (
        <p className="border-l border-border pl-3">
          <span className="font-semibold text-foreground">Note:</span>{" "}
          Google Sign-In is restricted to internal Maison Affluency team members. External
          partners and Trade accounts should log in using their email and password above.
        </p>
      )}
      {showApplyLink && (
        <Link
          to="/trade-program?intent=apply"
          className="inline-block text-foreground underline underline-offset-4"
        >
          New to the Trade Program? Apply for a Trade Account
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
