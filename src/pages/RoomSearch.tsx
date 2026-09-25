import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { resolveRoomSlug, ROOM_LABELS, type RoomSlug } from "@/lib/roomCategories";
import livingRoom from "@/assets/living-room-hero.jpg";
import bespokeSofa from "@/assets/bespoke-sofa.jpg";
import intimateLounge from "@/assets/intimate-lounge.jpg";
import intimateDining from "@/assets/intimate-dining.jpg";
import diningRoom from "@/assets/dining-room.jpg";
import intimateTable from "@/assets/intimate-table-detail.jpg";
import masterSuite from "@/assets/master-suite.jpg";
import bedroomAlt from "@/assets/bedroom-alt.jpg";
import boudoir from "@/assets/boudoir.jpg";
import homeOffice from "@/assets/home-office-desk.jpg";
import homeOfficeSecond from "@/assets/home-office-desk-2.jpg";
import officeBooks from "@/assets/gallery/office-books-corner.jpg";
import detailsLamp from "@/assets/details-lamp.jpg";
import detailsSection from "@/assets/details-section.jpg";

type LookbookSlide = { image: string; title: string; alt: string };

const ROOM_RIBBON: { slug: RoomSlug; label: string }[] = [
  { slug: "estates", label: "Estates" },
  { slug: "living-room", label: "Living" },
  { slug: "dining-room", label: "Dining" },
  { slug: "bedroom", label: "Bedroom" },
  { slug: "bath", label: "Bath" },
  { slug: "office", label: "Home Office" },
  { slug: "lighting", label: "Lighting" },
  { slug: "outdoor", label: "Outdoor" },
  { slug: "modern", label: "Modern" },
];

const SLIDES: Record<RoomSlug, LookbookSlide[]> = {
  estates: [
    { image: "/images/maison-de-verre-chareau-real.jpg", title: "The Private Residence", alt: "Architectural glass house interior" },
    { image: livingRoom, title: "A Collected Interior", alt: "Sculptural furniture in an architectural residence" },
    { image: intimateDining, title: "Rooms for Gathering", alt: "Curated dining environment with collectible furniture" },
  ],
  "living-room": [
    { image: livingRoom, title: "Grand Salon", alt: "Sculptural furniture in a grand living room" },
    { image: bespokeSofa, title: "The Art of Conversation", alt: "Bespoke sofa in an inviting lounge" },
    { image: intimateLounge, title: "An Intimate Salon", alt: "Intimate lounge with collectible design" },
  ],
  "dining-room": [
    { image: intimateDining, title: "The Dining Room", alt: "Atmospheric dining room with collectible furniture" },
    { image: diningRoom, title: "Dining Above the City", alt: "Dining room overlooking the city" },
    { image: intimateTable, title: "A Table of Distinction", alt: "Detailed view of a custom dining table" },
  ],
  bedroom: [
    { image: masterSuite, title: "The Private Suite", alt: "Calm bedroom with layered natural materials" },
    { image: bedroomAlt, title: "A Quiet Retreat", alt: "Curated bedroom retreat" },
    { image: boudoir, title: "The Boudoir", alt: "Sophisticated boudoir with sculptural furnishings" },
  ],
  bath: [
    { image: "/gallery/sanctuary-2.jpg", title: "The Bathing Room", alt: "Private bath sanctuary" },
    { image: detailsSection, title: "Material Ritual", alt: "Refined interior details and natural materials" },
  ],
  office: [
    { image: homeOffice, title: "The Private Study", alt: "Sculptural desk in a refined home office" },
    { image: homeOfficeSecond, title: "A Workspace of Distinction", alt: "Elegant home office with collectible furniture" },
    { image: officeBooks, title: "The Library", alt: "Design and fine art books in a quiet office" },
  ],
  lighting: [
    { image: detailsLamp, title: "Light as Sculpture", alt: "Sculptural lamp in an atmospheric interior" },
    { image: diningRoom, title: "Illuminated Dining", alt: "Sculptural lighting above a dining room" },
    { image: intimateLounge, title: "Ambient Light", alt: "Layered lighting in an intimate lounge" },
  ],
  outdoor: [
    { image: "/gallery/sociable-4.jpeg", title: "Open-Air Living", alt: "Outdoor setting designed for gathering" },
    { image: intimateDining, title: "Dining in the Landscape", alt: "Dining environment with landscape views" },
  ],
  modern: [
    { image: livingRoom, title: "Modern Living", alt: "Contemporary living room with collectible furniture" },
    { image: homeOfficeSecond, title: "Quiet Geometry", alt: "Modern interior shaped by refined geometry" },
    { image: bedroomAlt, title: "Modern Sanctuary", alt: "Modern bedroom with sculptural forms" },
  ],
};

