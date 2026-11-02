/**
 * Height of the last fully rendered Trade page. Loading screens shown between
 * Trade pages keep this height so the browser never snaps the window up
 * before the next page (e.g. a product) appears.
 */
let heldHeight = 0;
export const setHeldTradePageHeight = (height: number) => { heldHeight = height; };
export const heldTradePageHeight = () => heldHeight;
