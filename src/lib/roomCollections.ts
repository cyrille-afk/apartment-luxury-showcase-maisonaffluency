import type { RoomSlug } from './roomCategories';

export const roomCollections = {
  'living-room': { name: 'Living Room', mood: 'Conversation, comfort, character', story: 'A living room takes shape around the way people gather. Generous seating establishes its rhythm; a sculptural table gives it a centre of gravity. Light, texture and the spaces between pieces make the composition feel collected rather than prescribed.', detail: 'Balance a softly upholstered anchor with a more architectural companion. Let a rug unite the seating, then introduce lighting at different heights for an intimate evening atmosphere.' },
  'dining-room': { name: 'Dining Room', mood: 'The art of gathering', story: 'The dining table is both a daily ritual and an occasion. Its proportions set the tone, while chairs, a considered light and quiet storage create an ensemble that welcomes long conversations.', detail: 'Give the table room to breathe. Contrast its material with the seating, and keep the light in dialogue with the tabletop rather than competing with it.' },
  bedroom: { name: 'Bedroom', mood: 'A quieter kind of luxury', story: 'A bedroom finds its character in restraint. A bed with presence, tactile bedside pieces and gentle pools of light establish a retreat without turning it into a perfectly matched suite.', detail: 'Build from a calm material palette. Use bedside lighting for intimacy and a considered chair or bench to bring another scale to the room.' },
  office: { name: 'Home Office', mood: 'Space for clear thinking', story: 'A considered workspace balances purpose with personality. The desk anchors the room; seating, storage and a precise light support a place for focused work and unhurried reflection.', detail: 'Choose proportions that leave the working surface uncluttered. Bring warmth through timber and upholstery, with storage that feels part of the architecture.' },
  outdoor: { name: 'Outdoor', mood: 'Living beyond the walls', story: 'Outdoor rooms extend the rituals of home into open air. Relaxed seating and generous tables create places to gather, while sculptural forms establish a dialogue with planting, stone and changing daylight.', detail: 'Think in zones for lounging and dining. Confirm each piece’s outdoor suitability and material care before specifying it for an exposed setting.' },
} satisfies Partial<Record<RoomSlug, { name: string; mood: string; story: string; detail: string }>>;

export type CollectionRoom = keyof typeof roomCollections;
export function isCollectionRoom(value: string | null | undefined): value is CollectionRoom {
  return !!value && Object.prototype.hasOwnProperty.call(roomCollections, value);
}
export function roomCollectionPath(room: CollectionRoom, trade = false) {
  return `${trade ? '/trade' : ''}/shop-by-room/${room}`;
}