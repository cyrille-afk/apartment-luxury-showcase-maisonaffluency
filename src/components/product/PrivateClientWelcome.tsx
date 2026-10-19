import { useEffect, useRef, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Turnstile from "@/components/Turnstile";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientEmail, rememberPrivateClient } from "@/lib/returningPrivateClient";

export default function PrivateClientWelcome({ email, profile, locallyReturning }: {
  email: string; profile: string | null; locallyReturning: boolean;
}) {
  const normalized = normalizeClientEmail(email);
  const [verified, setVerified] = useState<{email: string; returning: boolean} | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [challenge, setChallenge] = useState<{email: string; id: string} | null>(null);
  const [code, setCode] = useState("");
  const [botToken, setBotToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [botKey, setBotKey] = useState(0);
  const currentEmail = useRef(normalized);
  currentEmail.current = normalized;

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
  const returning = locallyReturning || (verified?.email === normalized && verified.returning);
  if (returning) return <p role="status" className="mt-3 font-body text-sm leading-relaxed text-foreground">Welcome back. It’s a pleasure to see you again.</p>;
  if (verified?.email === normalized) return <p role="status" className="mt-3 font-body text-sm text-muted-foreground">Email verified.</p>;

  async function submit(action: "request" | "verify") {
    if (busy) return;
    const target = normalized;
    setBusy(true); setError("");
    try {
      const {data,error: failure} = await supabase.functions.invoke("private-client-recognition", {body:{
        action,email:target,sessionId:sessionId(),
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
      if (action === "request") setChallenge({email:target,id:data.challengeId});
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

  return <div className="mt-3 font-body text-sm">
    {!expanded ? <Button type="button" variant="link" className="h-auto p-0 text-muted-foreground" onClick={()=>setExpanded(true)}>
      <Mail className="mr-2 h-4 w-4" /> Verify email
    </Button> : <div className="space-y-3">
      {challenge?.email === normalized ? <>
        <p className="text-muted-foreground">Enter the code sent to your email.</p>
        <Input aria-label="Email verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} />
        <Button type="button" variant="outline" disabled={busy || code.length !== 6} onClick={()=>void submit("verify")}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify
        </Button>
        <Button type="button" variant="link" disabled={busy} onClick={()=>{setChallenge(null);setCode("");setError("");}}>Send a new code</Button>
      </> : <>
        <Turnstile key={botKey} onVerify={setBotToken} onExpire={()=>setBotToken("")} />
        <Button type="button" variant="outline" disabled={busy || !botToken} onClick={()=>void submit("request")}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send verification code
        </Button>
      </>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>}
  </div>;
}

function sessionId(): string | undefined {
  try { return localStorage.getItem("ma_cart_session_id") ?? undefined; } catch { return undefined; }
}