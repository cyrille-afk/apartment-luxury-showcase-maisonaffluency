import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import thierryLemaireImg from "@/assets/designers/thierry-lemaire.jpg";
import jeanMichelFrankImg from "@/assets/designers/jean-michel-frank.jpg";
import herveVanDerStraetenImg from "@/assets/designers/herve-van-der-straeten.jpg";
import nathalieZieglerImg from "@/assets/designers/nathalie-ziegler.jpg";
import atelierDemichelisImg from "@/assets/designers/atelier-demichelis.jpg";
import bertrandDeMaistreImg from "@/assets/designers/bertrand-de-maistre.jpg";
import hamreiImg from "@/assets/designers/hamrei.jpg";
import atelierFevrierImg from "@/assets/designers/atelier-fevrier.jpg";
import apparatusStudioImg from "@/assets/designers/apparatus-studio.jpg";

const featuredDesigners = [
  {
    id: "thierry-lemaire",
    name: "Thierry Lemaire",
    specialty: "Sculptural Furniture & Limited Editions",
    image: thierryLemaireImg,
    biography: "Thierry Lemaire is a French designer known for his sculptural approach to furniture design. His pieces blend fine craftsmanship with contemporary aesthetics, creating limited edition works that are as much art as they are functional objects. His Orsay Centre Table exemplifies his signature style of elegant forms with unexpected details.",
    notableWorks: "Orsay Centre Table, Sculptural Console Series",
    philosophy: "Each piece is a unique statement that transforms everyday furniture into collectible design objects."
  },
  {
    id: "jean-michel-frank",
    name: "Jean-Michel Frank & Adolphe Chanaux",
    specialty: "Modernist Furniture & Interior Design",
    image: jeanMichelFrankImg,
    biography: "Jean-Michel Frank (1895-1941) was a French interior designer known for his minimalist and refined approach to luxury. Working alongside craftsman Adolphe Chanaux, Frank created iconic pieces that defined 1930s modernism. His work emphasized pure forms, exceptional materials, and understated elegance.",
    notableWorks: "Stool 1934, Coffee Table Soleil 1930",
    philosophy: "True luxury lies in the quality of materials and the purity of form, not in ostentatious decoration."
  },
  {
    id: "herve-van-der-straeten",
    name: "Hervé van der Straeten",
    specialty: "Bronze Sculpture & Lighting Design",
    image: herveVanDerStraetenImg,
    biography: "Hervé van der Straeten is a renowned French designer and sculptor who began his career as a jewelry designer for haute couture houses. His transition to furniture and lighting brought his expertise in bronze work to larger scale. His chandeliers and furniture pieces are characterized by their organic forms and masterful metalwork.",
    notableWorks: "Mic Mac Chandelier, Bronze Console Series, Sculptural Mirrors",
    philosophy: "I work with bronze as a jeweler works with precious metals—creating pieces that capture light and movement."
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    specialty: "Bespoke Glass Art & Chandeliers",
    image: nathalieZieglerImg,
    biography: "Nathalie Ziegler is a French glass artist known for her custom chandeliers and glass sculptures that blur the line between functional lighting and fine art. Her Saint Just Custom Glass Chandelier showcases her ability to manipulate glass into dramatic, ethereal forms that transform spaces with light and color.",
    notableWorks: "Saint Just Custom Glass Chandelier, Gold Leaves+Glass Snake Vase, Sculptural Glass Series",
    philosophy: "Glass is alive—it captures and transforms light, creating an ever-changing dialogue with its environment."
  },
  {
    id: "atelier-demichelis",
    name: "Atelier Demichelis",
    specialty: "Limited Edition Lighting & Artisan Craftsmanship",
    image: atelierDemichelisImg,
    biography: "Atelier Demichelis is a contemporary design studio specializing in limited edition lighting fixtures. Each piece is meticulously handcrafted, combining traditional techniques with innovative design. Their Bud Table Lamp represents their commitment to creating functional art objects with exceptional attention to detail.",
    notableWorks: "Limited Edition Bud Table Lamp, Artisan Lighting Collection",
    philosophy: "We create lighting that elevates everyday moments into experiences of beauty and contemplation."
  },
  {
    id: "bertrand-de-maistre",
    name: "Bertrand de Maistre",
    specialty: "Contemporary Furniture Design",
    image: bertrandDeMaistreImg,
    biography: "Bertrand de Maistre is a French designer known for his poetic approach to furniture design. His Lyrical Desk demonstrates his ability to create pieces that are both functional and emotionally resonant, with flowing lines and thoughtful proportions that inspire creativity and contemplation.",
    notableWorks: "Lyrical Desk, Contemporary Furniture Series",
    philosophy: "Furniture should not just serve the body, but also nourish the soul and inspire the mind."
  },
  {
    id: "hamrei",
    name: "Hamrei",
    specialty: "Whimsical Furniture & Collectible Design",
    image: hamreiImg,
    biography: "Hamrei brings a playful yet sophisticated approach to contemporary design. Their Pépé Chair showcases their signature style of combining comfort with unexpected visual delight. Each piece demonstrates a mastery of form and craftsmanship while maintaining a sense of joy and personality.",
    notableWorks: "Pépé Chair, Whimsical Furniture Collection",
    philosophy: "Design should bring joy and surprise to daily life while maintaining the highest standards of craftsmanship."
  },
  {
    id: "atelier-fevrier",
    name: "Atelier Fevrier",
    specialty: "Hand-knotted Rugs & Textile Art",
    image: atelierFevrierImg,
    biography: "Atelier Fevrier is a textile studio dedicated to the ancient art of hand-knotted rug making. Their Ricky Rug exemplifies their commitment to traditional techniques combined with contemporary design sensibilities. Each rug is a labor of love, taking months to complete with meticulous attention to texture, color, and pattern.",
    notableWorks: "Hand-knotted Ricky Rug, Custom Textile Collection",
    philosophy: "We honor ancient textile traditions while creating works that speak to contemporary spaces and sensibilities."
  },
  {
    id: "apparatus-studio",
    name: "Apparatus Studio",
    specialty: "Contemporary Lighting & Industrial Design",
    image: apparatusStudioImg,
    biography: "Apparatus Studio is a New York-based design studio founded by Gabriel Hendifar and Jeremy Anderson. Known for their sculptural approach to lighting and furniture, their work combines industrial materials with refined aesthetics. The Metronome Reading Floor Lamp showcases their ability to create pieces that are both functional and sculptural.",
    notableWorks: "Metronome Reading Floor Lamp, Sculptural Lighting Series",
    philosophy: "We create objects that exist at the intersection of art, design, and architecture—pieces that define and enhance the spaces they inhabit."
  }
];

