import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CloudUpload from "./CloudUpload";
import { ImageIcon, Trash2, Loader2 } from "lucide-react";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { invalidateHeroCache } from "./SectionHero";

const HERO_SECTIONS = [
  { key: "gallery", label: "Trade Gallery", fallbackId: "v1773731066/Screen_Shot_2026-03-17_at_3.03.40_PM_b8dux9" },
  { key: "quotes", label: "Quote Builder", fallbackId: "v1773726568/AffluencySG_081_dk5rn7" },
  { key: "documents", label: "Brand Library", fallbackId: "home-office-desk_g0ywv2" },
  { key: "provenance", label: "Provenance & Certificates", fallbackId: "details-console_hk6uxt" },
  { key: "3d-studio", label: "3D Studio (page)", fallbackId: "v1773472978/combination-interior-material-samples-placed-dark-black-marble-table-including-wooden-ceramic-floor-tiles-luxury-marble-stones_1033579-186119_kmp53v" },
  { key: "axonometric", label: "Axonometric Studio (page)", fallbackId: "v1773472978/combination-interior-material-samples-placed-dark-black-marble-table-including-wooden-ceramic-floor-tiles-luxury-marble-stones_1033579-186119_kmp53v" },
  { key: "dash-showroom", label: "Dashboard · Showroom", fallbackId: "living-room-hero_zxfcxl" },
  { key: "dash-gallery", label: "Dashboard · Website Products", fallbackId: "v1773811405/IMG_6996_tfx4bp" },
  { key: "dash-quotes", label: "Dashboard · Quote Builder", fallbackId: "v1773799140/Screen_Shot_2026-03-18_at_9.57.16_AM_mpvvpg" },
  { key: "dash-library", label: "Dashboard · Brand Library", fallbackId: "v1773790684/AffluencySG_086_2_1_2_xpvcnw" },
  { key: "dash-3d-studio", label: "Dashboard · 3D Studio", fallbackId: "v1773472978/combination-interior-material-samples-placed-dark-black-marble-table-including-wooden-ceramic-floor-tiles-luxury-marble-stones_1033579-186119_kmp53v" },
] as const;

const GRAVITY_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "center", label: "Center" },
  { value: "north", label: "Top" },
  { value: "south", label: "Bottom" },
  { value: "east", label: "Right" },
  { value: "west", label: "Left" },
];

interface HeroRecord {
  section_key: string;
  image_url: string;
  gravity: string;
}

const HeroManager = () => {
  const { toast } = useToast();
  const [heroes, setHeroes] = useState<Record<string, HeroRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchHeroes();
  }, []);

  const fetchHeroes = async () => {
    const { data } = await supabase
      .from("section_heroes")
      .select("section_key, image_url, gravity");
    if (data) {
      const map: Record<string, HeroRecord> = {};
      data.forEach((r: any) => { map[r.section_key] = r; });
      setHeroes(map);
    }
    setLoading(false);
  };

  const handleUpload = async (sectionKey: string, urls: string[]) => {
    if (!urls[0]) return;
    setSaving(sectionKey);
    const existing = heroes[sectionKey];
    const gravity = existing?.gravity || "auto";

    const { error } = await supabase
      .from("section_heroes")
      .upsert(
        { section_key: sectionKey, image_url: urls[0], gravity, updated_at: new Date().toISOString() },
        { onConflict: "section_key" }
      );

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      setHeroes((prev) => ({ ...prev, [sectionKey]: { section_key: sectionKey, image_url: urls[0], gravity } }));
      invalidateHeroCache();
      toast({ title: "Hero image updated" });
    }
    setSaving(null);
  };

  const handleGravityChange = async (sectionKey: string, gravity: string) => {
    const existing = heroes[sectionKey];
    if (!existing) return;

    setSaving(sectionKey);
    const { error } = await supabase
      .from("section_heroes")
      .update({ gravity, updated_at: new Date().toISOString() })
      .eq("section_key", sectionKey);

    if (!error) {
      setHeroes((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], gravity } }));
      invalidateHeroCache();
    }
    setSaving(null);
  };

  const handleRemove = async (sectionKey: string) => {
    setSaving(sectionKey);
    await supabase.from("section_heroes").delete().eq("section_key", sectionKey);
    setHeroes((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
    invalidateHeroCache();
    toast({ title: "Reverted to default hero" });
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="font-body text-sm text-muted-foreground">Loading heroes…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {HERO_SECTIONS.map((section) => {
        const hero = heroes[section.key];
        const previewUrl = hero?.image_url || cloudinaryUrl(section.fallbackId, { width: 800, height: 300, quality: "auto", crop: "fill" });
        const isCustom = !!hero;

        return (
          <div key={section.key} className="border border-border rounded-lg overflow-hidden">
            {/* Preview */}
            <div className="relative h-28 md:h-36 overflow-hidden">
              {(() => {
                const g = hero?.gravity || "auto";
                const posClass =
                  g === "east" ? "object-right" :
                  g === "west" ? "object-left" :
                  g === "north" ? "object-top" :
                  g === "south" ? "object-bottom" :
                  "object-center";
                return (
                  <img
                    src={previewUrl}
                    alt={section.label}
                    className={`w-full h-full object-cover ${posClass}`}
                  />
                );
              })()}
              <div className="absolute inset-0 bg-gradient-to-r from-foreground/50 via-foreground/20 to-transparent" />
              <div className="absolute bottom-3 left-4">
                <p className="font-display text-sm text-background">{section.label}</p>
                <p className="font-body text-[10px] text-background/60">
                  {isCustom ? "Custom upload" : "Default (Cloudinary)"}
                </p>
              </div>
              {saving === section.key && (
                <div className="absolute top-3 right-3">
                  <Loader2 className="w-4 h-4 animate-spin text-background" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-3 flex flex-wrap items-center gap-3 bg-muted/30">
              <CloudUpload
                folder="heroes"
                accept="image/*"
                label="Upload Hero"
                onUpload={(urls) => handleUpload(section.key, urls)}
                disabled={saving === section.key}
              />

              {isCustom && (
                <>
                  <select
                    value={hero.gravity}
                    onChange={(e) => handleGravityChange(section.key, e.target.value)}
                    className="px-2 py-1.5 bg-background border border-border rounded-md font-body text-xs text-foreground"
                  >
                    {GRAVITY_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleRemove(section.key)}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-body text-destructive hover:text-destructive/80 transition-colors"
                    title="Revert to default"
                  >
                    <Trash2 className="w-3 h-3" />
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HeroManager;
