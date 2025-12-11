import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Instagram } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import CuratingTeam from "@/components/CuratingTeam";
import thierryLemaireImg from "@/assets/designers/thierry-lemaire.jpg";

import herveVanDerStraetenImg from "@/assets/designers/herve-van-der-straeten.jpg";
import nathalieZieglerImg from "@/assets/designers/nathalie-ziegler.jpg";
import atelierDemichelisImg from "@/assets/designers/atelier-demichelis.jpg";
import brunoDeMaistreImg from "@/assets/designers/bruno-de-maistre.jpg";
import hamreiImg from "@/assets/designers/hamrei.jpg";
import atelierFevrierImg from "@/assets/designers/atelier-fevrier.jpg";
import apparatusStudioImg from "@/assets/designers/apparatus-studio.jpg";
import oliviaCognetImg from "@/assets/designers/olivia-cognet.jpg";
import jeremyMaxwellWintrebertImg from "@/assets/designers/jeremy-maxwell-wintrebert.jpg";

const featuredDesigners = [
  {
    id: "thierry-lemaire",
    name: "Thierry Lemaire",
    specialty: "Sculptural Furniture & Limited Editions",
    image: thierryLemaireImg,
    biography:
      "A French Star Architect, Interior Designer and Designer, Thierry Lemaire is known for his sculptural approach to furniture design. His pieces blend fine craftsmanship with contemporary aesthetics, creating limited edition works that are as much art as they are functional objects. His Orsay Centre Table exemplifies his signature style of elegant forms with unexpected details.",
    notableWorks:
      "Orsay Mds Coffee Table in Alabastrino travertine and Onyx Ocean. \nLimited and numbered edition (12 copies).",
    philosophy: "Each piece is a unique statement that transforms everyday furniture into collectible design objects.",
    links: [
      { type: "Curators' choice" },
      { type: "Instagram", url: "https://www.instagram.com/thierrylemaire_/?hl=en" },
    ],
  },
  {
    id: "atelier-fevrier",
    name: "Atelier Fevrier",
    specialty: "Hand-knotted Rugs & Textile Art",
    image: atelierFevrierImg,
    biography:
      "Atelier Fevrier is a textile studio dedicated to the ancient art of hand-knotted rug making. Their Ricky Rug exemplifies their commitment to traditional techniques combined with contemporary design sensibilities. Each rug is a labor of love, taking months to complete with meticulous attention to texture, color, and pattern.",
    notableWorks: "Hand-knotted Ricky Rug, Custom Textile Collection",
    philosophy:
      "We honor ancient textile traditions while creating works that speak to contemporary spaces and sensibilities.",
    links: [
      { type: "Website", url: "https://atelierfevrier.com" },
      { type: "Instagram", url: "https://instagram.com/atelier_fevrier" },
    ],
  },
  {
    id: "herve-van-der-straeten",
    name: "Hervé van der Straeten",
    specialty: "Bronze Sculpture & Lighting Design",
    image: herveVanDerStraetenImg,
    biography:
      "Hervé van der Straeten is a renowned French designer and sculptor who began his career as a jewelry designer for haute couture houses. His transition to furniture and lighting brought his expertise in bronze work to larger scale. His chandeliers and furniture pieces are characterized by their organic forms and masterful metalwork.",
    notableWorks: "Mic Mac Chandelier, Bronze Console Series, Sculptural Mirrors",
    philosophy:
      "I work with bronze as a jeweler works with precious metals—creating pieces that capture light and movement.",
    links: [
      { type: "Website", url: "https://hervevanderstraeten.com" },
      { type: "Instagram", url: "https://instagram.com/hervevanderstraeten" },
    ],
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    specialty: "Bespoke Glass Art & Chandeliers",
    image: nathalieZieglerImg,
    biography:
      "Nathalie Ziegler is a French glass artist known for her custom chandeliers and glass sculptures that blur the line between functional lighting and fine art. Her Saint Just Custom Glass Chandelier showcases her ability to manipulate glass into dramatic, ethereal forms that transform spaces with light and color.",
    notableWorks: "Saint Just Custom Glass Chandelier, Gold Leaves+Glass Snake Vase, Sculptural Glass Series",
    philosophy:
      "Glass is alive—it captures and transforms light, creating an ever-changing dialogue with its environment.",
    links: [
      { type: "Website", url: "https://nathalie-ziegler.com" },
      { type: "Instagram", url: "https://instagram.com/nathalie_ziegler_glass" },
    ],
  },
  {
    id: "atelier-demichelis",
    name: "Atelier Demichelis",
    founder: "Laura Demichelis",
    specialty: "Limited Edition Lighting & Artisan Craftsmanship",
    image: atelierDemichelisImg,
    biography:
      "Atelier Demichelis is a contemporary design studio specializing in limited edition lighting fixtures. Each piece is meticulously handcrafted, combining traditional techniques with innovative design. Their Bud Table Lamp represents their commitment to creating functional art objects with exceptional attention to detail.",
    notableWorks: "Limited Edition Bud Table Lamp, Artisan Lighting Collection",
    philosophy: "We create lighting that elevates everyday moments into experiences of beauty and contemplation.",
    links: [
      { type: "Website", url: "https://atelierdemichelis.com" },
      { type: "Instagram", url: "https://instagram.com/atelier_demichelis" },
    ],
  },
  {
    id: "bruno-de-maistre",
    name: "Bruno de Maistre",
    specialty: "Contemporary Furniture Design",
    image: brunoDeMaistreImg,
    biography:
      "Bruno de Maistre is a French designer known for his poetic approach to furniture design. His Lyrical Desk demonstrates his ability to create pieces that are both functional and emotionally resonant, with flowing lines and thoughtful proportions that inspire creativity and contemplation.",
    notableWorks: "Lyrical Desk, Contemporary Furniture Series",
    philosophy: "Furniture should not just serve the body, but also nourish the soul and inspire the mind.",
    links: [
      { type: "Website", url: "https://brunodemaistre.fr" },
      { type: "Instagram", url: "https://instagram.com/bruno_de_maistre" },
    ],
  },
  {
    id: "hamrei",
    name: "Hamrei",
    specialty: "Whimsical Furniture & Collectible Design",
    image: hamreiImg,
    biography:
      "Hamrei brings a playful yet sophisticated approach to contemporary design. Their Pépé Chair showcases their signature style of combining comfort with unexpected visual delight. Each piece demonstrates a mastery of form and craftsmanship while maintaining a sense of joy and personality.",
    notableWorks: "Pépé Chair, Whimsical Furniture Collection",
    philosophy:
      "Design should bring joy and surprise to daily life while maintaining the highest standards of craftsmanship.",
    links: [
      { type: "Website", url: "https://hamrei.design" },
      { type: "Instagram", url: "https://instagram.com/hamrei_design" },
    ],
  },
  {
    id: "apparatus-studio",
    name: "Apparatus Studio",
    specialty: "Contemporary Lighting & Industrial Design",
    image: apparatusStudioImg,
    biography:
      "Apparatus Studio is a New York-based design studio founded by Gabriel Hendifar and Jeremy Anderson. Known for their sculptural approach to lighting and furniture, their work combines industrial materials with refined aesthetics. The Metronome Reading Floor Lamp showcases their ability to create pieces that are both functional and sculptural.",
    notableWorks: "Metronome Reading Floor Lamp, Sculptural Lighting Series",
    philosophy:
      "We create objects that exist at the intersection of art, design, and architecture—pieces that define and enhance the spaces they inhabit.",
    links: [
      { type: "Website", url: "https://apparatusstudio.com" },
      { type: "Instagram", url: "https://instagram.com/apparatus_studio" },
    ],
  },
  {
    id: "olivia-cognet",
    name: "Olivia Cognet",
    specialty: "Ceramic Artist & Designer",
    image: oliviaCognetImg,

    biography:
      "Olivia Cognet is a French ceramic artist that draws her inspiration from the South of France where she grew up and and was nourished by the brilliant masters from the school of Vallauris, from Picasso to Roger Capron. Her Vallauris floor lamp in a custom blue glazed ceramic, is a testimony of her constant search for the balance between art & design. ",
    notableWorks: "Bas Relief sculptures, Vallauris floor lamp",
    philosophy: "Blending modern brutalism with a graphic feminine sensibility.",
    links: [
      { type: "Website", url: "https://www.oliviacognet.com" },
      { type: "Instagram", url: "https://www.instagram.com/olivia_cognet" },
    ],
  },
  {
    id: "jeremy-maxwell-wintrebert",
    name: "Jeremy Maxwell Wintrebert",
    specialty: "Freehand glassblown lights and sculptures",
    image: jeremyMaxwellWintrebertImg,

    biography: " ",
    notableWorks: "",
    philosophy: "",
    links: [
      { type: "Website", url: "https://jeremymaxwellwintrebert.com" },
      { type: "Instagram", url: "https://www.instagram.com/jmw_studio" },
    ],
  },
];

