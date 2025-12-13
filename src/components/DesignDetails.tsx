import { motion } from "framer-motion";
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
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <section ref={ref} className="py-24 px-6 md:px-12 lg:px-20 bg-background">
        <div className="mx-auto max-w-5xl">
          <motion.div initial={{
            opacity: 0,
            y: 30
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.8,
            delay: 0.2
          }}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="font-body text-sm uppercase tracking-[0.3em] text-primary">
                TRADE PROGRAM
              </p>
              <button 
                onClick={() => setIsOpen(true)}
                className="bg-foreground text-background px-4 py-2 font-body text-xs uppercase tracking-wider hover:bg-foreground/90 transition-colors sm:hidden"
              >
                Join Now
              </button>
            </div>
            <div className="mb-12 flex items-center justify-between">
              <h2 className="font-display text-4xl text-foreground md:text-5xl">Our Guiding Principles</h2>
              <button 
                onClick={() => setIsOpen(true)}
                className="hidden sm:block bg-foreground text-background px-6 py-3 font-body text-sm uppercase tracking-wider hover:bg-foreground/90 transition-colors"
              >
                Join Now
              </button>
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
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="XXXX XXXX"
                  className="rounded-l-none"
                />
              </div>
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