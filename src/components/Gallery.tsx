import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import bedroomImage from "@/assets/master-suite.jpg";
import diningImage from "@/assets/dining-room.jpg";
import boudoirImage from "@/assets/boudoir.jpg";
import livingRoomImage from "@/assets/living-room-hero.jpg";
import bedroomAltImage from "@/assets/bedroom.jpg";

const galleryExperiences = [
  {
    experience: "Restful Retreat",
    subtitle: "Serene retreat with collectible lighting, bespoke furniture and handcrafted rugs",
    items: [
      {
        image: bedroomImage,
        title: "A Masterful Suite",
        description: "Serene retreat with collectible lighting, bespoke furniture and handcrafted rugs"
      },
      {
        image: bedroomAltImage,
        title: "Guest Bedroom",
        description: "Featuring Damien Langlois-Meurinne's sculptural Ooh La La Console, Hayman Editions' Carved Marble Marie Lamp, and Kiko Lopez' Silver Glass Hammer Mirror"
      }
    ]
  },
  {
    experience: "Social Gathering",
    subtitle: "Elegant spaces for entertaining and connection",
    items: [
      {
        image: livingRoomImage,
        title: "Living Room",
        description: "Sophisticated gathering space with designer furniture and artisan lighting"
      },
      {
        image: diningImage,
        title: "Dining Room",
        description: "Elegant entertaining space with dreamy Tuscan vista inviting you to travel"
      }
    ]
  },
  {
    experience: "Personal Sanctuary",
    subtitle: "Intimate spaces for reflection and creativity",
    items: [
      {
        image: boudoirImage,
        title: "Sophisticated Boudoir",
        description: "Bespoke furniture and unique artworks over white cherry blossom"
      }
    ]
  }
];
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
          <h2 className="text-xl leading-relaxed md:text-3xl text-foreground text-left px-2 lg:text-2xl md:text-justify font-serif">From Thierry Lemaire's limited edition Orsay centre Table, Nathalie Ziegler's and Hervé van der Straeten's mesmerising Chandeliers, to Hamrei's whimsical Pépé Chairs and Pierre Bonnefille's Bronze Painting, Maison Affluency Singapore is a unique venue where design and art congregate</h2>
        </motion.div>
        
        {galleryExperiences.map((section, sectionIndex) => (
          <div key={section.experience} className="mb-16 md:mb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: sectionIndex * 0.2 }}
              className="mb-8 md:mb-12"
            >
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif text-primary mb-2">
                {section.experience}
              </h3>
              <p className="text-sm md:text-base text-muted-foreground font-body italic">
                {section.subtitle}
              </p>
            </motion.div>
            
            <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: (sectionIndex * 0.2) + (index * 0.1) }}
                  className="group cursor-pointer"
                >
                  <div className="relative mb-4 md:mb-6 aspect-[4/5] overflow-hidden rounded-sm">
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                  
                  <h3 className="mb-2 font-display text-xl md:text-2xl text-foreground">
                    {item.title}
                  </h3>
                  <p className="font-body text-sm md:text-base leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>;
};
export default Gallery;