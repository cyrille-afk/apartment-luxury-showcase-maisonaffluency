import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import bedroomImage from "@/assets/master-suite.jpg";
import diningImage from "@/assets/dining-room.jpg";
import boudoirImage from "@/assets/boudoir.jpg";

const galleryItems = [
  {
    image: bedroomImage,
    title: "Master Suite",
    description: "Serene retreat with collectible lighting, bespoke furniture and handcrafted rugs "
  },
  {
    image: diningImage,
    title: "Dining Room",
    description: "Elegant entertaining space with dreamy Tuscan vista inviting you to travel"
  },
  {
    image: boudoirImage,
    title: "Sophisticated Boudoir",
    description: "Bespoke furniture and unique artworks over white cherry blossom"
  }
];

const Gallery = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-center"
        >
          <p className="mb-2 md:mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
            OUR GALLERY
          </p>
          <h2 className="font-display text-xl leading-relaxed md:text-3xl lg:text-4xl text-foreground text-left md:text-justify px-2">
            From Thierry Lemaire limited edition Orsay Table, Hamrei whimsical Pepe chairs, Nathalie Ziegler, Emmanuel Levet Stenne and Hervé van der Straeten exquisite Chandeliers to Pierre Bonnefille Bronze Painting, Maison Affluency is a unique venue where design and art congregate.
          </h2>
        </motion.div>
        
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {galleryItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
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
    </section>
  );
};

export default Gallery;
