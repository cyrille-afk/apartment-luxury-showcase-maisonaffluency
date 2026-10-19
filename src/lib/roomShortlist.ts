import { z } from 'zod';
import type { RoomSlug } from './roomCategories';

export const roomShortlistItemSchema = z.object({
  id: z.string().min(1), product_name: z.string().min(1), brand_name: z.string(),
  image_url: z.string().nullable(), category: z.string().optional(),
  dimensions: z.string().optional(), materials: z.string().optional(),
  lead_time: z.string().nullable().optional(), public_url: z.string().nullable().optional(),
});
export type RoomShortlistItem = z.infer<typeof roomShortlistItemSchema>;
export function shortlistItems(value: unknown): RoomShortlistItem[] {
  const parsed = z.array(roomShortlistItemSchema).safeParse(value);
  return parsed.success ? [...new Map(parsed.data.map(item => [item.id, item])).values()] : [];
}
export function toggleShortlistItem(items: RoomShortlistItem[], item: RoomShortlistItem) {
  return items.some(p => p.id === item.id) ? items.filter(p => p.id !== item.id) : [...items, roomShortlistItemSchema.parse(item)];
}
export const roomShortlistDraftKey = (room: RoomSlug, userId?: string) => `ma-room-shortlist-v1:${userId || 'guest'}:${room}`;
export const SHORTLIST_CONTACT_DEFAULTS = { conciergeEmail: 'concierge@maisonaffluency.com', website: 'maisonaffluency.com', availability: 'By appointment, worldwide' };
export type RoomShortlistCover = { clientName: string; projectTitle: string; introduction: string; closingMessage: string; conciergeEmail: string; website: string; availability: string };
export function shortlistCover(value: unknown): RoomShortlistCover {
  const parsed = z.object({ clientName: z.string().catch(''), projectTitle: z.string().catch(''), introduction: z.string().catch(''), closingMessage: z.string().catch(''), conciergeEmail: z.string().catch(SHORTLIST_CONTACT_DEFAULTS.conciergeEmail), website: z.string().catch(SHORTLIST_CONTACT_DEFAULTS.website), availability: z.string().catch(SHORTLIST_CONTACT_DEFAULTS.availability) }).safeParse(value);
  return parsed.success ? parsed.data : { clientName: '', projectTitle: '', introduction: '', closingMessage: '', ...SHORTLIST_CONTACT_DEFAULTS };
}
export function shortlistContact(cover: RoomShortlistCover) {
  const conciergeEmail = cover.conciergeEmail.trim() || SHORTLIST_CONTACT_DEFAULTS.conciergeEmail;
  const website = cover.website.trim() || SHORTLIST_CONTACT_DEFAULTS.website;
  const availability = cover.availability.trim() || SHORTLIST_CONTACT_DEFAULTS.availability;
  let websiteUrl: string | undefined;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(website) ? website : `https://${website}`);
    if (url.protocol === 'https:' || url.protocol === 'http:') websiteUrl = url.href;
  } catch { /* Keep invalid addresses as plain text rather than unsafe links. */ }
  const emailUrl = z.string().email().safeParse(conciergeEmail).success ? `mailto:${conciergeEmail}` : undefined;
  return { conciergeEmail, website, availability, emailUrl, websiteUrl };
}
export const shortlistCoverKey = (key: string, savedId?: string) => `${key}:pdf-cover:${savedId || 'draft'}`;
