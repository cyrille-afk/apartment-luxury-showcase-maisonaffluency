import { describe, it } from "vitest";
import { optimizeImageUrl } from "../cloudinary-optimize";

describe("debug fetch pipeline", () => {
  it("logs each step", async () => {
    const TINY = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgD//Z";
    const bin = atob(TINY); const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/jpeg" });
    globalThis.fetch = (async () => new Response(blob, { status: 200 })) as typeof fetch;
    console.log("optimized:", optimizeImageUrl("https://example.com/x.jpg", "w_400"));
    const res = await fetch("https://example.com/x.jpg");
    console.log("res.ok:", res.ok);
    const b = await res.blob();
    console.log("blob size/type:", b.size, b.type);
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(b);
    });
    console.log("dataUrl prefix:", url.slice(0, 40), "len:", url.length);
  });
});
