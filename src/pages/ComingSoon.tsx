import { motion } from "framer-motion";

const ComingSoon = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      {/* Decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        className="w-16 h-px bg-primary mb-10 origin-center"
      />

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="uppercase tracking-[0.35em] text-xs text-muted-foreground mb-6 font-[var(--font-body)]"
      >
        Coming Soon
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Maison Affluency
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="mt-6 text-muted-foreground text-sm md:text-base max-w-md leading-relaxed"
      >
        We're crafting something extraordinary. Stay tuned for an elevated living experience.
      </motion.p>

      {/* Decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.2, duration: 1, ease: [0.4, 0, 0.2, 1] }}
        className="w-10 h-px bg-accent mt-10 origin-center"
      />
    </div>
  );
};

export default ComingSoon;
