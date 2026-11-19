import { describe, expect, it } from "vitest";
import { viewingRoomAccessToken, viewingRoomPath, isLegacyViewingRoomLink, viewingRoomCookieName } from "./viewingRoomLink";

const token = "09320ae7-37f8-47e8-88a8-4910f0c8bb53";
describe("private viewing room addresses", () => {
  it("brands the address without exposing its credential", () => {
    expect(viewingRoomPath("Cipriani Residences Miami")).toBe("/viewing-room/cipriani-residences-miami");
    expect(viewingRoomPath("Cipriani Residences")).toBe("/viewing-room/cipriani-residences-apartments");
  });
  it("resolves named addresses to the original access credential", () => {
    expect(viewingRoomAccessToken(`cipriani-residences--${token}`)).toBe(token);
  });
  it("keeps previously shared UUID addresses working", () => {
    expect(viewingRoomAccessToken(token)).toBe(token);
  });
  it("never grants access using the readable name alone", () => {
    expect(viewingRoomAccessToken("cipriani-residences-apartments")).not.toBe(token);
    expect(isLegacyViewingRoomLink("cipriani-residences-apartments")).toBe(false);
    expect(isLegacyViewingRoomLink(token)).toBe(true);
    expect(viewingRoomCookieName("cipriani-residences-miami")).not.toBe(viewingRoomCookieName("other-residences"));
  });
});