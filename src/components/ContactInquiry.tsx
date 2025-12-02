import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
const ContactInquiry = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  return <section ref={ref} className="py-24 px-6 md:px-12 lg:px-20 bg-muted/30">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{
        opacity: 0,
        y: 30
      }} animate={isInView ? {
        opacity: 1,
        y: 0
      } : {}} transition={{
        duration: 0.8
      }} className="text-center mb-12">
          <p className="mb-3 font-body text-sm uppercase tracking-[0.3em] text-primary">
            Professional Inquiries
          </p>
          <h2 className="mb-6 font-display text-4xl text-foreground md:text-5xl">Book an appointment</h2>
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
            For architects, interior designers, and industry professionals interested
            in detailed specifications, material sources, or collaboration opportunities.
          </p>
        </motion.div>

        <motion.form initial={{
        opacity: 0,
        y: 30
      }} animate={isInView ? {
        opacity: 1,
        y: 0
      } : {}} transition={{
        duration: 0.8,
        delay: 0.2
      }} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Name
              </label>
              <Input id="name" placeholder="Your full name" className="border-border bg-background font-body" />
            </div>
            <div>
              <label htmlFor="firm" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Firm / Studio
              </label>
              <Input id="firm" placeholder="Company name" className="border-border bg-background font-body" />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="email" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Email
              </label>
              <Input id="email" type="email" placeholder="your@email.com" className="border-border bg-background font-body" />
            </div>
            <div>
              <label htmlFor="phone" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
                Phone
              </label>
              <Input id="phone" type="tel" placeholder="+65 XXXX XXXX" className="border-border bg-background font-body" />
            </div>
          </div>

          <div>
            <label htmlFor="message" className="mb-2 block font-body text-sm uppercase tracking-wider text-foreground">
              Message
            </label>
            <Textarea id="message" placeholder="Please share details about your inquiry..." className="min-h-[150px] border-border bg-background font-body" />
          </div>

          <div className="flex justify-center pt-4">
            <Button type="submit" size="lg" className="bg-primary px-12 py-6 font-body text-sm uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90">
              Submit Inquiry
            </Button>
          </div>
        </motion.form>

        <motion.div initial={{
        opacity: 0
      }} animate={isInView ? {
        opacity: 1
      } : {}} transition={{
        duration: 0.8,
        delay: 0.4
      }} className="mt-16 border-t border-border pt-12 text-center">
          <p className="font-body text-sm uppercase tracking-wider text-muted-foreground">
            For immediate inquiries
          </p>
          <a href="mailto:contact@luxuryresidence.com" className="mt-2 inline-block font-body text-lg text-primary hover:text-primary/80">
            concierge@myaffluency.com
          </a>
        </motion.div>
      </div>
    </section>;
};
export default ContactInquiry;