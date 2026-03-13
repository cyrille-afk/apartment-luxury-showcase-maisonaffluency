/**
 * Brand Catalogue Data Module
 *
 * Organizes all designers/brands by the PDF catalogue categories,
 * resolving profile images and curator picks from the source data
 * in FeaturedDesigners, Collectibles, and BrandsAteliers.
 */

import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import { atelierOnlyPicks } from "@/components/BrandsAteliers";
import { cloudinaryUrl } from "@/lib/cloudinary";

/* ─── Types ─── */
export interface BrandCatalogueDesigner {
  id: string;
  name: string;
  description: string;
  website?: string;
  profileImage: string | null;
  curatorPicks: CuratorPick[];
}

export interface BrandCatalogueCategory {
  title: string;
  subtitle?: string;
  designers: BrandCatalogueDesigner[];
}

/* ─── Lookup helpers ─── */
function findFeatured(id: string) {
  return featuredDesigners.find((d) => d.id === id) ?? null;
}

function findCollectible(id: string) {
  return collectibleDesigners.find((d) => d.id === id) ?? null;
}

function findAtelierOnly(key: string) {
  return atelierOnlyPicks[key] ?? null;
}

/** Cloudinary background images for designers only in BrandsAteliers partnerBrands (not exported) */
const bgImage = (publicId: string) =>
  cloudinaryUrl(publicId, { width: 800, quality: "auto:good", crop: "fill" });

