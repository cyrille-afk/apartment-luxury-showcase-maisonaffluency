import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "pinch-hint-shown";

const PinchHint = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only show on touch devices
    if (!("ontouchstart" in window)) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    setVisible(true);
    localStorage.setItem(STORAGE_KEY, "1");

    const timer = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none md:hidden"
        >
          <div className="flex flex-col items-center gap-2">
            {/* Animated pinch fingers */}
            <div className="relative w-16 h-16">
              <motion.div
                className="absolute left-1/2 top-1/2"
                initial={{ x: -4, y: 4 }}
                animate={{ x: -14, y: 14 }}
                transition={{
                  duration: 0.8,
                  repeat: 1,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </motion.div>
              <motion.div
                className="absolute left-1/2 top-1/2"
                initial={{ x: 4, y: -4 }}
                animate={{ x: 14, y: -14 }}
                transition={{
                  duration: 0.8,
                  repeat: 1,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </motion.div>
            </div>
            <motion.span
              className="text-white/80 text-xs font-body tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Pinch to zoom
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PinchHint;
