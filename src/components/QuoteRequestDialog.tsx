import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackEngagement } from "@/lib/analytics";
import { inferSupportedCountry } from "@/lib/inferCountry";
import { getPhonePlaceholder } from "@/lib/phonePlaceholder";

const COUNTRIES = [
  "Singapore", "Australia", "Canada", "China", "France", "Germany", "Hong Kong",
  "India", "Indonesia", "Italy", "Japan", "Malaysia", "Netherlands", "New Zealand",
  "Philippines", "South Korea", "Spain", "Switzerland", "Taiwan", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam", "Other"
];

type ShippingOption = "white-glove" | "front-door" | "not-needed";

interface QuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill context: product name, designer, etc. */
  productName?: string;
  designerName?: string;
}

const QuoteRequestDialog = ({ open, onOpenChange, productName, designerName }: QuoteRequestDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    country: inferSupportedCountry(COUNTRIES, "Singapore"),
    city: "",
    shipping: "not-needed" as ShippingOption,
    message: "",
    consent: false,
    newsletter: false,
  });

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.firstName || !form.lastName || !form.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!form.consent) {
      toast({
        title: "Consent Required",
        description: "Please agree to the data processing terms.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const body = {
        name: `${form.firstName} ${form.lastName}`,
        email: form.email,
        phone: form.phone,
        firm: "",
        message: [
          productName ? `Product: ${productName}` : "",
          designerName ? `Designer: ${designerName}` : "",
          `Country: ${form.country}`,
          form.city ? `City: ${form.city}` : "",
          `Shipping: ${form.shipping === "white-glove" ? "White Glove Delivery" : form.shipping === "front-door" ? "Front Door Delivery" : "Not Needed"}`,
          form.message ? `\nMessage: ${form.message}` : "",
          form.newsletter ? "\n[Opted in for newsletter]" : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };

      // Send to backend (fire-and-forget, don't block mailto)
      supabase.functions.invoke("send-inquiry", { body }).catch(() => {});

      // Open mailto with form data
      const subject = encodeURIComponent(
        `Quote Request${productName ? ` – ${productName}` : ''}${designerName ? ` by ${designerName}` : ''}`
      );
      const mailBody = encodeURIComponent(
        [
          `Name: ${form.firstName} ${form.lastName}`,
          `Email: ${form.email}`,
          `Phone: ${form.phone}`,
          `Country: ${form.country}`,
          form.city ? `City: ${form.city}` : '',
          `Shipping: ${form.shipping === "white-glove" ? "White Glove Delivery" : form.shipping === "front-door" ? "Front Door Delivery" : "Not Needed"}`,
          productName ? `Product: ${productName}` : '',
          designerName ? `Designer: ${designerName}` : '',
          form.message ? `\nMessage: ${form.message}` : '',
        ].filter(Boolean).join('\n')
      );
      window.location.href = `mailto:concierge@myaffluency.com?subject=${subject}&body=${mailBody}`;

      // Track quote request in GA4
      trackEngagement.quoteRequest(productName || "Unknown", designerName || "Unknown");

      toast({
        title: "Quote Request Sent",
        description: "Our team will get back to you within a day.",
      });

      onOpenChange(false);
      setForm({
        email: "", firstName: "", lastName: "", phone: "",
        country: inferSupportedCountry(COUNTRIES, "Singapore"), city: "", shipping: "not-needed",
        message: "", consent: false, newsletter: false,
      });
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-3xl w-[95vw] max-h-[85vh] md:max-h-[90vh] overflow-y-auto p-0 border border-border bg-background rounded-xl"
        aria-describedby={undefined}
      >
        <VisuallyHidden><DialogTitle>Request a Quote</DialogTitle></VisuallyHidden>

        {/* Close button — sticky so it stays visible when scrolling */}
        <div className="sticky top-0 z-20 flex justify-end pt-2 pr-2 md:pt-3 md:pr-3">
          <button
            onClick={() => onOpenChange(false)}
            className="p-3 md:p-2 text-muted-foreground hover:text-foreground transition-colors bg-background/90 backdrop-blur-sm rounded-full shadow-sm border border-border/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 md:px-12 pb-8 md:pb-12 -mt-6 md:-mt-4">
          {/* Header */}
          <h2 className="font-display text-xl md:text-3xl text-foreground text-center">
            Request A Quote Or Customisation
          </h2>
          <p className="font-body text-xs md:text-sm text-muted-foreground text-center mt-1.5 md:mt-2 mb-6 md:mb-10">
            Our team will get back to you within a day
          </p>

          {/* Row 1: Email, First Name, Last Name, Phone */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <div>
              <label className="font-body text-sm text-foreground">
                Email address<span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
              />
            </div>
            <div>
              <label className="font-body text-sm text-foreground">
                First Name<span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
              />
            </div>
            <div>
              <label className="font-body text-sm text-foreground">
                Last Name<span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
              />
            </div>
            <div>
              <label className="font-body text-sm text-foreground">
                Phone Number<span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder={getPhonePlaceholder(form.country)}
                className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px] placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Row 2: Country, City */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <div>
              <label className="font-body text-sm text-foreground">Country</label>
              <select
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors appearance-none cursor-pointer text-[16px]"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-body text-sm text-foreground">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
              />
            </div>
          </div>

          {/* Shipping */}
          <div className="mb-6 md:mb-8">
            <p className="font-body text-sm text-foreground mb-3">
              Would you like a quote for shipping?
            </p>
            <div className="flex flex-wrap items-center gap-6">
              {([
                { value: "white-glove" as const, label: "White Glove Delivery", hasInfo: true },
                { value: "front-door" as const, label: "Front Door Delivery", hasInfo: true },
                { value: "not-needed" as const, label: "Not Needed", hasInfo: false },
              ]).map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer font-body text-sm text-foreground">
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      form.shipping === opt.value ? "border-foreground" : "border-border"
                    }`}
                    onClick={() => update("shipping", opt.value)}
                  >
                    {form.shipping === opt.value && (
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground" />
                    )}
                  </span>
                  <span onClick={() => update("shipping", opt.value)}>{opt.label}</span>
                  {opt.hasInfo && (
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="mb-6 md:mb-8">
            <p className="font-body text-sm text-foreground mb-1">
              Anything to add regarding your request?
            </p>
            <textarea
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              placeholder="Please specify dimensions & finish required if non standard."
              rows={3}
              className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-muted-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground transition-colors resize-y text-[16px]"
            />
          </div>

          {/* Consent + Submit */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update("consent", e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-foreground"
                />
                <span className="font-body text-xs text-foreground leading-relaxed">
                  I agree to allow Maison Affluency to store and process data for the purpose of this quote.
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.newsletter}
                  onChange={(e) => update("newsletter", e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-foreground"
                />
                <span className="font-body text-xs text-foreground leading-relaxed">
                  Yes, I'd love to receive news and personalized invitations from Maison Affluency.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-10 py-4 bg-background text-foreground font-body text-sm uppercase tracking-[0.2em] border border-[hsl(var(--accent))] rounded-full shadow-[0_0_8px_hsl(var(--accent)/0.3)] hover:shadow-[0_0_14px_hsl(var(--accent)/0.5)] transition-all duration-300 whitespace-nowrap text-center cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Submit Inquiry"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteRequestDialog;
