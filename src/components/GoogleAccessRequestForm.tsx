import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Turnstile from "@/components/Turnstile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { googleAccessInquiry, googleAccessRequestSchema } from "@/lib/googleAccessRequest";

export function GoogleAccessRequestForm() {
  const id = useId();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (sent) return <div role="status" className="space-y-2 border-t border-border pt-4 text-sm text-foreground">
    <p className="font-display">Your Trade access request has been received.</p>
    <p className="text-muted-foreground">Our team will review your request. Google sign-in and Trade access remain subject to approval.</p>
  </div>;

  return <form className="space-y-3 border-t border-border pt-4" onSubmit={async event => {
    event.preventDefault();
    if (sending) return;
    setError("");
    const parsed = googleAccessRequestSchema.safeParse({ name, email });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check your details."); return; }
    if (!user && !token) { setError("Please complete the security check."); return; }
    setSending(true);
    try {
      const { data, error: submitError } = await supabase.functions.invoke("send-inquiry", {
        body: { ...googleAccessInquiry(parsed.data), ...(token ? { turnstileToken: token } : {}) },
      });
      if (submitError || data?.error) throw new Error("Request failed");
      setSent(true);
    } catch {
      setError("We couldn't submit your request. Please try again, or email trade@maisonaffluency.com.");
      setToken(""); setAttempt(value => value + 1);
    } finally { setSending(false); }
  }}>
    <h3 className="font-display text-base text-foreground">Request Trade Access</h3>
    <div>
      <label htmlFor={`${id}-name`} className="mb-1 block text-sm text-foreground">Name</label>
      <Input id={`${id}-name`} autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={sending} />
    </div>
    <div>
      <label htmlFor={`${id}-email`} className="mb-1 block text-sm text-foreground">Google email address</label>
      <Input id={`${id}-email`} type="email" autoComplete="email" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} disabled={sending} />
    </div>
    {!user && <Turnstile key={attempt} onVerify={setToken} onExpire={() => setToken("")} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" variant="outline" className="w-full" disabled={sending || (!user && !token)}>{sending ? "Submitting…" : "Submit Access Request"}</Button>
  </form>;
}