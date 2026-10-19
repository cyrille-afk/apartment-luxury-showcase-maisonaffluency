import { useEffect, useRef, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Turnstile from "@/components/Turnstile";
import { supabase } from "@/integrations/supabase/client";
import { forgetPrivateClient, normalizeClientEmail, rememberPrivateClient, unforgetPrivateClient } from "@/lib/returningPrivateClient";
import { CODE_LIFETIME_MS, RESEND_WAIT_MS, formatCountdown } from "@/lib/verificationCodeTiming";

export default function PrivateClientWelcome({ email, profile, locallyReturning }: {
  email: string; profile: string | null; locallyReturning: boolean;
}) {
  const normalized = normalizeClientEmail(email);
  const [verified, setVerified] = useState<{email: string; returning: boolean} | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [challenge, setChallenge] = useState<{email: string; id: string; sentAt: number} | null>(null);
  const [code, setCode] = useState("");
  const [botToken, setBotToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [botKey, setBotKey] = useState(0);
  const [intent, setIntent] = useState<"recognize" | "forget" | "optin">("recognize");
  const [forgotten, setForgotten] = useState<{email: string; server: boolean} | null>(null);
  const [optedIn, setOptedIn] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const currentEmail = useRef(normalized);
  currentEmail.current = normalized;

  useEffect(() => {
    if (!challenge) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [challenge]);

  useEffect(() => {
    setExpanded(false); setChallenge(null); setCode(""); setError(""); setBotToken(""); setBusy(false);
    if (!normalized || profile !== "private") return;
    let cancelled = false;
    void supabase.auth.getSession().then(async ({data}) => {
      if (cancelled || normalizeClientEmail(data.session?.user.email) !== normalized) return;
      const {data: result, error: failure} = await supabase.functions.invoke("private-client-recognition", {body:{action:"check",email:normalized,sessionId:sessionId()}});
      if (!cancelled && !failure && result?.verified) setVerified({email:normalized,returning:result.returning === true});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [normalized, profile]);

  if (!normalized || profile !== "private") return null;

  async function startForget() {
    forgetPrivateClient(normalized);
    setVerified(null); setChallenge(null); setCode(""); setError("");
    setIntent("forget"); setForgotten({email: normalized, server: false}); setExpanded(true);
    const {data} = await supabase.auth.getSession();
    if (normalizeClientEmail(data.session?.user.email) !== normalized) return;
    const {data: r, error: f} = await supabase.functions.invoke("private-client-recognition", {body:{action:"check",intent:"forget",email:normalized}});
    if (!f && r?.forgotten) setForgotten({email: normalized, server: true});
    else setError("Could not delete saved data. Please try again.");
  }

  const isForgotten = forgotten?.email === normalized;
  if (isForgotten && forgotten.server) return <p role="status" className="mt-3 font-body text-sm text-muted-foreground">
    Recognition is off for this email and your saved recognition data has been deleted. Your basket and orders are unaffected.
  </p>;
  const optOutLink = <Button type="button" variant="link" className="h-auto p-0 text-xs text-muted-foreground" onClick={()=>void startForget()}>
    Don’t recognise me — delete my saved data
  </Button>;
  const returning = !isForgotten && (locallyReturning || (verified?.email === normalized && verified.returning));
  if (returning) return <div className="mt-3 space-y-1"><p role="status" className="font-body text-sm leading-relaxed text-foreground">Welcome back. It’s a pleasure to see you again.</p>{optOutLink}</div>;
  if (!isForgotten && verified?.email === normalized) return <div className="mt-3 space-y-1"><p role="status" className="font-body text-sm text-muted-foreground">Email verified.</p>{optOutLink}</div>;

  const expiresIn = challenge ? challenge.sentAt + CODE_LIFETIME_MS - now : 0;
  const resendIn = challenge ? challenge.sentAt + RESEND_WAIT_MS - now : 0;
  const expired = !!challenge && expiresIn <= 0;

  async function submit(action: "request" | "verify") {
    if (busy) return;
    const target = normalized;
    setBusy(true); setError("");
    try {
      const {data,error: failure} = await supabase.functions.invoke("private-client-recognition", {body:{
        action,email:target,sessionId:sessionId(),intent,
        ...(action === "request" ? {turnstileToken:botToken} : {challengeId:challenge?.id,code}),
      }});
      if (currentEmail.current !== target) return;
      if (failure || data?.error) {
        let message = data?.error;
        if (!message && failure && "context" in failure && failure.context instanceof Response) {
          message = (await failure.context.clone().json().catch(() => null))?.error;
        }
        throw new Error(message || "Could not verify your email. Please try again.");
      }
      if (action === "request") { setChallenge({email:target,id:data.challengeId,sentAt:Date.now()}); setNow(Date.now()); setCode(""); }
      else if (data?.forgotten) { setForgotten({email:target,server:true}); setCode(""); setChallenge(null); }
      else if (data?.verified) {
        setVerified({email:target,returning:data.returning === true});
        if (data.returning) rememberPrivateClient(target,"private");
        setCode(""); setChallenge(null);
      }
    } catch (e) {
      if (currentEmail.current === target) setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (currentEmail.current === target) {
        setBusy(false);
        if (action === "request") { setBotToken(""); setBotKey(k=>k+1); }
      }
    }
  }

  const requestNew = () => { setChallenge(null); setCode(""); setError(""); };

  return <div className="mt-3 font-body text-sm">
    {isForgotten && <p role="status" className="mb-2 text-muted-foreground">This device no longer recognises you. To also delete data saved with us, confirm your email with a code.</p>}
    {!expanded ? <Button type="button" variant="link" className="h-auto p-0 text-muted-foreground" onClick={()=>setExpanded(true)}>
      <Mail className="mr-2 h-4 w-4" /> Verify email
    </Button> : <div className="space-y-3">
      {challenge?.email === normalized ? <>
        <p className="text-muted-foreground">Enter the 6-digit code sent to your email. Each code can be used once.</p>
        <p role="status" aria-live="polite" className={expired ? "text-destructive" : "text-muted-foreground"}>
          {expired ? "This code has expired. Please request a new one." : `Code expires in ${formatCountdown(expiresIn)}.`}
        </p>
        <Input aria-label="Email verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={expired} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={busy || expired || code.length !== 6} onClick={()=>void submit("verify")}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify
          </Button>
          <Button type="button" variant="link" className="h-auto p-0" disabled={busy || (!expired && resendIn > 0)} onClick={requestNew}>
            {!expired && resendIn > 0 ? `Request a new code in ${formatCountdown(resendIn)}` : "Request a new code"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Didn’t receive it? Check your spam folder. Requesting a new code replaces the previous one.</p>
      </> : <>
        <p className="text-muted-foreground">We’ll email you a 6-digit code, valid for 10 minutes.</p>
        <Turnstile key={botKey} onVerify={setBotToken} onExpire={()=>setBotToken("")} />
        <Button type="button" variant="outline" disabled={busy || !botToken} onClick={()=>void submit("request")}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {intent === "forget" ? "Send code to delete my data" : "Send verification code"}
        </Button>
      </>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>}
    {!isForgotten && <div className="mt-1">{optOutLink}</div>}
  </div>;
}

function sessionId(): string | undefined {
  try { return localStorage.getItem("ma_cart_session_id") ?? undefined; } catch { return undefined; }
}