const FeaturedDesigners = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [selectedImage, setSelectedImage] = useState<{ name: string; image: string } | null>(null);

  return (
    <section ref={ref} className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-background">
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
            Discover the visionary designers and artisans whose exceptional work defines Maison Affluency. Each brings
            their unique perspective and masterful craftsmanship to create pieces that transcend ordinary furniture.
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
                <AccordionTrigger className="hover:no-underline py-6 group">
                  <div className="flex items-center gap-4 md:gap-6 text-left w-full">
                    <Dialog>
                      <DialogTrigger asChild>
                        <div
                          className="relative flex-shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage({ name: designer.name, image: designer.image });
                          }}
                        >
                          <img
                            src={designer.image}
                            alt={designer.name}
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover ring-2 ring-border/40 transition-all duration-300 hover:ring-primary/60 hover:scale-105 hover:shadow-lg"
                          />
                          <div className="absolute inset-0 rounded-full bg-primary/0 hover:bg-primary/10 transition-all duration-300 flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-primary opacity-0 hover:opacity-100 transition-opacity duration-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                              />
                            </svg>
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <div className="relative w-full h-full">
                          <img
                            src={selectedImage?.image || designer.image}
                            alt={selectedImage?.name || designer.name}
                            className="w-full h-auto rounded-lg object-contain"
                          />
                          <p className="text-center mt-4 text-lg font-serif text-foreground">
                            {designer.founder || selectedImage?.name || designer.name}
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                      <h3 className="text-xl md:text-2xl font-serif text-foreground transition-colors duration-300 group-hover:text-primary">
                        {designer.name}
                      </h3>
                      <p className="text-sm md:text-base text-primary font-body italic transition-opacity duration-300 group-hover:opacity-80">
                        {designer.specialty}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-6">
                  <div className="space-y-4 text-muted-foreground font-body">
                    <p className="text-sm md:text-base leading-relaxed">{designer.biography}</p>

                    <div className="pt-2">
                      <h4 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
                        Notable Works
                      </h4>
                      <p className="text-sm md:text-base">{designer.notableWorks}</p>
                    </div>

                    <div className="pt-2 border-t border-border/30 mt-4">
                      <p className="text-sm md:text-base italic leading-relaxed text-foreground/80 mb-4">
                        "{designer.philosophy}"
                      </p>

                      {designer.links && designer.links.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-4">
                          {designer.links.map((link, idx) => (
                            link.url ? (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors duration-300 border border-primary/20 hover:border-primary/40"
                                aria-label={link.type}
                              >
                                {link.type === "Instagram" ? <Instagram size={16} /> : <span>{link.type}</span>}
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            ) : (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body bg-primary/10 text-primary rounded-md border border-primary/20"
                              >
                                {link.type}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        <CuratingTeam />
      </div>
    </section>
  );
};

export default FeaturedDesigners;
