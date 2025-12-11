import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ContactInquiry = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    firm: "",
    email: "",
    phone: "",
    message: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name, email, and message.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-inquiry", {
        body: formData
      });

      if (error) throw error;

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
    <section id="contact" ref={ref} className="py-24 px-6 md:px-12 lg:px-20 bg-muted/30">
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
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
            For architects, interior designers, and design connoisseurs interested
            in detailed and custom specifications, material sources, or collaboration opportunities.
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
                className="border-border bg-background font-body"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label htmlFor="firm" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Firm / Studio
              </label>
              <Input
                id="firm"
                placeholder="Company name"
                className="border-border bg-background font-body"
                value={formData.firm}
                onChange={handleInputChange}
              />
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
                className="border-border bg-background font-body"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Phone
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+65 XXXX XXXX"
                className="border-border bg-background font-body"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="message" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
              Message
            </label>
            <Textarea
              id="message"
              placeholder="Please share details about your inquiry..."
              className="min-h-[150px] border-border bg-background font-body"
              value={formData.message}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="bg-primary px-12 py-6 font-body text-sm uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
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
          >
            concierge@myaffluency.com
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactInquiry;
