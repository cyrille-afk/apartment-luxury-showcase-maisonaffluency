import { createFileRoute, redirect } from '@tanstack/react-router';
import { redeemViewingRoomAccess } from '@/lib/viewingRoom.functions';
import { isShortViewingRoomCode } from '@/lib/viewingRoomLink';

export const Route = createFileRoute('/r/$shortCode')({
  beforeLoad: async ({ params }) => {
    if (!isShortViewingRoomCode(params.shortCode)) return;
    const access = await redeemViewingRoomAccess({ data: { token: params.shortCode.toUpperCase() } });
    if (access) throw redirect({ href: access.path, replace: true });
  },
  head: () => ({ meta: [
    { title: 'Private Invitation | Maison Affluency' },
    { name: 'description', content: 'Your private Maison Affluency residence invitation.' },
    { property: 'og:title', content: 'Private Invitation | Maison Affluency' },
    { property: 'og:description', content: 'A private residence and collectible interiors invitation.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: () => <main className="viewing-room min-h-screen bg-background px-6 py-20 text-center text-foreground"><h1 className="font-display text-3xl">This private viewing room is unavailable</h1><p className="mt-5 text-muted-foreground">Please request a current invitation from your Maison Affluency contact.</p></main>,
});