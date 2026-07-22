import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackCTA } from "@/lib/analytics";
import { getPhonePlaceholder } from "@/lib/phonePlaceholder";
import { inferCountryFromBrowser } from "@/lib/inferCountry";
import { z } from "zod";
import Turnstile from "@/components/Turnstile";

interface PrivateTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROFESSION_OPTIONS = [
  "Interior Designer",
  "Architect",
  "Property Developer",
  "Private Client / Collector",
  "Hospitality / F&B",
  "Press / Media",
  "Other",
] as const;

const tourSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Max 255 characters"),
  phone: z.string().trim().max(30, "Max 30 characters"),
  profession: z.string().trim().min(1, "Please select your profession").max(100, "Max 100 characters"),
  company: z.string().trim().max(150, "Max 150 characters").optional(),
  preferredDate: z.string().trim().max(100, "Max 100 characters").optional(),
  message: z.string().trim().max(2000, "Max 2000 characters").optional(),
});

const PrivateTourDialog = ({ open, onOpenChange }: PrivateTourDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [interacted, setInteracted] = useState(false);
  const [phonePlaceholder] = useState(() => getPhonePlaceholder("Singapore"));
  // Honeypot (bots fill hidden fields) + timing trap (bots submit instantly)
  const [website, setWebsite] = useState("");
  const [mountedAt] = useState(() => Date.now());

  const EMPTY_FORM = { name: "", email: "", phone: "", profession: "", company: "", preferredDate: "", message: "" };
  const [formData, setFormData] = useState(EMPTY_FORM);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {

    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Honeypot: silently drop if hidden field is filled
    if (website.trim() !== "") {
      toast({ title: "Request Sent", description: "Our concierge will contact you shortly to confirm your appointment." });
      onOpenChange(false);
      return;
    }
    // Timing trap: reject sub-3s submissions (humans can't fill this fast)
    if (Date.now() - mountedAt < 3000) {
      toast({ title: "Please review your request", description: "Take a moment to complete the form, then submit again.", variant: "destructive" });
      return;
    }


    const result = tourSchema.safeParse(formData);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(i => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }

    if (!turnstileToken) {
      toast({ title: "Verification required", description: "Please complete the bot check before submitting.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Compose a message that meets send-inquiry min-length (10 chars)
      // and surfaces preferred date/time to the concierge inbox + inquiries log.
      const parts: string[] = ["Private tour request."];
      parts.push(`Profession: ${result.data.profession}.`);
      if (result.data.company) parts.push(`Company / Firm: ${result.data.company}.`);
      if (result.data.preferredDate) parts.push(`Preferred date/time: ${result.data.preferredDate}.`);
      if (result.data.message) parts.push(result.data.message);
      const composedMessage = parts.join("\n\n");


      const { error } = await supabase.functions.invoke("send-inquiry", {
        body: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          message: composedMessage,
          turnstileToken,
          subject: "Request a Private Tour",
          source: "contact_form",
        },
      });

      if (error) throw error;

      trackCTA.bookAppointment("Private Tour Dialog");

      toast({ title: "Request Sent", description: "Our concierge will contact you shortly to confirm your appointment." });
      onOpenChange(false);
      setFormData(EMPTY_FORM);
    } catch (err: any) {
      console.error("Private tour request failed:", err);
      toast({ title: "Error", description: "Failed to send request. Please try again or email us directly.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-2xl w-[95vw] max-h-[85vh] md:max-h-[90vh] overflow-y-auto p-0 border border-border bg-background rounded-xl"
        aria-describedby={undefined}
      >
        <VisuallyHidden><DialogTitle>Request a Private Tour</DialogTitle></VisuallyHidden>

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
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl md:text-2xl text-foreground text-center">
              Request a Private Tour
            </h2>
          </div>
          <p className="font-body text-xs md:text-sm text-muted-foreground text-center mb-6 md:mb-8">
            Visit our Singapore showroom by appointment
          </p>

          <div className="space-y-5">
            {/* Honeypot: hidden from humans, tempting to bots */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="name" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Name<span className="text-destructive">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-0 py-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px] ${errors.name ? "border-destructive" : ""}`}
                placeholder="Your full name"
              />
              {errors.name && <p className="font-body text-[10px] text-destructive mt-1">{errors.name}</p>}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
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
                  placeholder="your@email.com"
                />
                {errors.email && <p className="font-body text-[10px] text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={phonePlaceholder}
                  className={`w-full px-0 py-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px] placeholder:text-muted-foreground/50 ${errors.phone ? "border-destructive" : ""}`}
                />
                {errors.phone && <p className="font-body text-[10px] text-destructive mt-1">{errors.phone}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="preferredDate" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Preferred Date / Time
              </label>
              <input
                id="preferredDate"
                type="text"
                value={formData.preferredDate}
                onChange={handleChange}
                className="w-full px-0 py-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
                placeholder="e.g. Next Tuesday, 2pm"
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Message
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={handleChange}
                rows={3}
                className="w-full px-0 py-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors resize-y text-[16px] placeholder:text-muted-foreground/60"
                placeholder="Tell us what you would like to see..."
              />
            </div>

            <div className="flex flex-col items-center gap-4 pt-2">
              {interacted && <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />}
              <button
                type="submit"
                disabled={isSubmitting || !turnstileToken}
                className="w-full md:w-auto px-10 py-4 bg-background text-foreground font-body text-sm uppercase tracking-[0.2em] border border-[hsl(var(--accent))] rounded-full shadow-[0_0_8px_hsl(var(--accent)/0.3)] hover:shadow-[0_0_14px_hsl(var(--accent)/0.5)] transition-all duration-300 whitespace-nowrap text-center cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Request Private Tour"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PrivateTourDialog;
