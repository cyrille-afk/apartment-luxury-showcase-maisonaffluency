import { describe, expect, it } from "vitest";
import { checkViewingRoomDimensions } from "./viewingRoomDimensionCheck";
const expected = { w: 2, d: .5, h: .8 };
describe("pre-display furniture dimension check", () => {
  it("accepts correctly fitted furniture", () => expect(checkViewingRoomDimensions(expected, expected).status).toBe("verified"));
  it("flags a tenfold scale mismatch", () => expect(checkViewingRoomDimensions({ w: 20, d: 5, h: 8 }, expected).status).toBe("mismatch"));
  it("flags distorted depth even when width is correct", () => expect(checkViewingRoomDimensions({ ...expected, d: .9 }, expected).axes).toEqual(["d"]));
  it("allows modest measurement tolerance", () => expect(checkViewingRoomDimensions({ w: 2.2, d: .52, h: .82 }, expected).status).toBe("verified"));
  it("rejects invalid geometry bounds", () => expect(checkViewingRoomDimensions({ ...expected, h: NaN }, expected).status).toBe("invalid"));
  it("rejects empty geometry", () => expect(checkViewingRoomDimensions({ ...expected, w: 0 }, expected).status).toBe("invalid"));
  it("does not claim verification without recorded dimensions", () => expect(checkViewingRoomDimensions(expected, null).status).toBe("unconfirmed"));
});