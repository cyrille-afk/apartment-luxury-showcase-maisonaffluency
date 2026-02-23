import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Search, Linkedin } from "lucide-react";
import cyrilleDelvalImg from "@/assets/team/cyrille-delval.jpg";
import elsaLemarignierImg from "@/assets/team/elsa-lemarignier.jpg";

const curatingTeam = [
  {
    id: 1,
    name: "Cyrille Delval",
    role: "Co-Founder and CEO",
    image: cyrilleDelvalImg,
    bio: "During a 4 year span, Cyrille studied Art History at the renown Birkbeck College in London whilst navigating a successful investment banking career in London and New York at the same time. This lead him to a serial entrepreneurship life where business and passion mingle. As Affluency co-founder, Cyrille leads Maison Affluency's development in Southeast Asia and the Middle East, sharing his passion for exceptional craftsmanship and unique design pieces.",
    linkedin: "https://www.linkedin.com/in/cyrilledelval/",
  },
  {
    id: 2,
    name: "Elsa Lemarignier",
    role: "Co-Founder and CPO",
    image: elsaLemarignierImg,
    bio: "After attending the Ecole du Louvre, Elsa opened her gallery in Paris Carré Rive Gauche where she curated a unique design collection with prominent designers such as Ron Arad. As Affluency co-founder, her mission is to seek out and select exceptional design, art and collectible pieces around the world, showcasing exceptional craftsmanship.",
    linkedin: "https://www.linkedin.com/in/elsa-lemarignier-4b50b119/",
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
      className="mt-12 pt-12 md:mt-20 md:pt-16 border-t border-primary/10 scroll-mt-24"
    >
      <h3 className="font-display text-2xl md:text-3xl text-primary mb-4 text-center">
        The Curating Team
      </h3>
      <p className="text-muted-foreground font-body text-center max-w-2xl mx-auto mb-12 italic">
        The heart and soul of the gallery and designers selection
      </p>

      <div className="grid grid-cols-2 gap-3 md:gap-8 max-w-md mx-auto">
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
                <div className="relative cursor-pointer group mb-4">
                  <button 
                    className="relative aspect-square rounded-full overflow-hidden bg-primary/5 border border-primary/20 w-24 h-24 md:w-32 md:h-32 transition-transform duration-300 group-hover:scale-105 group-hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  {/* Magnifying glass icon at bottom-right corner */}
                  <div className="absolute bottom-1 right-1 md:bottom-0 md:right-0 bg-background/90 p-1.5 rounded-full shadow-md text-primary/70 group-hover:text-primary transition-colors duration-300">
                    <Search className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-primary/20 [&>button]:absolute [&>button]:top-3 [&>button]:left-3 md:[&>button]:left-auto md:[&>button]:right-3 [&>button]:z-50 [&>button]:bg-background/80 [&>button]:backdrop-blur-sm [&>button]:rounded-full [&>button]:w-9 [&>button]:h-9 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:shadow-md [&>button]:border [&>button]:border-primary/20 [&>button]:text-foreground">
                <div className="flex flex-col items-center p-6 pt-14">
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
                  <div className="flex items-center gap-4 mb-1">
                    <h4 className="font-display text-xl md:text-2xl text-primary">
                      {member.name}
                    </h4>
                    {member.linkedin && (
                      <a
                        href={member.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0077B5] hover:text-[#005582] transition-colors duration-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Linkedin className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm md:text-base text-muted-foreground font-body mb-4">
                    {member.role}
                  </p>
                  <p className="text-sm text-muted-foreground font-body text-justify max-w-sm">
                    {member.bio}
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <h4 className="font-display text-base md:text-lg text-primary font-semibold mt-2">
              {member.name}
            </h4>
            <p className="text-sm md:text-base text-foreground/80 font-body tracking-wide uppercase">
              {member.role}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="mt-14 text-center"
      >
        <button
          onClick={() => {
            const overviewSection = document.getElementById("overview");
            if (overviewSection) {
              overviewSection.scrollIntoView({ behavior: "smooth" });
            }
          }}
          className="flex flex-col items-center gap-2 cursor-pointer group mx-auto"
        >
          <motion.div
            className="h-10 w-[1px] bg-gradient-to-t from-primary/50 to-transparent"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="font-body text-xs uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors duration-300">
            Back to Gallery
          </span>
        </button>
      </motion.div>
    </motion.div>
  );
};

export default CuratingTeam;
