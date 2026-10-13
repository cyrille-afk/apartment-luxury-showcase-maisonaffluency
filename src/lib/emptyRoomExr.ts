export const EMPTY_ROOM_EXR_PATH = "/images/_empty_room_3.exr";

/** EXR files begin with the magic bytes 0x76 0x2e 0x31 0x01 ("v.1\x01"). */
const EXR_MAGIC = [0x76, 0x2e, 0x31, 0x01];

export type EmptyRoomExrResult =
  | { state: "ok"; buffer: ArrayBuffer; bytes: number }
  | { state: "missing" }
  | { state: "unreadable"; reason: string };

/**
 * Confirms the empty-room HDRI is present and readable before it is parsed:
 * reachable, served with 200, and starting with the EXR magic bytes.
 */
export async function validateEmptyRoomExr(path: string = EMPTY_ROOM_EXR_PATH): Promise<EmptyRoomExrResult> {
  // A file uploaded from this browser takes precedence over the shared one.
  if (typeof indexedDB !== "undefined") {
    const { getLocalExr } = await import("./localEnvironmentExr");
    const local = await getLocalExr();
    if (local) return { state: "ok", buffer: local.buffer.slice(0), bytes: local.buffer.byteLength };
  }
  let response: Response;
  try {
    response = await fetch(path, { headers: { Accept: "image/x-exr,application/octet-stream" } });
  } catch {
    return { state: "missing" };
  }
  if (!response.ok) return { state: "missing" };
  // SPA hosts answer unknown paths with the app shell (200, text/html) — that is not the file.
  if ((response.headers.get("content-type") ?? "").includes("text/html")) return { state: "missing" };
  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return { state: "unreadable", reason: "response body could not be read" };
  }
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (buffer.byteLength < 8 || !EXR_MAGIC.every((byte, index) => head[index] === byte)) {
    return { state: "unreadable", reason: "file does not start with EXR magic bytes" };
  }
  return { state: "ok", buffer, bytes: buffer.byteLength };
}
