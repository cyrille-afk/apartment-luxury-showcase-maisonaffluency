import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ProductGrid from "@/components/ProductGrid";
import { isRoomSlug, ROOM_LABELS } from "@/lib/roomCategories";

export default function RoomSearch() {
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get("room");
  const room = isRoomSlug(roomParam) ? roomParam : null;
  const roomLabel = room ? ROOM_LABELS[room] : "Room not found";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{room ? `${roomLabel} Furniture` : "Room Search"} — Maison Affluency</title>
        <meta
          name="description"
          content={room
            ? `Explore collectible furniture and lighting selected for the ${roomLabel.toLowerCase()}.`
            : "Explore collectible furniture and lighting by room."}
        />
      </Helmet>
      <Navigation alwaysVisible />
      <main className="min-h-[70vh] pt-[var(--header-h)]">
        {room ? (
          <ProductGrid roomSlug={room} />
        ) : (
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h1 className="font-display text-3xl text-foreground">Room not found</h1>
            <p className="mt-3 font-body text-sm text-muted-foreground">
              Choose a room from the Categories menu to browse the collection.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
