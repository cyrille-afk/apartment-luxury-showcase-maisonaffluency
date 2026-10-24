import { Link } from "@/lib/router-compat";
import { GoogleAccessRequestForm } from "@/components/GoogleAccessRequestForm";

export function GoogleAccessNotice() {
  return (
    <div className="mt-3 space-y-2 font-body text-xs leading-relaxed text-muted-foreground">
      <p>
        Google showing “Access blocked” or “org_internal”? Google sign-in is currently
        restricted to Maison Affluency’s organisation. A personal Gmail account may be blocked
        even if your Trade account is approved.
      </p>
      <p>
        To request Google sign-in access, email{" "}
        <a className="text-foreground underline underline-offset-4" href="mailto:trade@maisonaffluency.com?subject=Google%20sign-in%20access%20request">
          trade@maisonaffluency.com
        </a>{" "}
        with the Google email address you want to use. Existing members can use their
        approved account’s email and password instead. Google sign-in access does not grant Trade approval.
      </p>
      <Link to="/trade-program?intent=apply" className="inline-block text-foreground underline underline-offset-4">
        New to the Trade Program? Apply for a Trade Account
      </Link>
      <details className="pt-2">
        <summary className="cursor-pointer text-sm text-foreground underline underline-offset-4">Request Trade Access</summary>
        <div className="pt-3"><GoogleAccessRequestForm /></div>
      </details>
    </div>
  );
}