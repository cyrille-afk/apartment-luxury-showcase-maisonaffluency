import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  subtitle: "Distinctive Selection",
  content: "Let us help you navigate the many pitfalls of the freight world by recommending the most appropriate partners with full insurance coverage"
}];
const DesignDetails = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  return <section ref={ref} className="py-24 px-6 md:px-12 lg:px-20 bg-background">
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
          <p className="mb-3 font-body text-sm uppercase tracking-[0.3em] text-primary">
            TRADE PROGRAM
          </p>
          <h2 className="mb-12 font-display text-4xl text-foreground md:text-5xl">Our Guiding Principles</h2>
          
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
    </section>;
};
export default DesignDetails;