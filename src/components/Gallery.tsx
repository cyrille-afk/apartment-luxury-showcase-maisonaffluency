import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import bedroomImage from "@/assets/master-suite.jpg";
import diningImage from "@/assets/dining-room.jpg";
import boudoirImage from "@/assets/boudoir.jpg";
import livingRoomImage from "@/assets/living-room-hero.jpg";
import bedroomAltImage from "@/assets/bedroom-alt.jpg";
import bedroomThirdImage from "@/assets/bedroom-third.jpg";
import bespokeSofaImage from "@/assets/bespoke-sofa.jpg";
const galleryExperiences = [{
  experience: "Restful Retreat",
  subtitle: "Serene retreat with curated collectible items, bespoke furniture and handcrafted rugs",
  items: [{
    image: bedroomImage,
    title: "A Masterful Suite",
    description: "CC-Tapis Giudecca custom rug, Celso de Lemos' Silk Bed Cover, Hervé van der Straeten's Bronze MicMac Chandelier, Iksel's Brunelleschi Perspective Wallcover"
  }, {
    image: bedroomAltImage,
    title: "Unique by Design",
    description: "Adam Court's Villa Pedestal Nightstand, Atelier DeMichelis' Limited Edition Bud Table Lamp, Pinton 1867 Custom Rug, Peter Reed's Riyad Double Faced Throw and Cushion"
  }, {
    image: bedroomThirdImage,
    title: "Design Icons and Collectibles",
    description: "Damien Langlois-Meurinne's Ooh La La Console, Hayman Editions' Carved Marble Marie Lamp, Kiko Lopez' Silver Glass Hammer Mirror, oOumm Lyra Marble Candle"
  }]
}, {
  experience: "Social Gathering",
  subtitle: "Elegant spaces for entertaining and connection",
  items: [{
    image: bespokeSofaImage,
    title: "An Inviting Bespoke Sofa",
    description: "Thierry Lemaire's Niko 420 custom sofa, Atelier Février's Ricky custom rug, Poltrona Frau's Albero bookcase, Jindrich Halabala's lounge chair, Apparatus Studio's Median 3 Surface Alabaster lights, Alexander Lamont's Reef Vessels"
  }, {
    image: livingRoomImage,
    title: "A Sophisticated Living Room",
    description: "Thierry Lemaire Orsay Centre Table, Robicara's Sira Credenza, Jean-Michel Frank & Adolphe Chanaux' Stool 1934, Olivia Cognet's Valauris Lamp, Leo Sentou's AB armchair, Garnier & Linker lost-wax cast crystal centerpiece for Théorème Editions"
  }, {
    image: diningImage,
    title: "With Panoramic Cityscape Views",
    description: "Alinea Design Objects' Angelo M table paired with Eric Schmitt Studio's Chairie and Cazes&Conquet's Augusta dining chairs, Emanuelle Levet Stenne's Alabaster Pendant Light, Emmanuel Babled's Limited Edition Sculptured Book Cover from his emblematic Osmosi Series "
  }]
}, {
  experience: "Personal Sanctuary",
  subtitle: "Intimate spaces for reflection and creativity",
  items: [{
    image: boudoirImage,
    title: "A Sophisticated Boudoir",
    description: "Bertrand de Maistre's Lyrical Desk, Hamrei's Pépé Chair,  Made in Kira's Toshiro Lamp, Nathalie Ziegler's Saint Just Custom Glass Chandelier and Gold Leaves+Glass Snake Vase, Nika Zupanc's Stardust Loveseat, Apparatus Studio's Metronome Reading Floor Lamp "
  }]
}];
const Gallery = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  return <section ref={ref} className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{
        opacity: 0,
        y: 30
      }} animate={isInView ? {
        opacity: 1,
        y: 0
      } : {}} transition={{
        duration: 0.8
      }} className="mb-12 md:mb-16 text-center">
          <p className="mb-2 md:mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
            OUR GALLERY
          </p>
          <h2 className="text-xl leading-relaxed md:text-3xl text-foreground text-left px-2 md:text-justify font-serif lg:text-lg">From Thierry Lemaire's Orsay Mds Centre Table, Jean-Michel Frank Table Soleil 1930, Nathalie Ziegler's and Hervé van der Straeten's Chandeliers, to Hamrei's whimsical Chairs and Pierre Bonnefille's Bronze Painting, Maison Affluency Singapore is a uniquely curated venue where design and art congregate</h2>
        </motion.div>
        
        {galleryExperiences.map((section, sectionIndex) => <div key={section.experience} className="mb-16 md:mb-24">
            <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={isInView ? {
          opacity: 1,
          y: 0
        } : {}} transition={{
          duration: 0.6,
          delay: sectionIndex * 0.2
        }} className="mb-8 md:mb-12">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif text-primary mb-2">
                {section.experience}
              </h3>
              <p className="text-sm md:text-base text-muted-foreground font-body italic">
                {section.subtitle}
              </p>
            </motion.div>
            
            <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item, index) => <motion.div key={item.title} initial={{
            opacity: 0,
            y: 40
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: sectionIndex * 0.2 + index * 0.1
          }} className="group cursor-pointer">
                  <div className="relative mb-4 md:mb-6 aspect-[4/5] overflow-hidden rounded-sm">
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                  
                  <h3 className="mb-2 font-display text-xl md:text-2xl text-foreground">
                    {item.title}
                  </h3>
                  <p className="font-body text-sm md:text-base leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>)}
            </div>
          </div>)}
      </div>
    </section>;
};
export default Gallery;