/* ─── Category definitions matching the PDF ─── */
export function getBrandCatalogueData(): BrandCatalogueCategory[] {
  return [
    {
      title: "Brands & Makers",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesigner("alexander-lamont", "Alexander Lamont", "Collections of furniture, lighting, objects and wall panels crafted with unexpected natural materials and refined hand techniques centuries old in Europe and Asia.", "alexanderlamont.com"),
        resolveDesigner("leo-aerts-alinea", "Alinéa Design Objects", "French furniture publisher working with leading contemporary designers to produce limited edition and bespoke pieces of remarkable craft and timelessness.", "alineadesignobjects.com"),
        resolveDesignerBg("collection-particuliere", "Collection Particulière", "Belgian design house producing exceptional furniture pieces that blend sculptural form with functional elegance, using fine stone and metal.", "collection-particuliere.fr", "collection-particuliere-bg_hn4jiq"),
        resolveDesignerBg("christophe-delcourt", "Christophe Delcourt", "Parisian designer whose collections blend natural materials with refined geometric forms, creating furniture of understated monumentality and exceptional longevity.", "christophedelcourt.com", "delcourt-bg_whop7p"),
        resolveDesignerFeaturedByName("Haymann Editions", "French design publisher committed to producing original, sculptural and highly crafted lighting and furniture that challenge conventions while celebrating handcraft.", "haymanneditions.com"),
        resolveDesignerBg("la-chance", "La Chance", "Paris-based design brand creating playful yet sophisticated furniture and objects, collaborating with emerging and established designers to express a distinctly Parisian optimism.", "lachance.paris", "Screen_Shot_2026-02-25_at_3.18.38_AM_nkx1t6"),
        resolveDesigner("man-of-parts", "Man of Parts", "Design brand offering meticulously crafted furniture and objects, celebrating the beauty of exceptional materials and the mastery of traditional making techniques.", "manofparts.com"),
        resolveDesignerBg("pierre-augustin-rose", "Pierre Augustin Rose", "A Paris-based atelier creating handcrafted rugs, cushions and accessories that blend French haute couture sensibility with artisanal craftsmanship.", "pierreaugustinrose.com", "pierre-augustin-rose-bg_bgbcws"),
        resolveDesignerAtelier("pouenat", "Pouenat", "Historic Parisian ironwork atelier with over 150 years of expertise, creating bespoke decorative ironwork, furniture and lighting of extraordinary complexity and refinement.", "pouenat.fr"),
        resolveDesigner("robicara", "Robicara", "London-based brand creating contemporary rugs and soft furnishings of exceptional quality, collaborating with leading designers to produce limited edition and bespoke collections.", "robicara.com"),
        resolveDesigner("adam-courts-okha", "OKHA", "South African design brand celebrated for distinctive and expressive furniture, lighting and decor inspired by the rich cultural landscape and exceptional craft of the continent.", "okha.com"),
        resolveDesignerAtelier("saint-louis", "Saint-Louis", "France's oldest crystal manufacture, founded in 1586, creating extraordinary crystal objects, lighting and tableware by master craftsmen using techniques refined over four centuries.", "saint-louis.com"),
        resolveDesignerFeaturedByName("Sé Collections", "London-based brand renowned for its distinctly layered design language, combining rare materials, refined craft and a bold decorative aesthetic across furniture, lighting and accessories.", "se-collections.com"),
      ],
    },
    {
      title: "Master Designers",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesigner("bina-baitel", "Bina Baitel", "Paris-based designer and architect known for a multidisciplinary approach blending art, industrial design and architecture. Her practice focuses on 'sensory design' — objects that invite contemplative and interactive experiences.", "binabaitel.com"),
        resolveDesigner("garnier-linker", "Garnier & Linker", "Parisian design studio creating contemporary sculptural furniture and lighting from rare materials — alabaster, bronze and volcanic stone — handcrafted by French artisans.", "garnieretlinker.com"),
        resolveDesignerBg("gilles-boissier", "Gilles & Boissier", "Renowned Parisian interior architecture firm whose singular blend of modernity and refinement has shaped some of the world's most celebrated hospitality and residential interiors.", "gillesetboissier.com", "gilles-boissier-bg"),
        resolveDesigner("pierre-bonnefille", "Pierre Bonnefille", "Master of material and texture, Pierre Bonnefille creates extraordinary surfaces and objects from rare natural pigments and traditional techniques, elevating the notion of artisanal craftsmanship to fine art.", "pierrebonnefille.com"),
        resolveDesignerBg("pierre-yovanovitch", "Pierre Yovanovitch", "One of France's most celebrated designers, Pierre Yovanovitch creates uniquely personal environments that balance rigorous architecture with a deep sensibility for craft, art and the poetry of space.", "pierreyovanovitch.com", "pierre-yovanovitch-bg_ctngfd"),
        resolveDesigner("thierry-lemaire", "Thierry Lemaire", "Paris-based interior designer whose work is defined by an exquisite sensitivity to materials, colour and light — creating interiors of deep calm and refined beauty rooted in French decorative tradition.", "thierry-lemaire.fr"),
      ],
    },
    {
      title: "Upcoming Designers",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesigner("atelier-pendhapa", "Atelier Pendhapa", "Bali-based design studio creating extraordinary furniture and objects that weave together Javanese craft heritage with contemporary design sensibility, using local materials and traditional making techniques.", "pendhapa-architects.com"),
        resolveDesignerBg("bieke-casteleyn", "Bieke Casteleyn", "Belgian designer whose poetic and material-led approach yields furniture, objects and textiles of quiet beauty and enduring presence — work rooted in a deep curiosity about matter and making.", "biekecasteleyn.com", "bieke-casteleyn-bg_wuhwso"),
        resolveDesigner("emmanuel-levet-stenne", "Emmanuel Levet Stenne", "French lighting designer renowned for ethereal alabaster pendant lights and sculptural fixtures that transform spaces with warm, natural glow — celebrating the inherent beauty of natural stone.", "emmanuel-levet-stenne.com"),
        resolveDesigner("hamrei", "Hamrei", "A playful yet sophisticated approach to contemporary design. Each piece demonstrates mastery of form and craftsmanship while maintaining a sense of joy and personality.", "hamrei.com"),
        resolveDesigner("leo-sentou", "Leo Sentou", "Paris-based design brand with a long heritage of championing emerging French talent and producing distinctive furniture, objects and accessories.", "leo-sentou.com"),
        resolveDesigner("olivia-cognet", "Olivia Cognet", "French-born, Los Angeles-based ceramic artist whose expressive, organic ceramic vessels and sculptures bridge the boundary between functional craft and fine art.", "oliviacognet.com"),
        resolveDesignerAtelier("victoria-magniant", "Victoria Magniant", "Emerging French designer exploring the relationship between industrial and artisanal processes, producing sculptural objects of great material intelligence and poetic restraint.", "victoriamagniant.com"),
      ],
    },
    {
      title: "Reeditions",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesigner("jean-michel-frank", "Ecart Paris — Jean-Michel Frank", "Committed to maintaining a tradition of eclecticism and timeless quality. An art of simple and functional elegance straight out of the avant-garde spirit of Andrée Putman.", "ecart.paris"),
        resolveDesignerBg("galerie-mcde", "Galerie MCDE", "Publisher and manufacturer specialising in high-quality reissues of iconic furniture and lighting by visionary 20th-century architect Pierre Chareau — preserving his modern legacy for contemporary spaces.", "pierrechareau-edition.fr", "galerie-mcde-bg_fxxdp6"),
        resolveDesignerBg("paulin-paulin-paulin", "Paulin, Paulin, Paulin", "Family-run company preserving, producing and promoting the iconic, organic and futuristic furniture designs of the late Pierre Paulin — bringing previously unproduced 'utopian' designs to life as limited editions.", "paulinpaulinpaulin.com", "paulin-paulin-paulin-bg_xjxo4m"),
      ],
    },
    {
      title: "Collectible Design",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesigner("kerstens", "Andy Kerstens", "Belgian photographer celebrated for his hauntingly beautiful and theatrical fine art photographs that draw on the history of painting to create images of extraordinary pictorial power.", "kerstens.be"),
        resolveDesignerCollectible("atelier-demichelis", "Atelier Demichelis", "Italian atelier producing remarkable hand-crafted sculptural furniture and objects using rare materials — stone, bronze, precious metals — with an uncompromising commitment to artisanal excellence.", "atelierdemichelis.com"),
        resolveDesignerCollectible("emmanuel-babled", "Emmanuel Babled", "Design studio celebrated for its mastery of glass and rare materials to produce collectible, limited edition objects of exceptional formal and technical beauty.", "babled.net"),
        resolveDesignerCollectible("kiko-lopez", "Kiko Lopez", "Paris-based designer creating extraordinary lighting and decorative objects by pushing the technical and aesthetic boundaries of mirror and reflective glass.", "kikolopez.com"),
        resolveDesignerBg("le-berre-vevaud", "Le Berre Vevaud", "Parisian design duo creating richly material and technically extraordinary collectible furniture and objects — weaving together historical craft references and contemporary formal language.", "leberrevevaud.com", "Screen_Shot_2026-02-23_at_9.40.24_AM_nfyg7z"),
        resolveDesignerBg("martin-masse", "Martin Massé", "French designer producing sculptural furniture and objects of great material richness and formal invention, celebrated for his mastery of lacquer and complex surface treatments.", "martin-masse.com", "martin-masse-bg_js1sx7"),
        resolveDesignerCollectible("rowin-atelier", "RoWin' Atelier", "Design atelier creating handmade collectible furniture and objects of remarkable material inventiveness, drawing on craft traditions from across the globe.", "rowin-atelier.com"),
        resolveDesignerFeaturedByName("Théorème Editions", "French design publisher producing limited edition collectible works in collaboration with leading designers and artists, celebrating the convergence of art and design.", "theoremeeditions.com"),
      ],
    },
    {
      title: "Lighting Ateliers",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesignerBg("alain-ellouz", "Alain Ellouz", "Master stone carver creating extraordinary alabaster lighting of haunting beauty — translucent vessels that transform light into something warm, organic and deeply poetic.", "alain-ellouz-paris.com", "Screen_Shot_2026-02-23_at_10.02.17_AM_tnml24"),
        resolveDesigner("apparatus-studio", "Apparatus Studio", "New York-based studio creating highly crafted lighting and furniture of cinematic beauty — objects imbued with a theatrical sense of material, texture and proportion.", "apparatusstudio.com"),
        resolveDesigner("entrelacs-creation", "Entrelacs", "French design studio creating extraordinary handwoven lighting and objects, celebrating the complexity and beauty of traditional French knotting and weaving techniques.", "entrelacs-creation.fr"),
        resolveDesignerBg("giopato-coombes", "Giopato & Coombes", "Venetian lighting design duo celebrated for theatrical, sculptural lighting installations of extraordinary glass craftsmanship and evocative formal beauty.", "giopatocoombes.com", "Screen_Shot_2026-02-23_at_9.21.31_AM_ifnvmk"),
        resolveDesigner("jeremy-maxwell-wintrebert", "Jeremy Maxwell Wintrebert", "American glass artist and designer working in Normandy, creating extraordinary hand-blown glass lighting and objects of organic, fluid beauty using fire and breath alone.", "jeremymaxwellwintrebert.com"),
        resolveDesignerBg("mernoe", "Mernøe", "Scandinavian lighting studio creating beautifully restrained and technically refined lighting objects that celebrate the quiet drama of light and shadow.", "mernoe.com", "mernoe-bg_c9nn4i"),
      ],
    },
    {
      title: "Rugs & Textiles",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesigner("atelier-fevrier", "Atelier Février", "Paris-based rug atelier creating extraordinary hand-knotted and hand-tufted rugs of great material refinement, produced in collaboration with leading designers.", "atelierfevrier.com"),
        resolveDesignerFeaturedByName("CC-Tapis", "Milanese rug publisher creating exceptional hand-knotted Himalayan rugs in collaboration with leading international designers — each rug a work of sustained craft and creative ambition.", "cc-tapis.com"),
        resolveDesignerBg("toulemonde-bochart", "Toulemonde Bochart", "Leading French rug publisher with a 40-year legacy of creative and technical excellence, producing rugs of extraordinary design quality.", "toulemondebochart.com", "Screen_Shot_2026-02-23_at_10.02.17_AM_tnml24"),
        resolveDesignerBg("pinton-1867", "Pinton 1867", "Historic French Savonnerie and Aubusson manufacturer with over 150 years of uninterrupted craft heritage, creating extraordinary hand-woven rugs.", "pinton1867.com", "pinton-1867-bg_pa0cjy"),
      ],
    },
    {
      title: "Arts & Installations",
      subtitle: "Maison Affluency · Curated Selection",
      designers: [
        resolveDesignerBg("valeria-nascimento", "Valéria Nascimento", "Brazilian artist creating powerful, material-rich works that weave together cultural memory, natural materials and contemporary abstraction.", "valerianascimento.com", "valeria-nascimento-bg_zca4dy"),
        resolveDesignerBg("frederique-whittle", "Frédérique Whittle", "French artist working with glass, ceramics and mixed media to produce delicate, luminous works that explore the boundary between the visible and the immaterial.", "frederiquewhittle.fr", "frederique-rob-whittle-bg_arue3i"),
        resolveDesignerAtelier("stephane-cg", "Stéphane Cojot-Goldberg", "Parisian photographer creating intimate, painterly photographic works that explore architecture, light and the human relationship to built and natural space.", "stephcgart.com"),
        resolveDesignerCollectible("nathalie-ziegler", "Nathalie Ziegler", "French ceramic artist whose deeply material practice produces extraordinary vessels and sculptural objects of great tactile beauty.", "nathalie-ziegler.com"),
      ],
    },
  ];
}

