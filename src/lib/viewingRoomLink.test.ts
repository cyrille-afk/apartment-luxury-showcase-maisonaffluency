import { describe, expect, it } from "vitest";
import { viewingRoomAccessToken, viewingRoomPath } from "./viewingRoomLink";

const token = "09320ae7-37f8-47e8-88a8-4910f0c8bb53";
describe("private viewing room addresses", () => {
  it("names Cipriani residences apartments while retaining the full credential", () => {
    expect(viewingRoomPath("Cipriani Residences", token)).toBe(`/viewing-room/cipriani-residences-apartments--${token}`);
  });
  it("resolves named addresses to the original access credential", () => {
    expect(viewingRoomAccessToken(viewingRoomPath("Cipriani Residences", token).split("/").pop() ?? "")).toBe(token);
  });
  it("keeps previously shared UUID addresses working", () => {
    expect(viewingRoomAccessToken(token)).toBe(token);
  });
  it("never grants access using the readable name alone", () => {
    expect(viewingRoomAccessToken("cipriani-residences-apartments")).not.toBe(token);
  });
});