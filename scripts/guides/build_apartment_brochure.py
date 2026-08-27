"""
Maison Affluency — Apartment Showcase brochure for architects.

Content is grounded in the live site copy (/apartment-tour, /gallery) and the
`gallery_hotspots` table (rooms → pieces → designers). Photography is pulled
from the same Cloudinary assets the gallery renders.

    python scripts/guides/build_apartment_brochure.py [output.pdf]
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from brand_template import build_guide  # noqa: E402

IMG = os.environ.get("MA_BROCHURE_IMG_DIR", "/tmp/brochure/img")


def img(name: str) -> str:
    return os.path.join(IMG, f"{name}.jpg")


# ---------------------------------------------------------------------------
# Rooms — title, subtitle, hero image, designers represented (from gallery_hotspots)
# ---------------------------------------------------------------------------
ROOMS = [
    {
        "title": "A Sociable Environment",
        "sub": "Bespoke sofa, hand-knotted artisan rug, sculptural lighting and collectible furniture.",
        "image": "bespoke-sofa_gxidtx",
        "caption": "An Inviting Lounge Area — bespoke seating, sculptural lighting, hand-knotted rug.",
        "views": "An Inviting Lounge Area · A Sophisticated Living Room · Panoramic Cityscape Views · A Sun Lit Reading Corner",
        "designers": [
            "Alexander Lamont", "Apparatus", "Atelier Février", "Cazes &amp; Conquet",
            "Emanuelle Levet Stenne", "Emmanuel Babled", "Eric Schmitt Studio",
            "Garnier &amp; Linker", "Gianfranco Frattini for Poltrona Frau",
            "Haas Brothers for L'Objet", "Iksel", "Jean-Michel Frank",
            "Jindrich Halabala", "Leo Sentou", "Maarten Vrolijk", "Matthieu Gicquel",
            "Olivia Cognet", "Robicara", "Stéphane CG", "Thierry Lemaire",
        ],
    },
    {
        "title": "An Intimate Setting",
        "sub": "Custom dining furniture, hand-blown glass pendants, sculptural seating and artisan accessories.",
        "image": "intimate-dining_ux4pee",
        "caption": "A Highly Customised Dining Room — Astra dining table, Murano cloud pendants.",
        "views": "A Dreamy Tuscan Landscape · A Highly Customised Dining Room · A Relaxed Setting · A Colourful Nook",
        "designers": [
            "Alinea", "Atelier Pendhapa", "Bina Baitel", "Forest &amp; Giaconia",
            "Hamrei", "Jeremy Maxwell Wintrebert", "Kiko Lopez", "Milan Pekař",
            "Pierre Frey", "Takayokaya",
        ],
    },
    {
        "title": "A Personal Sanctuary",
        "sub": "Bespoke marquetry desk, hand-blown glass chandelier, artisan suede lamp and bronze painting.",
        "image": "boudoir_ll5spn",
        "caption": "A Sophisticated Boudoir — Lyric marquetry desk, custom Saint-Just glass chandelier.",
        "views": "A Sophisticated Boudoir · A Jewelry Box Like Setting · A Serene Decor · A Design Treasure Trove",
        "designers": [
            "Alexander Lamont", "Apparatus", "Baleri Italia", "BdM",
            "Félix Agostini — Charles Paris", "Hamrei", "Made in Kira",
            "Nathalie Ziegler", "Nika Zupanc", "Pierre Bonnefille",
        ],
    },
    {
        "title": "A Calming and Dreamy Environment",
        "sub": "Curated collectibles, hand-carved furniture and hand-knotted silk rugs.",
        "image": "master-suite_y6jaix",
        "caption": "A Masterful Suite — bronze MicMac chandelier, custom Giudecca rug, Brunelleschi wallcover.",
        "views": "A Masterful Suite · Design Tableau · A Venitian Cocoon · Unique By Design Vignette",
        "designers": [
            "Adam Courts for Okha", "Atelier Demichelis", "CC-Tapis", "Celso de Lemos",
            "Damien Langlois-Meurinne", "Dan Yeffet", "Gallery S.Bensimon",
            "Hervé van der Straeten", "Iksel", "Kiko Lopez", "Milan Pekař",
            "Peter Reed 1861", "Pierre Frey", "Pinton 1867", "Toni Grilo",
            "Zanellato and Bortotto for CC-Tapis",
        ],
    },
    {
        "title": "A Small Room with Massive Personality",
        "sub": "Bold statement pieces, artisan craftsmanship and curated collectibles.",
        "image": "AffluencySG_094-Bloom_35_color_gimp_correction_okyphd",
        "caption": "An Artistic Statement — a compact room carried by scale, colour and craft.",
        "views": "An Artistic Statement · Compact Elegance · Yellow Crystalline · Golden Hour",
        "designers": [
            "Apparatus", "Felix Millory for Entrelacs", "Jaime Hayon", "Milan Pekař",
            "Peter Reed 1861", "Pierre Frey", "Reda Amalou", "Yabu Pushelberg",
        ],
    },
    {
        "title": "Home Office with a View",
        "sub": "Sculptural desk, refined lighting and curated accessories for a workspace of distinction.",
        "image": "home-office-desk_g0ywv2",
        "caption": "A Workspace of Distinction — desk, task lighting and a wall of design monographs.",
        "views": "A Workspace of Distinction · Refined Details · Light &amp; Focus · Design &amp; Fine Art Books Corner",
        "designers": [
            "Bernt Petersen", "Charles &amp; Ray Eames for Vitra",
            "Kelly Boukobza for Entrelacs", "Mernøe", "RoWin' Atelier", "Tristan Auer",
        ],
    },
    {
        "title": "The Details Make the Design",
        "sub": "The details are not the details. They make the design.",
        "image": "IMG_2397-resized_rufbef",
        "caption": "Craftsmanship at every corner — lacquer, bronze, glass and hand-thrown ceramic.",
        "views": "Curated Vignette · The Details Make The Design · Light &amp; Texture · Craftsmanship At Every Corner",
        "designers": [
            "Alexander Lamont", "Gianfranco Frattini for Poltrona Frau", "Jaime Hayon",
            "Jindrich Halabala", "Maarten Vrolijk", "Marcantonio Brandolini D'Adda",
            "Matthieu Gicquel", "Milan Pekař", "Noé Duchaufour-Lawrance", "Robicara",
            "Thierry Lemaire",
        ],
    },
]

ALL_DESIGNERS = sorted({d for r in ROOMS for d in r["designers"]}, key=lambda s: s.lower())


def room_blocks() -> list:
    blocks: list = []
    for room in ROOMS:
        blocks.append(("pagebreak",))
        blocks.append(("h", room["title"]))
        blocks.append(("p", f"<i>{room['sub']}</i>"))
        blocks.append(("image", img(room["image"]), room["caption"]))
        blocks.append(("table", [
            ("Views in this sequence", room["views"]),
            ("Designers &amp; ateliers", ", ".join(room["designers"])),
        ]))
    return blocks


def designer_columns() -> list:
    """Flat alphabetical roster."""
    return ALL_DESIGNERS


SECTIONS = [
    {
        "title": "The Commission",
        "blocks": [
            ("lede", "A high-floor Singapore residence, shaped over many months around its "
                     "owners, its skyline and a tightly edited cast of collectible pieces."),
            ("image", img("living-room-hero_zxfcxl"),
             "The principal living space — bespoke seating, hand-painted wallcovering and a curated cast of signed works."),
            ("p", "This brochure documents a fully realised Maison Affluency commission in Singapore. "
                  "The interior moves through entry, living, dining, study and primary suite, pausing on "
                  "the materials, joinery and proportions that anchor the project: hand-rubbed lacquer, "
                  "woven shagreen, blackened bronze, raw silk, hand-tufted wool."),
            ("p", "Every object is a curated choice, not a catalogue pick. The sofas are bespoke; the "
                  "lighting is sculptural; the case goods are signed works by independent ateliers we "
                  "represent. The result reads as a private collection — quiet, layered, deeply personal — "
                  "rather than a showroom."),
            ("table", [
                ("Project", "Private residence, high-floor apartment"),
                ("Location", "Marina Bay, Singapore"),
                ("Scope", "Curation, bespoke commissioning, production management, freight, white-glove delivery and installation"),
                ("Built-in joinery", "Fumed oak and bronze, developed with the project architect"),
                ("Sourcing", "Ateliers in Paris, Milan, Kyoto and New York"),
                ("Sequences documented", "7 rooms · 28 photographed views"),
                ("Designers represented", f"{len(ALL_DESIGNERS)} designers and ateliers in this apartment"),
            ]),
            ("callout", "For architects and interior designers",
             "The brief asked for an interior that felt collected rather than decorated — pieces that "
             "would age, patinate and earn their place over the next decade. Several works were "
             "commissioned specifically for this apartment."),
        ],
    },
    {
        "title": "Working With the Architecture",
        "blocks": [
            ("p", "We join a project after the plan is set and before the millwork is fixed. That timing "
                  "matters: seating depth, pendant drop, rug dimension and case-good height are resolved "
                  "against the built form rather than retrofitted to it."),
            ("h", "Where we plug into the programme"),
            ("table", [
                ("Concept", "A focused edit of pieces against the brief, budget and site — usually one to three options per position."),
                ("Design development", "Dimensioned drawings, finish samples and lead times issued as a specification schedule for coordination with joinery and lighting packages."),
                ("Tender", "Net trade pricing, contract-grade confirmation and shipping estimates per line."),
                ("Production", "Bespoke sizes, finishes and one-of-one commissions managed directly with the atelier."),
                ("Delivery", "Consolidated freight, customs, white-glove installation and snagging on site."),
            ]),
            ("h", "Technical documentation issued to the design team"),
            ("p", "Every piece in this apartment is backed by a specification record: dimensions in "
                  "millimetres and inches, seat heights, materials and available finishes, lead-time "
                  "range, contract-grade status, SKU, imagery and — where the atelier supplies it — "
                  "CAD, 3D models and PDF spec sheets. Trade documentation can be issued white-labelled "
                  "for inclusion in your own tender pack."),
            ("callout", "Bespoke is the default, not the exception",
             "Sofas, rugs, wallcoverings and case goods in this project were made to project dimensions. "
             "Where an atelier works to order, we treat the catalogue size as a starting point."),
        ],
    },
    {
        "title": "The Apartment, Room by Room",
        "blocks": [
            ("lede", "Seven sequences, twenty-eight photographed views — each room is documented "
                     "with the designers and ateliers represented in it."),
            ("p", "The apartment is read as a walk rather than a set of plans: an inviting lounge "
                  "opening onto the skyline, a dining room built around a hand-painted landscape, a "
                  "boudoir treated as a jewellery box, a primary suite in silk and bronze, a compact "
                  "guest room carried by colour, a study with a wall of monographs, and finally the "
                  "details that hold the whole together."),
            ("p", "For each sequence below: the photographed views, and the full list of designers "
                  "and ateliers whose work appears in that room. Every piece is catalogued online "
                  "with dimensions, materials, finishes and lead times."),
        ] + room_blocks(),
    },
    {
        "title": "Designers &amp; Ateliers in This Apartment",
        "blocks": [
            ("p", f"The commission draws on {len(ALL_DESIGNERS)} designers, ateliers and editions — "
                  "historic houses alongside contemporary independents, several represented exclusively "
                  "in the region. Full biographies, provenance notes and the complete catalogue are "
                  "published on maisonaffluency.com/designers."),
            ("p", "  ·  ".join(designer_columns())),
            ("h", "How the roster is built"),
            ("p", "We represent makers, not distributors. Selection favours ateliers with a signature "
                  "material discipline — glass, bronze, lacquer, ceramic, marquetry, hand-knotting — and "
                  "the workshop capacity to take a bespoke brief. Historic editions are included only "
                  "where production remains authentic to the original drawings."),
        ],
    },
    {
        "title": "Brand Philosophy",
        "blocks": [
            ("lede", "We act as the editorial layer between collectors, interior designers and a roster "
                     "of European, Japanese and American makers."),
            ("h", "An interior should read as a collection"),
            ("p", "A room assembled from a single catalogue reads as a scheme. A room assembled from "
                  "signed works — with different hands, different decades and different materials in "
                  "conversation — reads as a life. Our editing is subtractive: fewer pieces, better "
                  "provenance, more space between them."),
            ("h", "Provenance over volume"),
            ("p", "Each piece carries a maker, a workshop and a technique we can name. Where a work is "
                  "unique or a limited edition, it is documented as such. Nothing in this apartment is "
                  "anonymous."),
            ("h", "Material honesty"),
            ("p", "Hand-rubbed lacquer, woven shagreen, blackened bronze, raw silk and hand-tufted wool "
                  "are specified because they age well — they patinate rather than degrade. We advise "
                  "against finishes that photograph well on day one and fail in year five."),
            ("h", "Discretion"),
            ("p", "Private commissions are documented only with the client's consent, and pricing is "
                  "never published on public surfaces. Public catalogue pages show <b>Price upon "
                  "Request</b>; net pricing is released through the trade programme."),
            ("callout", "One commission, end to end",
             "Brief, budget and site in; a focused edit, production management, freight, white-glove "
             "delivery and installation out. The apartment in this brochure is that process applied "
             "from first drawing to final snag."),
        ],
    },
    {
        "title": "Working With Maison Affluency",
        "blocks": [
            ("h", "The trade programme"),
            ("p", "Architects and interior designers registering with the trade programme receive net "
                  "pricing, technical drawings and CAD assets, bespoke quoting, FF&amp;E schedules, "
                  "tearsheet and presentation builders, and white-labelled client documentation."),
            ("table", [
                ("Trade programme", "maisonaffluency.com/trade-program"),
                ("Represented designers", "maisonaffluency.com/designers"),
                ("The apartment film", "maisonaffluency.com/apartment-tour"),
                ("Showroom gallery", "maisonaffluency.com/gallery"),
                ("Private tour", "By appointment — Singapore"),
                ("Enquiries", "maisonaffluency.com/contact"),
            ]),
            ("h", "Request a private tour"),
            ("p", "The residence and the Singapore gallery can be visited by appointment. We recommend "
                  "bringing plans: most conversations move quickly from what is on display to what "
                  "could be made for your project."),
            ("callout", "Next step",
             "Send a plan, a budget range and a date. We return a focused edit with lead times and net "
             "pricing, ready to drop into your specification."),
        ],
    },
]


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else \
        "/mnt/documents/maison-affluency-apartment-showcase-brochure.pdf"
    build_guide(
        filename=out,
        title="A Private Apartment in Singapore",
        subtitle="An architect's brochure — the commission, the rooms, the designers and the "
                 "philosophy behind a fully curated residence.",
        running="Apartment Showcase — For Architects",
        version="ARCHITECT BROCHURE · 2026",
        kicker="ARCHITECTS  ·  APARTMENT SHOWCASE",
        header_label="MAISON AFFLUENCY  ·  APARTMENT SHOWCASE",
        sections=SECTIONS,
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
