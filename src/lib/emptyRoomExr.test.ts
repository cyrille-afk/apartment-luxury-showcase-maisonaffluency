import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_ROOM_EXR_PATH, validateEmptyRoomExr } from "./emptyRoomExr";

const EXR_HEAD = new Uint8Array([0x76, 0x2e, 0x31, 0x01, 0x02, 0x00, 0x00, 0x00]);
const NOT_EXR = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function stubFetch(handler: (path: string) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (path: string) => handler(path)));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateEmptyRoomExr", () => {
  it("accepts a reachable file that starts with EXR magic bytes", async () => {
    stubFetch(async () => new Response(EXR_HEAD));
    const result = await validateEmptyRoomExr();
    expect(result.state).toBe("ok");
    if (result.state === "ok") expect(result.bytes).toBe(8);
  });

  it("reports missing when the file is not served (404)", async () => {
    stubFetch(async () => new Response("", { status: 404 }));
    const result = await validateEmptyRoomExr();
    expect(result.state).toBe("missing");
  });

  it("reports missing when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network down"); }));
    const result = await validateEmptyRoomExr();
    expect(result.state).toBe("missing");
  });

  it("rejects a non-EXR payload served at the path", async () => {
    stubFetch(async () => new Response(NOT_EXR));
    const result = await validateEmptyRoomExr();
    expect(result.state).toBe("unreadable");
  });

  it("rejects a truncated payload without the full magic", async () => {
    stubFetch(async () => new Response(new Uint8Array([0x76, 0x2e])));
    const result = await validateEmptyRoomExr();
    expect(result.state).toBe("unreadable");
  });

  it("checks the deployed path", async () => {
    let requested: string | null = null;
    stubFetch(async (path) => { requested = path; return new Response(EXR_HEAD); });
    await validateEmptyRoomExr();
    expect(requested).toBe(EMPTY_ROOM_EXR_PATH);
  });
});
