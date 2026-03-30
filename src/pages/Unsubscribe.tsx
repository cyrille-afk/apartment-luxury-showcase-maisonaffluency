import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        const data = await res.json();
        if (!res.ok) { setStatus("invalid"); return; }
        if (data.valid === false && data.reason === "already_unsubscribed") { setStatus("already"); return; }
        if (data.valid) { setStatus("valid"); return; }
        setStatus("invalid");
      } catch { setStatus("error"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch { setStatus("error"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="font-display text-2xl text-foreground">Email Preferences</h1>
        {status === "loading" && <p className="font-body text-sm text-muted-foreground">Verifying...</p>}
        {status === "invalid" && <p className="font-body text-sm text-destructive">This unsubscribe link is invalid or has expired.</p>}
        {status === "already" && <p className="font-body text-sm text-muted-foreground">You have already been unsubscribed from our emails.</p>}
        {status === "success" && <p className="font-body text-sm text-muted-foreground">You have been successfully unsubscribed. You will no longer receive emails from us.</p>}
        {status === "error" && <p className="font-body text-sm text-destructive">Something went wrong. Please try again later.</p>}
        {status === "valid" && (
          <div className="space-y-4">
            <p className="font-body text-sm text-muted-foreground">Click the button below to unsubscribe from Maison Affluency emails.</p>
            <button onClick={handleUnsubscribe} className="px-6 py-3 rounded-full bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] hover:opacity-90 transition-opacity">
              Confirm Unsubscribe
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