/* ─── Resolver functions ─── */

/** Resolve from featuredDesigners by ID */
function resolveDesigner(
  id: string,
  name: string,
  description: string,
  website?: string
): BrandCatalogueDesigner {
  const d = findFeatured(id);
  return {
    id,
    name,
    description,
    website,
    profileImage: d?.image ?? null,
    curatorPicks: d?.curatorPicks ?? [],
  };
}

/** Resolve from collectibleDesigners by ID */
function resolveDesignerCollectible(
  id: string,
  name: string,
  description: string,
  website?: string
): BrandCatalogueDesigner {
  const d = findCollectible(id);
  // Also check featured (some are in both)
  const f = findFeatured(id);
  const picks = d?.curatorPicks ?? f?.curatorPicks ?? [];
  return {
    id,
    name,
    description,
    website,
    profileImage: d?.image ?? f?.image ?? null,
    curatorPicks: picks as CuratorPick[],
  };
}

/** Resolve from atelierOnlyPicks by key */
function resolveDesignerAtelier(
  key: string,
  name: string,
  description: string,
  website?: string
): BrandCatalogueDesigner {
  const d = findAtelierOnly(key);
  return {
    id: key,
    name,
    description,
    website,
    profileImage: d?.curatorPicks?.[0]?.image ?? null,
    curatorPicks: (d?.curatorPicks ?? []) as CuratorPick[],
  };
}

