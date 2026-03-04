import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";

const philosophyPoints = [{
  title: "Dedicated Client Advisor",
  subtitle: "Tailored Advice and True Partnership",
  content: "Maison Affluency nurture one-on-one relationships with its clients offering personalised and tailored advice on each project. From access to confidential sourcing, design collaborations and curation of artworks, our curating team offers a solid partnership"
}, {
  title: "Custom Requests",
  subtitle: "From inspiration to customisation",
  content: "Let us use our global connections to specialist workshops and renowned designers to help you find the best solutions"
}, {
  title: "Samples & Swatches",
  subtitle: "A comprehensive Material Library",
  content: "Every material speaks to authenticity and craftsmanship. Natural stone, hand-woven textiles, solid brass fixtures, and hand-painted finishes create a tactile richness that can't be replicated with synthetic alternatives. Access a comprehensive material library featuring a vast, curated selection of items or Request the ones you truly desire"
}, {
  title: "Consolidated Insured Shipping",
  subtitle: "Maximising time whilst minimising frictions",
  content: "Let us help you navigate the many pitfalls of the freight world by recommending the most appropriate partners with full insurance coverage"
}];

const DesignDetails = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
    isCertified: false
  });
  const [phoneError, setPhoneError] = useState("");
  const { toast } = useToast();

  const validatePhone = (phone: string) => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (phone && digitsOnly.length !== 8) {
      return "Please enter a valid 8-digit Singapore phone number";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const phoneValidation = validatePhone(formData.phone);
    if (phoneValidation) {
      setPhoneError(phoneValidation);
      return;
    }
    
    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-inquiry', {
        body: {
          name: formData.name,
          email: formData.email,
          company: formData.company,
          phone: formData.phone,
          message: `Trade Program Inquiry:\n\n${formData.message}`,
          subject: "Trade Program Application"
        }
      });

      if (error) throw error;

      // Track Trade Program submission in Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'generate_lead', {
          event_category: 'Trade Program',
          event_label: 'Trade Program Application',
          value: 1,
        });
      }

      toast({
        title: "Application Submitted",
        description: "Thank you for your interest. We'll be in touch shortly.",
      });
      
      setFormData({ name: "", email: "", company: "", phone: "", message: "", isCertified: false });
      setIsOpen(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section ref={ref} className="py-12 px-4 md:py-24 md:px-12 lg:px-20 bg-background">
        <div className="mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.2 }}>
            {/* Professional imagery banner with overlaid CTA */}
            <div className="mb-10 overflow-hidden rounded-sm relative">
              <img
                src={cloudinaryUrl("IMG_2040_clunsw", { width: 1200, quality: "auto:good", crop: "fill" })}
                alt="Luxury furniture styled in a professionally designed interior at Maison Affluency showroom"
                className="w-full h-64 sm:h-80 md:h-[28rem] object-cover object-center"
                loading="lazy"
                decoding="async"
              />
              {/* Title & subtitle at top */}
              <div className="absolute top-4 left-0 right-0 flex flex-col items-center text-center px-4">
                <h2 className="font-display text-2xl sm:text-3xl md:text-4xl text-white drop-shadow-lg">
                  Trade Program
                </h2>
                <p className="font-body text-xs sm:text-sm text-white mt-1 drop-shadow">
                  Join &amp; Enjoy Exclusive Benefits
                </p>
              </div>
              {/* Button centred lower */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-12 left-0 right-0 flex justify-center">
                <button 
                  onClick={() => setIsOpen(true)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 text-white px-5 py-2.5 font-serif text-xs uppercase tracking-wider rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] font-bold"
                >
                  <Briefcase className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
                  Join Now
                </button>
              </div>
            </div>

            <div className="mb-10 flex items-center justify-center pl-8 pr-8">
              <h3 className="font-display text-xl text-foreground md:text-2xl text-left underline underline-offset-4 decoration-1">Our Guiding Principles</h3>
            </div>
            
            <Accordion type="single" collapsible className="space-y-4">
              {philosophyPoints.map((item, index) => <AccordionItem key={index} value={`philosophy-${index}`} className="border border-border bg-card px-8 py-2 transition-colors hover:bg-muted/30">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div>
                      <div className="font-display text-xl text-foreground md:text-2xl">
                        {item.title}
                      </div>
                      <div className="mt-1 font-body text-sm text-muted-foreground">
                        {item.subtitle}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 pb-2">
                    <p className="font-body leading-relaxed text-muted-foreground">
                      {item.content}
                    </p>
                  </AccordionContent>
                </AccordionItem>)}
            </Accordion>
          </motion.div>
        </div>
      </section>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Welcome to Your Trade Account</DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">
              We look forward to partnering with you!
              <br />
              <span className="text-sm mt-2 block">If you have any questions, please contact us at: <a href="mailto:concierge@myaffluency.com" className="text-primary hover:underline">concierge@myaffluency.com</a></span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company / Studio</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Your company or studio name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                  +65
                </span>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d\s]/g, '');
                    setFormData({ ...formData, phone: value });
                    if (phoneError) setPhoneError(validatePhone(value));
                  }}
                  onBlur={() => setPhoneError(validatePhone(formData.phone))}
                  placeholder="XXXX XXXX"
                  className={`rounded-l-none ${phoneError ? 'border-destructive' : ''}`}
                  maxLength={9}
                />
              </div>
              {phoneError && (
                <p className="text-xs text-destructive">{phoneError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Tell us about your practice *</Label>
              <Textarea
                id="message"
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Describe your design practice and how we can collaborate..."
                rows={4}
              />
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="certified"
                checked={formData.isCertified}
                onCheckedChange={(checked) => setFormData({ ...formData, isCertified: checked === true })}
                required
              />
              <Label htmlFor="certified" className="text-sm leading-relaxed cursor-pointer">
                I Certify that I am an Architect or an Interior Designer
              </Label>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !formData.isCertified}
              className="w-full bg-foreground text-background py-3 font-body text-sm uppercase tracking-wider hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DesignDetails;