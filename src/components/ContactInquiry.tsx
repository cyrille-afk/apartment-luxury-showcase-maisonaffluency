import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackCTA } from "@/lib/analytics";
import { inferCountryFromBrowser } from "@/lib/inferCountry";
import { getPhonePlaceholder } from "@/lib/phonePlaceholder";
import { z } from "zod";

const inquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
  firm: z.string().trim().max(200, "Max 200 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Max 255 characters"),
  phone: z.string().trim().max(30, "Max 30 characters"),
  message: z.string().trim().min(1, "Message is required").max(2000, "Max 2000 characters"),
});

const ContactInquiry = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    firm: "",
    email: "",
    phone: "",
    message: ""
  });
  // Phone placeholder reflects the visitor's likely region (e.g. "+44 …" for UK)
  // so the form doesn't read as Singapore-only. Falls back to a multi-region hint.
  const [phonePlaceholder] = useState(() => getPhonePlaceholder(inferCountryFromBrowser()));

  // Prefill the message field from URL params (e.g. /contact?subject=Bespoke%20inquiry&message=...)
  // Used by product pages to seed a "Bespoke inquiry" referencing the specific item.
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const message = params.get("message");
    const subject = params.get("subject");
    if (!message && !subject) return;
    setFormData((prev) => {
      if (prev.message.trim()) return prev; // don't clobber if user already typed
      const composed = subject && message
        ? `${subject}\n\n${message}`
        : (message || subject || "");
      return { ...prev, message: composed };
    });
  }, [location.search]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = inquirySchema.safeParse(formData);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-inquiry", {
        body: result.data
      });

      if (error) throw error;

      // Track successful submission in Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'generate_lead', {
          event_category: 'Contact',
          event_label: 'Contact Inquiry Form',
          value: 1,
        });
      }

      toast({
        title: "Inquiry Sent",
        description: "Thank you for your inquiry. We will be in touch shortly."
      });

      setFormData({
        name: "",
        firm: "",
        email: "",
        phone: "",
        message: ""
      });
    } catch (error: any) {
      console.error("Error sending inquiry:", error);
      toast({
        title: "Error",
        description: "Failed to send inquiry. Please try again or email us directly.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" ref={ref} className="py-12 px-4 md:py-24 md:px-12 lg:px-20 bg-muted/30 scroll-mt-24">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <p className="mb-3 font-body text-sm uppercase tracking-[0.3em] text-primary">
            Professional Inquiries
          </p>
          <h2 className="mb-6 font-display text-4xl text-foreground md:text-5xl">
            Visit Us By Appointment
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-4">
            1 Grange Garden, Singapore 249631
          </p>
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto text-justify">
            For architects, interior designers, and design connoisseurs interested
            in detailed and custom specifications, material sourcing, and/or collaborative opportunities.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Name
              </label>
              <Input
                id="name"
                placeholder="Your full name"
                className={`border-border bg-background font-body rounded-lg ${errors.name ? "border-destructive" : ""}`}
                value={formData.name}
                onChange={handleInputChange}
              />
              {errors.name && <p className="font-body text-[10px] text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="firm" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Firm / Studio
              </label>
              <Input
                id="firm"
                placeholder="Company name"
                className={`border-border bg-background font-body rounded-lg ${errors.firm ? "border-destructive" : ""}`}
                value={formData.firm}
                onChange={handleInputChange}
              />
              {errors.firm && <p className="font-body text-[10px] text-destructive mt-1">{errors.firm}</p>}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="email" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                className={`border-border bg-background font-body rounded-lg ${errors.email ? "border-destructive" : ""}`}
                value={formData.email}
                onChange={handleInputChange}
              />
              {errors.email && <p className="font-body text-[10px] text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Phone
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder={phonePlaceholder}
                className={`border-border bg-background font-body rounded-lg ${errors.phone ? "border-destructive" : ""}`}
                value={formData.phone}
                onChange={handleInputChange}
              />
              {errors.phone && <p className="font-body text-[10px] text-destructive mt-1">{errors.phone}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="message" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
              Message
            </label>
            <Textarea
              id="message"
              placeholder="Please share details about your inquiry..."
              className={`min-h-[150px] border-border bg-background font-body rounded-lg ${errors.message ? "border-destructive" : ""}`}
              value={formData.message}
              onChange={handleInputChange}
            />
            {errors.message && <p className="font-body text-[10px] text-destructive mt-1">{errors.message}</p>}
          </div>

          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="bg-white px-12 py-6 font-body text-sm uppercase tracking-widest text-foreground transition-all hover:bg-white/90 disabled:opacity-50 border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] rounded-full"
            >
              {isSubmitting ? "Sending..." : "Submit Inquiry"}
            </Button>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 border-t border-border pt-12 text-center"
        >
          <p className="font-body text-sm uppercase tracking-wider text-muted-foreground">
            For immediate inquiries
          </p>
          <a
            href="mailto:concierge@myaffluency.com"
            className="mt-2 inline-block font-body text-lg text-primary hover:text-primary/80"
            onClick={() => trackCTA.email("Contact Section")}
          >
            concierge@myaffluency.com
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactInquiry;
