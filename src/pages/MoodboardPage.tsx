import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import OneClickMoodboard from "@/components/trade/OneClickMoodboard";
import heroImage from "@/assets/moodboard-hero.jpg";

const FOOTER_LINKS = [
  { label: "About Us", to: "/journal" },
  { label: "Journal", to: "/journal" },
  { label: "Contact", to: "/contact" },
  { label: "Install App", to: "/trade-program" },
];

export default function MoodboardPage() {
  return (
    <div className="min-h-screen bg-moodboard-cream text-moodboard-ink">
      <Helmet>
        <title>One-Click Moodboard Generator — Maison Affluency</title>
        <meta name="description" content="Start with a room idea or a reference link and explore a quick edit from the Maison Affluency collection." />
      </Helmet>

      <header className="relative h-[38vh] min-h-64 w-full overflow-hidden md:h-[46vh]">
        <img src={heroImage} alt="Marble table and curved bouclé sofa in a neutral luxury interior" width={1920} height={768} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-moodboard-cream/40 to-transparent" aria-hidden="true" />
      </header>

      <main>
        <OneClickMoodboard />
      </main>

      <footer className="border-t border-moodboard-ink/10 bg-moodboard-cream">
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">
          <nav aria-label="Moodboard footer" className="flex flex-wrap items-center gap-x-10 gap-y-4">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="font-body text-[11px] uppercase tracking-[0.22em] text-moodboard-ink/70 transition-colors hover:text-moodboard-teal">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="mt-8 font-body text-xs text-moodboard-ink/40">© {new Date().getFullYear()} Maison Affluency. All rights reserved. Sourcing edits are illustrative; availability and pricing confirmed on enquiry.</p>
        </div>
      </footer>
    </div>
  );
}
