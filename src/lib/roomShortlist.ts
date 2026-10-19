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
export type RoomShortlistCover = { clientName: string; projectTitle: string; introduction: string };
export function shortlistCover(value: unknown): RoomShortlistCover {
  const parsed = z.object({ clientName: z.string().catch(''), projectTitle: z.string().catch(''), introduction: z.string().catch('') }).safeParse(value);
  return { clientName: parsed.success ? parsed.data.clientName || '' : '', projectTitle: parsed.success ? parsed.data.projectTitle || '' : '', introduction: parsed.success ? parsed.data.introduction || '' : '' };
}
export const shortlistCoverKey = (key: string, savedId?: string) => `${key}:pdf-cover:${savedId || 'draft'}`;