/** Resolve from BrandsAteliers using background image (not exported as data) */
function resolveDesignerBg(
  id: string,
  name: string,
  description: string,
  website: string | undefined,
  cloudinaryPublicId: string
): BrandCatalogueDesigner {
  // Also check featuredDesigners and collectibleDesigners for curator picks
  const f = findFeatured(id);
  const c = findCollectible(id);
  const a = findAtelierOnly(id);
  return {
    id,
    name,
    description,
    website,
    profileImage: f?.image ?? c?.image ?? bgImage(cloudinaryPublicId),
    curatorPicks: (f?.curatorPicks ?? c?.curatorPicks ?? a?.curatorPicks ?? []) as CuratorPick[],
  };
}

/** Resolve from featuredDesigners by name match (for designers without standard IDs) */
function resolveDesignerFeaturedByName(
  name: string,
  description: string,
  website?: string
): BrandCatalogueDesigner {
  const d = featuredDesigners.find(
    (fd) =>
      fd.name?.toLowerCase().includes(name.toLowerCase()) ||
      fd.displayName?.toLowerCase().includes(name.toLowerCase())
  );
  const id = d?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id,
    name,
    description,
    website,
    profileImage: d?.image ?? null,
    curatorPicks: d?.curatorPicks ?? [],
  };
}
