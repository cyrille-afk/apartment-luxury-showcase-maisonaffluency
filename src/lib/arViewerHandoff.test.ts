import { describe, expect, it } from "vitest";
import { arViewerUrl, readArViewerHandoff } from "./arViewerHandoff";

describe("AR selected-finish handoff", () => {
  it("carries selected upholstery and independent backrest/frame names without any prices", () => {
    const selection = { kind: "board" as const, id: "gum", finish: "Seat Upholstery: EDSON 008 Charbon · Backrest Upholstery: Tundra 603 · Frame Finish: Smooth Oak", top: "EDSON 008 Charbon", base: "Smooth Oak" };
    const url = arViewerUrl("http://localhost:8080/trade/boards/cipriani?project=miami#finishes", selection);
    expect(new URL(url).origin).toBe("https://www.maisonaffluency.com");
    expect(new URL(url).searchParams.get("project")).toBe("miami");
    expect(readArViewerHandoff(url)).toEqual(selection);
    expect(url).not.toContain("price");
  });
  it("keeps exact private-room finish, size and colour identifiers for catalogue revalidation", () => {
    const selection = { kind: "viewing-room" as const, id: "sofa-slot", context: "bespoke", product: "sofa", finish: "opera", size: "250", colour: "delft", axes: { backrest: "603" } };
    expect(readArViewerHandoff(arViewerUrl("https://www.maisonaffluency.com/viewing-room/cipriani?layout=penthouse&package=bespoke", selection))).toEqual(selection);
  });
  it("rejects malformed or oversized handoffs and strips unknown price fields", () => {
    expect(readArViewerHandoff("https://www.maisonaffluency.com/?arPreview=not-json")).toBeNull();
    expect(readArViewerHandoff(`https://www.maisonaffluency.com/?arPreview=${"a".repeat(2501)}`)).toBeNull();
    const incoming = encodeURIComponent(JSON.stringify({ kind: "board", id: "gum", top: "Charbon", price: 1, texture: "https://untrusted.test/image" }));
    expect(readArViewerHandoff(`https://www.maisonaffluency.com/?arPreview=${incoming}`)).toEqual({ kind: "board", id: "gum", top: "Charbon" });
  });
});