export default function RoomSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomParam = searchParams.get("room");
  const room = resolveRoomSlug(roomParam);
  const roomLabel = room ? ROOM_LABELS[room] : "Room not found";
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = useMemo(() => room ? SLIDES[room] : [], [room]);

  useEffect(() => setSlideIndex(0), [room]);

  useEffect(() => {
    if (room && roomParam !== room) navigate(`/search?room=${room}`, { replace: true });
  }, [navigate, room, roomParam]);

  const changeSlide = useCallback((direction: number) => {
    if (!slides.length) return;
    setSlideIndex((current) => (current + direction + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") changeSlide(-1);
      if (event.key === "ArrowRight") changeSlide(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeSlide]);

  const activeSlide = slides[slideIndex];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{room ? `${roomLabel} Lookbook` : "Room Lookbook"} — Maison Affluency</title>
        <meta
          name="description"
          content={room
            ? `Explore Maison Affluency's curated ${roomLabel.toLowerCase()} environments.`
            : "Explore collectible design through curated room environments."}
        />
      </Helmet>
      <Navigation alwaysVisible />
      <main className="min-h-[70vh] pt-[var(--header-h)]">
        {room && activeSlide ? (
          <div className="bg-[hsl(var(--lookbook-bg))] text-[hsl(var(--lookbook-foreground))]">
            <nav aria-label="Explore rooms" className="border-y border-border bg-background">
              <div className="scrollbar-none mx-auto flex min-h-16 max-w-[1500px] items-center gap-7 overflow-x-auto px-6 md:justify-center md:gap-9 lg:gap-11">
                {ROOM_RIBBON.map((item) => (
                  <Button
                    key={item.slug}
                    type="button"
                    variant="ghost"
                    onClick={() => navigate(`/search?room=${item.slug}`)}
                    aria-current={room === item.slug ? "page" : undefined}
                    className={`relative h-16 shrink-0 rounded-none px-0 font-body text-[10px] font-medium uppercase tracking-[0.26em] hover:bg-transparent hover:text-foreground ${room === item.slug ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {item.label}
                    {room === item.slug && <span className="absolute inset-x-0 bottom-0 h-px bg-foreground" />}
                  </Button>
                ))}
              </div>
            </nav>

            <section
              aria-label={`${roomLabel} lookbook`}
              className="relative isolate min-h-[calc(100svh-var(--header-h)-4rem)] overflow-hidden bg-[hsl(var(--lookbook-bg))] md:min-h-[calc(100vh-var(--header-h)-4rem)]"
            >
              {slides.map((slide, index) => (
                <img
                  key={slide.image}
                  src={slide.image}
                  alt={slide.alt}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  className={`absolute inset-0 size-full object-cover object-center transition-[opacity,transform] duration-1000 motion-reduce:transition-none ${index === slideIndex ? "scale-100 opacity-100" : "scale-[1.015] opacity-0"}`}
                />
              ))}
              <div className="absolute inset-0 bg-[var(--lookbook-overlay)]" />

              <div className="relative z-10 flex min-h-[calc(100svh-var(--header-h)-4rem)] flex-col items-center justify-center px-16 py-24 text-center md:min-h-[calc(100vh-var(--header-h)-4rem)] md:px-24">
                <p className="mb-7 font-body text-[9px] font-light uppercase tracking-[0.5em] text-[hsl(var(--lookbook-muted))] md:text-[10px]">
                  Maison Affluency · Room {String(slideIndex + 1).padStart(2, "0")}
                </p>
                <h1 className="max-w-5xl font-display text-5xl font-normal italic leading-none tracking-normal text-[hsl(var(--lookbook-foreground))] sm:text-7xl md:text-8xl lg:text-9xl">
                  {activeSlide.title}
                </h1>
                <div className="mt-10 h-px w-16 bg-[hsl(var(--lookbook-foreground)/0.7)] md:mt-14" />
                <p className="mt-6 font-body text-[10px] font-light uppercase tracking-[0.38em] text-[hsl(var(--lookbook-muted))]">
                  {roomLabel}
                </p>
              </div>

              <Button type="button" variant="ghost" size="icon" onClick={() => changeSlide(-1)} aria-label="Previous room view" className="absolute left-3 top-1/2 z-20 h-12 w-12 -translate-y-1/2 rounded-none border border-[hsl(var(--lookbook-border))] bg-[hsl(var(--lookbook-bg)/0.18)] text-[hsl(var(--lookbook-foreground))] backdrop-blur-sm hover:bg-[hsl(var(--lookbook-bg)/0.45)] hover:text-[hsl(var(--lookbook-foreground))] md:left-8 md:h-14 md:w-14">
                <ChevronLeft className="size-5" strokeWidth={1} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => changeSlide(1)} aria-label="Next room view" className="absolute right-3 top-1/2 z-20 h-12 w-12 -translate-y-1/2 rounded-none border border-[hsl(var(--lookbook-border))] bg-[hsl(var(--lookbook-bg)/0.18)] text-[hsl(var(--lookbook-foreground))] backdrop-blur-sm hover:bg-[hsl(var(--lookbook-bg)/0.45)] hover:text-[hsl(var(--lookbook-foreground))] md:right-8 md:h-14 md:w-14">
                <ChevronRight className="size-5" strokeWidth={1} />
              </Button>

              <div className="absolute bottom-7 right-6 z-20 font-body text-[10px] uppercase tracking-[0.35em] text-[hsl(var(--lookbook-foreground))] md:bottom-10 md:right-10">
                {String(slideIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
              </div>
              <div className="absolute bottom-7 left-6 z-20 hidden font-body text-[9px] uppercase tracking-[0.32em] text-[hsl(var(--lookbook-muted))] md:block md:bottom-10 md:left-10">
                Curated environments · Singapore
              </div>
            </section>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h1 className="font-display text-3xl text-foreground">Room not found</h1>
            <p className="mt-3 font-body text-sm text-muted-foreground">
              Choose a room from the navigation to explore the lookbook.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
