import { useState } from "react";
import { ImageOff } from "lucide-react";

export type VisualThemeDna = {
  aesthetic_label: string | null;
  aesthetic_summary: string | null;
  dominant_tones: string[] | null;
  historical_affinities: string[] | null;
  materials: string[] | null;
  image_urls: string[] | null;
};

const paletteClasses = ["bg-foreground", "bg-primary", "bg-secondary", "bg-accent"];

function cleanList(value: string[] | null | undefined, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit);
}

function toneClass(tone: string, index: number) {
  const value = tone.toLowerCase();
  if (/black|charcoal|ebony|walnut|oxblood|deep|dark|ink/.test(value)) return "bg-foreground";
  if (/green|jade|olive|sage|forest/.test(value)) return "bg-primary";
  if (/red|rust|clay|terracotta|coral|rose/.test(value)) return "bg-secondary";
  if (/gold|brass|ochre|yellow|amber/.test(value)) return "bg-accent";
  if (/white|ivory|cream|sand|beige|stone|grey|gray|taupe/.test(value)) return "bg-muted";
  return paletteClasses[index % paletteClasses.length];
}

function InsightBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">{title}</h4>
      {values.length ? (
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5">
          {values.map((value, index) => (
            <span key={`${value}-${index}`} className="border border-border bg-background px-2.5 py-1 font-body text-[11px] text-foreground">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 font-body text-xs text-muted-foreground">Not identified</p>
      )}
    </div>
  );
}

function EvidenceImage({ src, index }: { src?: string; index: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-square overflow-hidden bg-visual-evidence">
      {src && !failed ? (
        <img
          src={src}
          alt={`Scraped studio portfolio evidence ${index + 1}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-border/60 text-muted-foreground/50">
          <ImageOff className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Portfolio image unavailable</span>
        </div>
      )}
    </div>
  );
}

export default function VisualThemeAnalysis({ dna }: { dna: VisualThemeDna }) {
  const dialect = cleanList(dna.dominant_tones);
  const affinities = cleanList(dna.historical_affinities);
  const materials = cleanList(dna.materials);
  const images = cleanList(dna.image_urls, 6);
  const palette = dialect.slice(0, 4);

  while (palette.length < 4) palette.push(["Deep Ink", "Jade", "Terracotta", "Warm Gold"][palette.length]);

  return (
    <section className="border-t border-border bg-card" aria-label="Visual theme analysis">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="min-w-0 space-y-6 border-b border-border p-5 md:p-7 lg:border-b-0 lg:border-r">
          <div>
            <p className="font-body text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Curatorial Insights</p>
            <h3 className="mt-2 font-serif text-xl text-foreground">{dna.aesthetic_label || "Studio Visual Language"}</h3>
          </div>

          <InsightBlock title="Design Dialect" values={dialect} />
          <InsightBlock title="Historical Affinities" values={affinities} />
          <InsightBlock title="Materiality Profile" values={materials} />

          <div className="border-t border-border pt-4">
            <h4 className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">AI Summary Notes</h4>
            <div className="mt-3 min-h-24 border-l-2 border-primary/60 pl-4">
              <p className="font-serif text-sm leading-6 text-foreground/80">
                {dna.aesthetic_summary || "No summary notes were returned for this analysis."}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden p-5 md:p-7">
          <div className="flex min-w-0 flex-col gap-2 xs:flex-row xs:items-end xs:justify-between xs:gap-4">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Source Review</p>
              <h3 className="mt-2 font-serif text-xl text-foreground">Visual Evidence Matrix</h3>
            </div>
            <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{images.length}/6 assets</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-1.5 md:gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <EvidenceImage key={images[index] ?? `empty-${index}`} src={images[index]} index={index} />
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">Derived Palette</p>
            <div className="mt-3 flex min-w-0">
              {palette.map((tone, index) => (
                <div key={`${tone}-${index}`} className="min-w-0 flex-1">
                  <div className={`h-7 w-full ${toneClass(tone, index)}`} aria-label={tone} />
                  <p className="mt-2 truncate pr-2 font-body text-[9px] uppercase tracking-[0.12em] text-muted-foreground" title={tone}>
                    {tone}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}