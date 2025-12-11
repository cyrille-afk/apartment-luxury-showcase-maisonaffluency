import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowUp } from "lucide-react";
import cyrilleDelvalImg from "@/assets/team/cyrille-delval.jpg";
import elsaLemarignierImg from "@/assets/team/elsa-lemarignier.jpg";

const curatingTeam = [
  {
    id: 1,
    name: "Elsa Lemarignier",
    role: "Co-Founder and CPO",
    image: elsaLemarignierImg,
    bio: "Elsa brings her expertise in curation and design to Maison Affluency.",
  },
  {
    id: 2,
    name: "Cyrille Delval",
    role: "Co-Founder and CEO",
    image: cyrilleDelvalImg,
    bio: "As a former Investment Banker, Serial Entrepreneur, long time Art and Design Collector, Cyrille leads Maison Affluency with a passion for exceptional design and craftsmanship.",
  },
];

const CuratingTeam = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const [selectedMember, setSelectedMember] = useState<typeof curatingTeam[0] | null>(null);

  return (
    <motion.div
      id="curating-team"
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
            <Dialog>
              <DialogTrigger asChild>
                <button 
                  className="aspect-square rounded-full overflow-hidden mb-4 bg-primary/5 border border-primary/10 mx-auto w-24 h-24 md:w-32 md:h-32 cursor-pointer transition-transform duration-300 hover:scale-105 hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onClick={() => setSelectedMember(member)}
                >
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
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-primary/20">
                <div className="flex flex-col items-center p-6">
                  {member.image ? (
                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden mb-6 border-2 border-primary/20">
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden mb-6 bg-primary/5 border-2 border-primary/20 flex items-center justify-center">
                      <svg
                        className="w-24 h-24 text-primary/30"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                  )}
                  <h4 className="font-display text-xl md:text-2xl text-primary mb-1">
                    {member.name}
                  </h4>
                  <p className="text-sm md:text-base text-muted-foreground font-body mb-4">
                    {member.role}
                  </p>
                  <p className="text-sm text-muted-foreground font-body text-center max-w-xs">
                    {member.bio}
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <h4 className="font-display text-sm md:text-base text-primary">
              {member.name}
            </h4>
            <p className="text-xs md:text-sm text-muted-foreground font-body">
              {member.role}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="mt-10 text-center"
      >
        <button
          onClick={() => {
            const overviewSection = document.getElementById("overview");
            if (overviewSection) {
              overviewSection.scrollIntoView({ behavior: "smooth" });
            }
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-300 font-body"
        >
          <ArrowUp className="h-4 w-4" />
          Back to Overview
        </button>
      </motion.div>
    </motion.div>
  );
};

export default CuratingTeam;
