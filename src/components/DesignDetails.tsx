import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
const designersBrands = [{
  title: "Iksel Wallcoverings",
  subtitle: "Hand-Painted Murals",
  content: "The scenic decorative wallcoverings are custom Iksel and Pierre Frey panels, hand-painted by artisans in their London and Paris ateliers. Each crane, landscape and vista is meticulously rendered in mineral pigments on panels, creating an immersive landscape that transforms the living space into a serene sanctuary."
}, {
  title: "Thierry Lemaire",
  subtitle: "Sculptural Seating",
  content: "The organic, Tanganika-upholstered NIKO sofa is a bespoke piece from French designer Thierry Lemaire. Its undulating form challenges traditional furniture design while providing exceptional comfort. The sculptural quality makes it as much an art piece as functional seating."
}, {
  title: "Robicara SIRA Collection",
  subtitle: "Statement Furniture",
  content: "The vibrant credenza is from Robicara's SIRA collection, featuring sultry shagreen panelling, metal patinated finishes and brass detailing. Its bold yet classical allure provides a carefully calculated contrast to the muted palette, demonstrating confident use of accent pieces in luxury design."
}, {
  title: "Apparatus Studio",
  subtitle: "Lighting Design",
  content: "Custom lighting fixtures from New York's Apparatus Studio blend traditional craftsmanship with contemporary sensibility. The brass and glass compositions create ambient pools of light that enhance the space's intimate atmosphere."
}];
const philosophyPoints = [{
  title: "East Meets West",
  subtitle: "Cultural Fusion",
  content: "This residence embodies a sophisticated dialogue between Eastern and Western design philosophies. Asian artistic traditions—evident in the hand-painted murals and organic forms—are balanced with Western modernist principles of clean lines and functional elegance. The result is a space that honors both heritages without pastiche."
}, {
  title: "Art as Architecture",
  subtitle: "Integrated Aesthetics",
  content: "Rather than treating art as an afterthought, the design integrates artistic expression into the architectural fabric. The mural work isn't merely decorative; it defines spatial boundaries and influences the emotional tone of each room. Furniture pieces are selected for their sculptural merit, blurring the line between functional objects and art."
}, {
  title: "Material Authenticity",
  subtitle: "Craft & Quality",
  content: "Every material speaks to authenticity and craftsmanship. Natural stone, hand-woven textiles, solid brass fixtures, and hand-painted finishes create a tactile richness that can't be replicated with synthetic alternatives. The patina of quality materials improves with age, ensuring the design's longevity."
}, {
  title: "Unique Curation",
  subtitle: "Intentional Simplicity",
  content: "Maison Affluency philosophy celebrates the uniqueness and distinctive selection of exceptional pieces that define the space. Each piece is deliberately chosen and thoughtfully placed. Negative space is valued as highly as the objects themselves, allowing individual elements to be fully appreciated without visual competition."
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
        duration: 0.8
      }} className="mb-20">
          <p className="mb-3 font-body text-sm uppercase tracking-[0.3em] text-primary">
            Featured Designers
          </p>
          <h2 className="mb-12 font-display text-4xl text-foreground md:text-5xl">
            Artisans & Collaborators
          </h2>
          
          <Accordion type="single" collapsible className="space-y-4">
            {designersBrands.map((item, index) => <AccordionItem key={index} value={`designer-${index}`} className="border border-border bg-card px-8 py-2 transition-colors hover:bg-muted/30">
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
          <p className="mb-3 font-body text-sm uppercase tracking-[0.3em] text-secondary">
            Maison Affluency Philosophy
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