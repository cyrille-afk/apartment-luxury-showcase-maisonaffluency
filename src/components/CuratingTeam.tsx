import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import cyrilleDelvalImg from "@/assets/team/cyrille-delval.jpg";

const curatingTeam = [
  {
    id: 1,
    name: "Elsa Lemarignier",
    role: "Co-Founder and CPO",
    image: null,
  },
  {
    id: 2,
    name: "Cyrille Delval",
    role: "Co-Founder and CEO",
    image: cyrilleDelvalImg,
  },
];

const CuratingTeam = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="mt-20 pt-16 border-t border-primary/10"
    >
      <h3 className="font-display text-2xl md:text-3xl text-primary mb-4 text-center">
        Our Curating Team
      </h3>
      <p className="text-muted-foreground font-body text-center max-w-2xl mx-auto mb-12">
        The dedicated curators behind our designer selections
      </p>

      <div className="grid grid-cols-2 gap-6 md:gap-8 max-w-md mx-auto">
        {curatingTeam.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
            className="text-center"
          >
            <div className="aspect-square rounded-full overflow-hidden mb-4 bg-primary/5 border border-primary/10 mx-auto w-24 h-24 md:w-32 md:h-32">
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary/30">
                  <svg
                    className="w-12 h-12 md:w-16 md:h-16"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>
            <h4 className="font-display text-sm md:text-base text-primary">
              {member.name}
            </h4>
            <p className="text-xs md:text-sm text-muted-foreground font-body">
              {member.role}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default CuratingTeam;
