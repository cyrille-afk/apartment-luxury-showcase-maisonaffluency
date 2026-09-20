import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type RequestType = "access" | "portability" | "erasure" | "rectification" | "restriction";

const OPTIONS: { value: RequestType; label: string }[] = [
  { value: "access", label: "A copy of my data (access)" },
  { value: "portability", label: "My data in a portable file" },
  { value: "rectification", label: "Correct my data" },
  { value: "restriction", label: "Restrict processing of my data" },
  { value: "erasure", label: "Erase my data" },
];

/**
 * Formal GDPR / PDPA data-rights intake. Requests are recorded server-side
 * with a statutory 30-day deadline; nothing is released until the requester
 * confirms control of the email address.
 */
const DataRightsRequest = () => {
  const [params, setParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("access");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Confirmation link from the verification email: /privacy?dsar=…&token=…
  useEffect(() => {
    const id = params.get("dsar");
    const token = params.get("token");
    if (!id || !token) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("data-subject-request", {
        body: { action: "verify", id, token },
      });
      if (error || (data as { error?: string })?.error) {
        toast.error("That confirmation link is no longer valid.");
      } else {
        setConfirmed(true);
        toast.success("Request confirmed. We will respond within 30 days.");
      }
      params.delete("dsar");
      params.delete("token");
      setParams(params, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("data-subject-request", {
      body: { action: "submit", email, requestType, details },
    });
    setSubmitting(false);
    const failure = error?.message || (data as { error?: string })?.error;
    if (failure) {
      toast.error(failure);
      return;
    }
    setSubmitted(true);
  };

  if (confirmed || submitted) {
    return (
      <div className="mt-6 rounded-lg border border-border p-6">
        <p className="text-sm text-foreground">
          {confirmed
            ? "Your request is confirmed and recorded. Our compliance desk will respond within 30 days."
            : "Check your inbox — we have sent a confirmation link. Your request starts once you confirm it."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border p-6 space-y-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Exercise your data rights
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          aria-label="Your email address"
        />
        <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
          <SelectTrigger aria-label="Request type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Anything that helps us find your records (optional)"
        rows={3}
      />
      <Button onClick={submit} disabled={submitting || !email.trim()} className="tracking-wider">
        {submitting ? "Sending…" : "Submit request"}
      </Button>
      <p className="text-xs text-muted-foreground">
        We email a confirmation link first. No data is released or erased until you confirm the
        address and a member of our compliance desk verifies your identity.
      </p>
    </div>
  );
};

export default DataRightsRequest;
