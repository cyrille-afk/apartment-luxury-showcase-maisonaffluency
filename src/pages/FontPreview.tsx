import { useEffect } from "react";

const SAMPLE_HEADING = "Designers & Makers";
const SAMPLE_BODY = `Discover the visionary designers whose exceptional work defines Maison Affluency. Each brings their unique perspective and masterful craftsmanship to create pieces that transcend ordinary furniture. All Gallery Featured Designers items are presented in situ at our gallery.`;
const SAMPLE_SMALL = `We collaborate with the world's most distinguished furniture houses, textile ateliers, and artisan workshops to bring exceptional pieces to discerning collectors and design professionals.`;

const fonts = [
  { name: "Inter (current)", family: "'Inter', sans-serif", url: "" },
  { name: "Lora", family: "'Lora', serif", url: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap" },
  { name: "Cormorant Garamond", family: "'Cormorant Garamond', serif", url: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" },
  { name: "EB Garamond", family: "'EB Garamond', serif", url: "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" },
];

export default function FontPreview() {
  useEffect(() => {
    // Load Google Fonts
    fonts.forEach(f => {
      if (f.url) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = f.url;
        document.head.appendChild(link);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-12 md:px-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-2">Font Comparison</h1>
        <p className="text-sm text-muted-foreground font-body mb-10">
          Headings stay as Playfair Display — only body text changes below.
        </p>

        <div className="grid gap-10">
          {fonts.map((font) => (
            <div key={font.name} className="rounded-xl border border-border bg-card p-6 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-body uppercase tracking-widest text-accent font-semibold">{font.name}</span>
                <span className="flex-1 h-px bg-border" />
              </div>

              <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-foreground mb-4">
                {SAMPLE_HEADING}
              </h2>

              <p
                className="text-sm md:text-base text-muted-foreground leading-relaxed mb-4 max-w-3xl text-justify"
                style={{ fontFamily: font.family }}
              >
                {SAMPLE_BODY}
              </p>

              <p
                className="text-sm text-muted-foreground leading-relaxed max-w-3xl text-justify"
                style={{ fontFamily: font.family }}
              >
                {SAMPLE_SMALL}
              </p>

              <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap gap-6">
                <div>
                  <span className="text-[10px] font-body uppercase tracking-widest text-muted-foreground">Button label</span>
                  <div className="mt-1 px-5 py-2 border border-border rounded-full text-sm" style={{ fontFamily: font.family }}>
                    Book a Viewing
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-body uppercase tracking-widest text-muted-foreground">Caption</span>
                  <p className="mt-1 text-xs text-muted-foreground" style={{ fontFamily: font.family }}>
                    Materials: Bronze, Patinated Brass, Hand-blown Glass
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-sm font-body text-primary underline underline-offset-4 hover:text-accent transition-colors">
            ← Back to site
          </a>
        </div>
      </div>
    </div>
  );
}
