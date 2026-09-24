import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check } from "lucide-react";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{6,24}$/;

export function GuestContactCapture({ guestKey, onDone }: { guestKey: string; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    const isEmail = EMAIL_RE.test(v);
    const isPhone = !isEmail && PHONE_RE.test(v);
    if (!isEmail && !isPhone) { setState("error"); return; }
    setState("saving");
    const { data, error } = await supabase.rpc("guest_inquiry_add_contact", {
      _guest_key: guestKey,
      _email: isEmail ? v : null,
      _whatsapp: isPhone ? v : null,
    } as any);
    if (error || !data) { setState("error"); return; }
    setState("done");
    sessionStorage.setItem("cn_portal:contact_captured", "1");
    setTimeout(onDone, 2500);
  };

  return (
    <div className="max-w-[85%] rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <p className="text-sm text-foreground leading-relaxed">
        To send you the custom specification sheets, pricing tiers, or logistics timeline for this piece, please provide your email address or WhatsApp handle.
      </p>
      {state === "done" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4" /> Thank you — our director will be in touch shortly.
        </p>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => { setValue(e.target.value); if (state === "error") setState("idle"); }}
            placeholder="name@studio.com or +65 9123 4567"
            maxLength={254}
            className="h-9 text-base sm:text-sm"
            aria-label="Email address or WhatsApp number"
          />
          <Button type="submit" size="sm" disabled={state === "saving" || !value.trim()}>
            {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </form>
      )}
      {state === "error" && (
        <p className="text-xs text-destructive">Please enter a valid email or WhatsApp number (with country code).</p>
      )}
    </div>
  );
}
