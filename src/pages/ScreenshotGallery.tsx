import { Helmet } from "react-helmet-async";
import { useMemo } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";

interface ScreenshotItem {
  src: string;
  filename: string;
  deviceLabel: string;
  description: string;
}

const SCREENSHOTS: ScreenshotItem[] = [
  {
    src: "/designers-hero-lock/mobile-current.png",
    filename: "mobile-current.png",
    deviceLabel: "Mobile — 393px",
    description: "Current build, captured 2026-10-11 (Directory search bottom-right)",
  },
  {
    src: "/designers-hero-lock/desktop-current.png",
    filename: "desktop-current.png",
    deviceLabel: "Desktop — 1440px",
    description: "Current build, captured 2026-10-11",
  },
];

const LOCK_VERSION = "2026-10-11-current";

export default function ScreenshotGallery() {
  const total = SCREENSHOTS.length;
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  return (
    <>
      <Helmet>
        <title>Locked Layout Reference — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <main className="min-h-screen bg-[#0a0a0a] text-foreground px-6 py-12 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-xs font-body text-white/50">
            <Link to="/trade" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Trade Portal
            </Link>
            <span>/</span>
            <span className="text-white/80">Locked Layout Gallery</span>
          </nav>
          <header className="mb-12 md:mb-16 border-b border-white/10 pb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3 font-body">
              Design QA — Locked {today}
            </p>
            <h1 className="font-display text-3xl md:text-5xl text-white/95 tracking-tight mb-4">
              Designers Hero — Locked Layout Reference
            </h1>
            <p className="font-body text-sm md:text-base text-white/60 max-w-2xl">
              Latest captures of the current designers page.
            </p>
          </header>

          <section
            aria-label="Locked screenshots"
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10"
          >
            {SCREENSHOTS.map((shot, idx) => (
              <article
                key={shot.filename}
                className="group rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-white/20 transition-colors"
              >
                <div className="relative overflow-hidden bg-[#050505]">
                  <img
                    src={`${shot.src}?v=${LOCK_VERSION}`}
                    alt={`${shot.deviceLabel} screenshot of the locked designers hero layout`}
                    loading={idx === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="w-full h-auto object-contain transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <h2 className="font-display text-lg md:text-xl text-white/90">
                      {shot.deviceLabel}
                    </h2>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-body">
                      {idx + 1}/{total}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-white/50 mb-1 break-all">
                    {shot.filename}
                  </p>
                  <p className="font-body text-xs md:text-sm text-white/60">
                    {shot.description}
                  </p>
                </div>
              </article>
            ))}
          </section>

          <footer className="mt-16 pt-8 border-t border-white/10 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-body">
              Reference: /mnt/documents/designers-hero-lock/*.png
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
