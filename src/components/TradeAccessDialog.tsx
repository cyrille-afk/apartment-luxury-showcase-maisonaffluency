import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { z } from "zod";
import Turnstile from "@/components/Turnstile";

interface TradeAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROFESSIONS = [
  "Interior Designer",
  "Architect",
  "Design Studio",
  "Hospitality / Developer",
  "Private Collector",
  "Other",
];

const schema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(120, "Max 120 characters"),
  profession: z.string().trim().min(1, "Please choose your profession"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Max 255 characters"),
});

const TradeAccessDialog = ({ open, onOpenChange }: TradeAccessDialogProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [interacted, setInteracted] = useState(false);
  const [website, setWebsite] = useState("");
  const [mountedAt] = useState(() => Date.now());

  const EMPTY = { businessName: "", profession: "", email: "" };
  const [formData, setFormData] = useState(EMPTY);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (website.trim() !== "") {
      onOpenChange(false);
      return;
    }
    if (Date.now() - mountedAt < 2500) {
      toast({ title: "Please review your details", description: "Take a moment to complete the form, then submit again.", variant: "destructive" });
      return;
    }

    const result = schema.safeParse(formData);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }

    if (!turnstileToken) {
      toast({ title: "Verification required", description: "Please complete the bot check before submitting.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const composedMessage = [
        "Trade access lead capture.",
        `Business: ${result.data.businessName}`,
        `Profession: ${result.data.profession}`,
      ].join("\n");

      await supabase.functions.invoke("send-inquiry", {
        body: {
          name: result.data.businessName,
          email: result.data.email,
          phone: "",
          message: composedMessage,
          turnstileToken,
          subject: "Trade Access — Lead Capture",
          source: "trade_lead",
        },
      });

      trackEvent("trade_lead_captured", { event_category: "CTA", event_label: "HeroTradeCTA" });

      toast({
        title: "Welcome",
        description: "Continue to complete your trade application.",
      });

      const params = new URLSearchParams({
        email: result.data.email,
        company: result.data.businessName,
      });
      onOpenChange(false);
      navigate(`/trade/register?${params.toString()}`);
    } catch (err) {
      console.error("Trade lead capture failed:", err);
      toast({ title: "Error", description: "Failed to send. Please try again or email us directly.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-0 border border-border bg-background rounded-xl"
        aria-describedby={undefined}
      >
        <VisuallyHidden><DialogTitle>Apply for Trade Access</DialogTitle></VisuallyHidden>

        <div className="sticky top-0 z-20 flex justify-end pt-2 pr-2 md:pt-3 md:pr-3">
          <button
            onClick={() => onOpenChange(false)}
            className="p-3 md:p-2 text-muted-foreground hover:text-foreground transition-colors bg-background/90 backdrop-blur-sm rounded-full shadow-sm border border-border/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onFocus={() => setInteracted(true)}
          onPointerDown={() => setInteracted(true)}
          className="px-5 md:px-10 pb-8 md:pb-10 -mt-6 md:-mt-4"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl md:text-2xl text-foreground text-center">
              Apply for Trade Access
            </h2>
          </div>
          <p className="font-body text-xs md:text-sm text-muted-foreground text-center mb-6 md:mb-8">
            Exclusive trade pricing • Dedicated account management • Custom sizing available
          </p>

          <div className="space-y-5">
            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor="website">Website</label>
              <input id="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            <div>
              <label htmlFor="businessName" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Business Name<span className="text-destructive">*</span>
              </label>
              <input
                id="businessName"
                type="text"
                value={formData.businessName}
                onChange={handleChange}
                className={`w-full px-0 py-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px] ${errors.businessName ? "border-destructive" : ""}`}
                placeholder="Your studio or firm"
              />
              {errors.businessName && <p className="font-body text-[10px] text-destructive mt-1">{errors.businessName}</p>}
            </div>

            <div>
              <label htmlFor="profession" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Profession<span className="text-destructive">*</span>
              </label>
              <select
                id="profession"
                value={formData.profession}
                onChange={handleChange}
                className={`w-full px-0 py-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px] ${errors.profession ? "border-destructive" : ""}`}
              >
                <option value="">Select your profession…</option>
                {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.profession && <p className="font-body text-[10px] text-destructive mt-1">{errors.profession}</p>}
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Email<span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-0 py-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px] ${errors.email ? "border-destructive" : ""}`}
                placeholder="you@studio.com"
              />
              {errors.email && <p className="font-body text-[10px] text-destructive mt-1">{errors.email}</p>}
            </div>

            <div className="flex flex-col items-center gap-4 pt-2">
              {interacted && <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />}
              <button
                type="submit"
                disabled={isSubmitting || !turnstileToken}
                className="w-full md:w-auto px-10 py-4 bg-background text-foreground font-body text-sm uppercase tracking-[0.2em] border border-[hsl(var(--accent))] rounded-full shadow-[0_0_8px_hsl(var(--accent)/0.3)] hover:shadow-[0_0_14px_hsl(var(--accent)/0.5)] transition-all duration-300 whitespace-nowrap text-center cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Sending…" : "Continue to Application"}
              </button>
              <p className="font-body text-[11px] text-muted-foreground text-center">
                We'll save your details and take you to the full trade application.
              </p>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TradeAccessDialog;
