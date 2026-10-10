// Spec-sheet compose endpoint.
// mode "trade": approved members get a confidential Maison Affluency cover page
//   (RRP → tier discount → net trade cost) prepended to the supplier spec sheet.
// mode "client": always returns the supplier sheet alone — the cover is never
//   included, so shared/client copies cannot carry trade pricing.
// Tier and RRP are re-derived server-side; nothing pricing-related is trusted from the client.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { z } from "npm:zod@3";
import { resolveAccountDiscount } from "../_shared/accountDiscount.ts";

const Body = z.object({
  pdfUrl: z.string().url().max(2000),
  product: z.string().trim().min(1).max(300),
  brand: z.string().trim().max(300).optional(),
  mode: z.enum(["trade", "client"]),
});

const ALLOWED_HOST = /(^|\.)(maisonaffluency\.com|cloudinary\.com|supabase\.co)$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const pdfResponse = (bytes: Uint8Array, cover: boolean) =>
  new Response(bytes, {
    headers: { ...corsHeaders, "Content-Type": "application/pdf", "Cache-Control": "no-store", "X-Cover-Sheet": cover ? "included" : "none", "Access-Control-Expose-Headers": "X-Cover-Sheet" },
  });

// pdf-lib standard fonts only encode WinAnsi; fold accents and drop the rest.
const safe = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E€·–—]/g, "");

export function money(cents: number, currency: string) {
  const amt = (Math.abs(cents) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? "-" : ""}${currency.toUpperCase()} ${amt}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return json(401, { error: "Unauthorized" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: claimData, error: claimErr } = await admin.auth.getClaims(token);
  const userId = claimData?.claims?.sub as string | undefined;
  if (claimErr || !userId || claimData?.claims?.role !== "authenticated") return json(401, { error: "Unauthorized" });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Invalid request" });
  const { pdfUrl, product, brand, mode } = parsed.data;

  const target = new URL(pdfUrl);
  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) return json(400, { error: "Document host not allowed" });

  const res = await fetch(target);
  if (!res.ok) return json(502, { error: "Document unavailable" });
  const original = new Uint8Array(await res.arrayBuffer());
  if (mode === "client") return pdfResponse(original, false);

  const discount = await resolveAccountDiscount(admin, userId);
  if (discount.pct <= 0) return pdfResponse(original, false);

  const { data: pick } = await admin
    .from("designer_curator_picks")
    .select("id, title, currency, dimensions, materials, lead_time")
    .ilike("title", product).limit(1).maybeSingle();
  if (!pick) return pdfResponse(original, false);
  const { data: price } = await admin.from("trade_product_pricing").select("trade_price_cents").eq("pick_id", pick.id).maybeSingle();
  const rrp = Number(price?.trade_price_cents) || 0;
  if (rrp <= 0) return pdfResponse(original, false); // Price upon Request — no margin to chart

  const { data: profile } = await admin.from("profiles").select("company, first_name, last_name, trade_tier").eq("id", userId).maybeSingle();
  const net = Math.round(rrp * (1 - discount.pct));
  const currency = String(pick.currency || "EUR");
  const studio = profile?.company || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Trade Studio";
  const rawTier = String(profile?.trade_tier || "silver");
  // Same normalisation as resolveAccountDiscount, so the tier label matches the discount applied.
  const tier = ["silver", "gold", "platinum"].includes(rawTier) ? rawTier : "silver";

  try {
    const out = await PDFDocument.create();
    const page = out.addPage([595.28, 841.89]);
    const serif = await out.embedFont(StandardFonts.TimesRoman);
    const sans = await out.embedFont(StandardFonts.Helvetica);
    const bold = await out.embedFont(StandardFonts.HelveticaBold);
    const INK = rgb(0.07, 0.07, 0.07), MUTED = rgb(0.42, 0.42, 0.42), RULE = rgb(0.86, 0.85, 0.82), JADE = rgb(0.07, 0.21, 0.17);
    const W = 595.28, M = 56;
    const right = (t: string, y: number, f = sans, s = 10, c = INK) => page.drawText(safe(t), { x: W - M - f.widthOfTextAtSize(safe(t), s), y, size: s, font: f, color: c });

    page.drawText("MAISON AFFLUENCY", { x: M, y: 650, size: 30, font: serif, color: JADE });
    page.drawText("STUDIO COVERSHEET  ·  CONFIDENTIAL TRADE SPECIFICATION", { x: M, y: 628, size: 8, font: sans, color: MUTED });
    right(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), 628, sans, 8, MUTED);

    let y = 570;
    const meta: [string, string][] = [
      ["Piece", pick.title], ["Maker", brand || ""], ["Designer Account", studio],
      ["Trade Tier", tier.charAt(0).toUpperCase() + tier.slice(1)],
      ["Lead Time", String(pick.lead_time || "On request").replace(/^lead\s*time:?\s*/i, "")],
    ];
    for (const [k, v] of meta) { page.drawText(k, { x: M, y, size: 10, font: sans, color: MUTED }); right(v.slice(0, 70), y); y -= 24; }

    y -= 10;
    page.drawLine({ start: { x: M, y: y + 16 }, end: { x: W - M, y: y + 16 }, thickness: 0.5, color: RULE });
    const pct = Math.round(discount.pct * 1000) / 10;
    const rows: [string, string][] = [
      ["Public Retail Price (RRP)", money(rrp, currency)],
      [`Contract Tier Discount (${pct}%)`, money(-(rrp - net), currency)],
    ];
    for (const [k, v] of rows) { page.drawText(k, { x: M, y, size: 12, font: bold, color: INK }); right(v, y, bold, 12); y -= 28; }
    page.drawRectangle({ x: M - 8, y: y - 9, width: W - 2 * M + 16, height: 28, color: rgb(0.965, 0.957, 0.937) });
    page.drawText("Net Trade Procurement Cost", { x: M, y, size: 12, font: bold, color: JADE });
    right(money(net, currency), y, bold, 12, JADE);

    const notice = "CONFIDENTIALITY NOTICE: This page contains proprietary trade pricing specific to your Maison Affluency studio status. Share the client version of this spec sheet, which omits this page.";
    const words = notice.split(" "); let line = ""; let ny = 90;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (sans.widthOfTextAtSize(next, 7) > W - 2 * M) { page.drawText(line, { x: M, y: ny, size: 7, font: sans, color: MUTED }); ny -= 10; line = w; } else line = next;
    }
    if (line) page.drawText(line, { x: M, y: ny, size: 7, font: sans, color: MUTED });

    const src = await PDFDocument.load(original, { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
    return pdfResponse(await out.save(), true);
  } catch (e) {
    console.error("spec-sheet-compose", e);
    return pdfResponse(original, false);
  }
});