const FeaturedDesigners = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section 
      ref={ref}
      className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-background"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-center"
        >
          <p className="mb-2 md:mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
            THE ARTISANS
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground mb-4">
            Featured Designers & Makers
          </h2>
          <p className="text-base md:text-lg text-muted-foreground font-body max-w-3xl mx-auto">
            Discover the visionary designers and artisans whose exceptional work defines Maison Affluency. Each brings their unique perspective and masterful craftsmanship to create pieces that transcend ordinary furniture.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="w-full space-y-4">
            {featuredDesigners.map((designer, index) => (
              <AccordionItem 
                key={designer.id} 
                value={designer.id}
                className="border border-border/40 rounded-lg px-6 bg-card/30 hover:bg-card/50 transition-colors duration-300"
              >
                <AccordionTrigger className="hover:no-underline py-6">
                  <div className="flex items-center gap-4 md:gap-6 text-left w-full">
                    <img 
                      src={designer.image} 
                      alt={designer.name}
                      className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover ring-2 ring-border/40 flex-shrink-0"
                    />
                    <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                      <h3 className="text-xl md:text-2xl font-serif text-foreground">
                        {designer.name}
                      </h3>
                      <p className="text-sm md:text-base text-primary font-body italic">
                        {designer.specialty}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-6">
                  <div className="space-y-4 text-muted-foreground font-body">
                    <p className="text-sm md:text-base leading-relaxed">
                      {designer.biography}
                    </p>
                    
                    <div className="pt-2">
                      <h4 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
                        Notable Works
                      </h4>
                      <p className="text-sm md:text-base">
                        {designer.notableWorks}
                      </p>
                    </div>
                    
                    <div className="pt-2 border-t border-border/30 mt-4">
                      <p className="text-sm md:text-base italic leading-relaxed text-foreground/80">
                        "{designer.philosophy}"
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedDesigners;
