import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectFileType, sha256Hex, verifyFileSignature } from "./fileSignature.ts";

const pad = (head: number[], size = 256, tail: number[] = []) => {
  const out = new Uint8Array(size);
  out.set(head, 0);
  if (tail.length) out.set(tail, size - tail.length);
  return out;
};

const enc = (s: string) => Array.from(new TextEncoder().encode(s));

const realPdf = () => pad(enc("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"), 512, enc("%%EOF"));
const realPng = () => pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const realJpeg = () => pad([0xff, 0xd8, 0xff, 0xe0], 512, [0xff, 0xd9]);

Deno.test("accepts genuine PDF, PNG and JPEG bytes", () => {
  assertEquals(verifyFileSignature(realPdf(), "licence.pdf", "application/pdf").ok, true);
  assertEquals(verifyFileSignature(realPng(), "cert.png", "image/png").ok, true);
  assertEquals(verifyFileSignature(realJpeg(), "cert.jpg", "image/jpeg").ok, true);
});

Deno.test("rejects a renamed Windows executable", () => {
  const r = verifyFileSignature(pad([0x4d, 0x5a, 0x90, 0x00]), "licence.pdf", "application/pdf");
  assertEquals(r.ok, false);
});

Deno.test("rejects an ELF binary, a shell script and a zip/office archive", () => {
  for (const head of [[0x7f, 0x45, 0x4c, 0x46], [0x23, 0x21, 0x2f, 0x62], [0x50, 0x4b, 0x03, 0x04]]) {
    assertEquals(verifyFileSignature(pad(head), "doc.pdf", "application/pdf").ok, false);
  }
});

Deno.test("rejects an HTML file masquerading as a PDF", () => {
  assertEquals(verifyFileSignature(pad(enc("<html><script>x</script>")), "doc.pdf").ok, false);
});

Deno.test("rejects a PDF polyglot carrying script markup in its header", () => {
  const poly = pad(enc("%PDF-1.4\n<script>alert(1)</script>\n"), 512, enc("%%EOF"));
  assertEquals(verifyFileSignature(poly, "doc.pdf").ok, false);
});

Deno.test("rejects a truncated PDF with no EOF marker", () => {
  assertEquals(verifyFileSignature(pad(enc("%PDF-1.7 broken"), 512), "doc.pdf").ok, false);
});

Deno.test("reports a declared-type mismatch but still accepts real bytes", () => {
  const r = verifyFileSignature(realPng(), "cert.pdf", "application/pdf");
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.mime, "image/png");
});

Deno.test("detectFileType returns null for unknown bytes", () => {
  assertEquals(detectFileType(pad([0x00, 0x01, 0x02, 0x03])), null);
});

Deno.test("sha256Hex is stable and differs per file", async () => {
  const a = await sha256Hex(realPng());
  assertEquals(a, await sha256Hex(realPng()));
  assertEquals(a === (await sha256Hex(realJpeg())), false);
});
