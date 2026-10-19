import { Helmet } from 'react-helmet-async';
import { roomCollections, roomCollectionPath, type CollectionRoom } from '@/lib/roomCollections';
import living from '@/assets/living-room-hero.jpg';
import dining from '@/assets/intimate-dining.jpg';
import bedroom from '@/assets/master-suite.jpg';
import office from '@/assets/home-office-desk.jpg';
import outdoor from '@/assets/outdoor-room-collection.jpg';

const pictures = { 'living-room': living, 'dining-room': dining, bedroom, office, outdoor };
export default function RoomCollectionStory({ room, trade }: { room: CollectionRoom; trade: boolean }) {
  const collection = roomCollections[room];
  const title = `${collection.name} Collection | Maison Affluency`;
  return <>
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={`${collection.mood}. Explore the ${collection.name.toLowerCase()} collection, collectible furniture, finishes and considered room pairings at Maison Affluency.`} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={collection.story} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`https://www.maisonaffluency.com${roomCollectionPath(room, trade)}`} />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>
    <section aria-label={`${collection.name} collection`} className="relative w-full overflow-hidden bg-[hsl(var(--lookbook-bg))]">
      <img src={pictures[room]} alt={`${collection.name} interior inspiration`} width={1536} height={1024} fetchPriority="high" className="h-[48vh] min-h-[320px] max-h-[600px] w-full object-cover md:h-[52vh]" />
      <div className="absolute inset-0 bg-[image:var(--lookbook-overlay)]" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1500px] px-6 pb-8 md:pb-12">
        <p className="font-body text-xs uppercase tracking-widest !text-[hsl(var(--lookbook-foreground))]">Maison Affluency · Room Collections</p>
        <h1 className="mt-3 font-display text-4xl !text-[hsl(var(--lookbook-foreground))] md:text-6xl">{collection.name}</h1>
        <p className="mt-4 font-body text-base !text-[hsl(var(--lookbook-foreground))] md:text-lg">{collection.mood}</p>
      </div>
    </section>
    <section aria-label="Design story" className="mx-auto grid w-full max-w-[1500px] gap-6 border-b border-border px-6 py-8 md:grid-cols-[1fr_2fr] md:gap-12 md:py-12">
      <h2 className="font-display text-2xl">The design story</h2>
      <div className="max-w-3xl space-y-4 font-body text-sm leading-relaxed text-muted-foreground"><p>{collection.story}</p><p>{collection.detail}</p>{room === 'outdoor' && <p className="text-xs">Concept imagery; furniture shown is illustrative.</p>}</div>
    </section>
  </>;
}