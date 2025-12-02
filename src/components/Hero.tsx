import { motion } from "framer-motion";
import heroImage from "@/assets/living-room-hero.jpg";

const Hero = () => {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Luxury living room with Asian-inspired murals and designer furniture"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>
      
      <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-20 md:px-12 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-4xl"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-4 font-body text-sm uppercase tracking-[0.3em] text-cream/90"
          >
            Professional Showcase
          </motion.p>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mb-6 font-display text-5xl leading-tight text-cream md:text-7xl lg:text-8xl"
          >
            A Study in
            <br />
            Contemporary Luxury
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="max-w-2xl font-body text-lg leading-relaxed text-cream/80 md:text-xl"
          >
            Four bedrooms of meticulously curated design, where Asian artistry
            meets modern sophistication.
          </motion.p>
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="font-body text-xs uppercase tracking-widest text-cream/60">
            Scroll to Explore
          </span>
          <div className="h-12 w-[1px] bg-gradient-to-b from-cream/60 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;