import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { Instagram, Search, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import thierryLemaireImg from "@/assets/designers/thierry-lemaire.jpg";
import herveVanDerStraetenImg from "@/assets/designers/herve-van-der-straeten.png";
import nathalieZieglerImg from "@/assets/designers/nathalie-ziegler.jpg";
import atelierDemichelisImg from "@/assets/designers/atelier-demichelis.jpg";
import brunoDeMaistreImg from "@/assets/designers/bruno-de-maistre.jpg";
import hamreiImg from "@/assets/designers/hamrei.jpg";
import atelierFevrierImg from "@/assets/designers/atelier-fevrier.jpg";
import apparatusStudioImg from "@/assets/designers/apparatus-studio.jpg";
import oliviaCognetImg from "@/assets/designers/olivia-cognet.jpg";
import jeremyMaxwellWintrebertImg from "@/assets/designers/jeremy-maxwell-wintrebert.jpg";
import alexanderLamontImg from "@/assets/designers/alexander-lamont.jpg";
import leoSentouImg from "@/assets/designers/leo-sentou.jpg";
import jeanMichelFrankImg from "@/assets/designers/jean-michel-frank.jpg";
import kikoLopezImg from "@/assets/designers/kiko-lopez.jpg";

const featuredDesigners = [
  {
    id: "alexander-lamont",
    name: "Alexander Lamont",
    specialty: "Artisan Furniture & Luxury Craftsmanship",
    image: alexanderLamontImg,
    biography:
      "Alexander Lamont is a British designer based in Bangkok whose eponymous brand has become synonymous with exceptional craftsmanship and the innovative use of traditional materials. Working with bronze, shagreen, straw marquetry, lacquer and gold leaf, his pieces marry East and West influences with a distinct sculptural presence. Winner of multiple UNESCO Awards for Excellence in Craftsmanship, his work graces prestigious interiors worldwide.",
    notableWorks: "Hammered Bowls (UNESCO Award), Brancusi Spiral Table, River Ledge Credenza, Agata Cabinet, Lune Mirrors",
    philosophy: "Objects have power: they connect us to our most intimate selves and to the people, places, stories and memories of our lives.",
    links: [
      { type: "Instagram", url: "https://instagram.com/alexanderlamont" },
      { type: "Curators' choice" },
    ],
  },
  {
    id: "apparatus-studio",
    name: "Apparatus Studio",
    founder: "Gabriel Hendifar",
    specialty: "Contemporary Lighting & Industrial Design",
    image: apparatusStudioImg,
    biography:
      "Apparatus Studio is a New York-based design studio founded by Gabriel Hendifar and Jeremy Anderson. Known for their sculptural approach to lighting and furniture, their work combines industrial materials with refined aesthetics. The Metronome Reading Floor Lamp showcases their ability to create pieces that are both functional and sculptural.",
    notableWorks: "Metronome Reading Floor Lamp, Sculptural Lighting Series",
    philosophy:
      "We create objects that exist at the intersection of art, design, and architecture—pieces that define and enhance the spaces they inhabit.",
    links: [
      { type: "Instagram", url: "https://instagram.com/apparatusstudio" },
      { type: "Curators' choice" },
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
      { type: "Instagram", url: "https://instagram.com/atelier_demichelis" },
      { type: "Curators' choice" },
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
      { type: "Instagram", url: "https://instagram.com/atelierfevrier" },
      { type: "Curators' choice" },
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
      { type: "Instagram", url: "https://instagram.com/bruno_de_maistre_bdm" },
      { type: "Curators' choice" },
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
      { type: "Instagram", url: "https://instagram.com/hamrei" },
      { type: "Curators' choice" },
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
      { type: "Instagram", url: "https://instagram.com/hervevanderstraetengalerie" },
      { type: "Curators' choice" },
    ],
  },
  {
    id: "jeremy-maxwell-wintrebert",
    name: "Jeremy Maxwell Wintrebert",
    specialty: "Freehand Glassblown Lights & Sculptures",
    image: jeremyMaxwellWintrebertImg,
    biography:
      "Born in Paris and raised in Western Africa, Jeremy Maxwell Wintrebert is a French-American glass artist who established JMW Studio in 2015 beneath the historic Viaduc des Arts in Paris. After apprenticing with masters including Dale Chihuly in Seattle and Davide Salvadore in Venice, he developed his signature freehand glassblowing technique. Winner of the 2019 Prix Bettencourt pour l'Intelligence de la Main, his work graces the collections of the Victoria & Albert Museum, Palais de Tokyo, and MusVerre.",
    notableWorks: "Cloud Pendants, Autumn Light Pendants, Space Nugget Side Table, Sonde Chandelier, Dark Matter Installation",
    philosophy: "Freehand glassblowing is an emotional conversation between hands, head, heart, and material. You start with a small seed and help it grow—it is a humble process.",
    links: [
      { type: "Instagram", url: "https://www.instagram.com/jmw_studio" },
      { type: "Curators' choice" },
    ],
  },
  {
    id: "jean-michel-frank",
    name: "Jean-Michel Frank",
    specialty: "Minimalist Luxury & Art Deco Pioneer",
    image: jeanMichelFrankImg,
    biography:
      "Jean-Michel Frank (1895–1941) was a legendary French interior decorator and furniture designer who pioneered the luxurious minimalist aesthetic of the Art Deco era. His work emphasized refined simplicity, using the finest materials—parchment, shagreen, straw marquetry, and bronze—to create pieces of understated elegance. Collaborating with artists like Alberto Giacometti and Christian Bérard, Frank created iconic designs that continue to influence contemporary luxury interiors.",
    notableWorks: "Table Soleil 1930, Stool 1934 (with Adolphe Chanaux), Parchment-covered furniture, Shagreen desks",
    philosophy: "Simplicity is the ultimate sophistication—luxury lies in the quality of materials and the perfection of form.",
    links: [
      { type: "Curators' choice" },
    ],
  },
  {
    id: "kiko-lopez",
    name: "Kiko Lopez",
    specialty: "Artisan Mirrors & Reflective Surfaces",
    image: kikoLopezImg,
    biography:
      "Kiko Lopez is a French master mirror artisan renowned for creating extraordinary reflective surfaces that blur the line between functional object and sculptural art. Using traditional techniques combined with innovative approaches to glass and metal, his mirrors transform spaces with their unique textural qualities and light-capturing properties. His Silver Glass Hammer Mirror exemplifies his distinctive style of treating mirrors as artistic statements.",
    notableWorks: "Silver Glass Hammer Mirror, Antiqued Mirror Collection, Sculptural Reflective Surfaces",
    philosophy: "A mirror is not merely a reflection—it is a portal that transforms light and space into something magical.",
    links: [
      { type: "Instagram", url: "https://instagram.com/kikolopez_mirrors" },
      { type: "Curators' choice" },
    ],
  },
  {
    id: "leo-sentou",
    name: "Leo Sentou",
    specialty: "Contemporary Classicist Furniture Design",
    image: leoSentouImg,
    biography:
      "French designer Leo Sentou is a contemporary classicist whose debut capsule collection pays homage to the elegance and sophistication of eighteenth-century French decorative arts. His pieces are rooted in tradition yet unequivocally modern, reducing classical forms to their essential shapes while elevating them with a refined palette of limed oak, wrought iron, bronze, mohair, linen and lacquer.",
    notableWorks: "Fauteuil L.D (oval bergère), Side Table L.A, Chair G.J",
    philosophy: "Elegance means elimination. An interior ought to tell a story, with a balance between old and new, light and dark.",
    links: [
      { type: "Instagram", url: "https://www.instagram.com/leosentou" },
      { type: "Curators' choice" },
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
      { type: "Instagram", url: "https://instagram.com/nathaliezieglerpasqua" },
      { type: "Curators' choice" },
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
      { type: "Instagram", url: "https://www.instagram.com/olivia_cognet" },
      { type: "Curators' choice" },
    ],
  },
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
      { type: "Instagram", url: "https://www.instagram.com/thierrylemaire_/?hl=en" },
      { type: "Curators' choice" },
    ],
  },
];

const FeaturedDesigners = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [selectedImage, setSelectedImage] = useState<{ name: string; image: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDesigners = useMemo(() => {
    if (!searchQuery.trim()) return featuredDesigners;
    const query = searchQuery.toLowerCase();
    return featuredDesigners.filter(
      (designer) =>
        designer.name.toLowerCase().includes(query) ||
        designer.specialty.toLowerCase().includes(query)
    );
  }, [searchQuery]);

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
            Designers & Makers
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
          className="mb-8"
        >
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-card/50 border-border/40 focus:border-primary/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              {filteredDesigners.length} designer{filteredDesigners.length !== 1 ? 's' : ''} found
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="w-full space-y-4">
            {filteredDesigners.map((designer, index) => (
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
      </div>
    </section>
  );
};

export default FeaturedDesigners;
