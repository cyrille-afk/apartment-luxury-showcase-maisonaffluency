/**
 * Architectural Specification Schedule export.
 *
 * 1. collectSchedulePicks(timeline) — pulls the structured pieces Felix has
 *    proposed in the active conversation (tearsheet / quote / FF&E proposals).
 * 2. compileSpecSchedule(...) — enriches them into a download-ready dataset
 *    (dimensions, finish, material library, client pricing, lead time).
 * 3. renderSpecSchedulePdf(...) — white-label PDF: studio branding + project
 *    profile (project, client, region) in the header blocks.
 *
 * Pricing is calculated internally from approved-member prices and the live
 * discount, but only client prices are included in the exported dataset.
 */
import { supabase } from "@/integrations/supabase/client";
import { effectiveProjectMultiplier, clientUnitCents } from "@/lib/tradePricing";

export interface SchedulePickRef {
  pickId: string;
  qty: number;
  finish: string | null;
  leadWeeks: number | null;
  room: string | null;
}

export interface SpecScheduleRow {
  ref: string;
  productName: string;
  room: string | null;
  qty: number;
  dimensions: string;
  finish: string;
  materialLibrary: string;
  clientPriceCents: number | null;
  currency: string;
  leadTime: string;
}

export interface ScheduleProfile {
  projectName: string;
  clientName: string;
  region: string;
  studioName: string;
  studioLogoUrl: string | null;
  studioFont: string;
}

export interface SpecScheduleDataset {
  profile: ScheduleProfile;
  rows: SpecScheduleRow[];
  generatedAt: string;
}

type AnyItem = { kind: string; [k: string]: any };

/** Structured items from the conversation, latest finish/qty wins, order kept. */
export function collectSchedulePicks(timeline: AnyItem[]): SchedulePickRef[] {
  const map = new Map<string, SchedulePickRef>();
  const put = (r: SchedulePickRef) => {
    const prev = map.get(r.pickId);
    map.set(r.pickId, prev ? {
      ...prev,
      qty: r.qty || prev.qty,
      finish: r.finish ?? prev.finish,
      leadWeeks: r.leadWeeks ?? prev.leadWeeks,
      room: r.room ?? prev.room,
    } : r);
  };
  for (const t of timeline) {
    if (t.kind === "proposal" && t.resolved !== "discarded") {
      const excluded = new Set<string>(t.excluded ?? []);
      for (const p of t.proposal?.preview ?? []) {
        if (p?.id && !excluded.has(p.id)) put({ pickId: p.id, qty: 1, finish: null, leadWeeks: null, room: null });
      }
    } else if ((t.kind === "quote_proposal" || t.kind === "ffe_proposal") && t.resolved !== "discarded") {
      for (const l of t.proposal?.args?.lines ?? t.proposal?.args?.rows ?? []) {
        if (!l?.pick_id) continue;
        put({ pickId: l.pick_id, qty: Number(l.qty) || 1, finish: l.variant ?? null, leadWeeks: l.lead_weeks ?? null, room: l.room ?? null });
      }
    }
  }
  return [...map.values()];
}

const mmToIn = (mm: number) => (mm / 25.4).toFixed(1);

function formatDims(p: any): string {
  const parts: string[] = [];
  if (p.width_mm) parts.push(`W ${p.width_mm}`);
  if (p.depth_mm) parts.push(`D ${p.depth_mm}`);
  if (p.height_mm) parts.push(`H ${p.height_mm}`);
  if (parts.length) {
    const inch = [p.width_mm, p.depth_mm, p.height_mm].filter(Boolean).map((v: number) => mmToIn(v)).join(" × ");
    return `${parts.join(" × ")} mm (${inch} in)`;
  }
  return (p.dimensions ?? "").replace(/\s+/g, " ").trim() || "—";
}

export async function compileSpecSchedule(opts: {
  picks: SchedulePickRef[];
  projectId: string | null;
  studio: { name: string; display_name?: string | null; logo_url: string | null; primary_brand_font?: string | null; default_project_markup_percentage?: number | null } | null;
}): Promise<SpecScheduleDataset> {
  const ids = opts.picks.map((p) => p.pickId);
  const [picksRes, priceRes, matRes, pctRes, projRes] = await Promise.all([
    supabase.from("designer_curator_picks")
      .select("id, title, dimensions, width_mm, depth_mm, height_mm, materials, lead_time, currency")
      .in("id", ids),
    supabase.from("trade_product_pricing").select("pick_id, trade_price_cents").in("pick_id", ids),
    supabase.from("product_material_links").select("pick_id, role, material_taxonomy:material_id(name)").in("pick_id", ids),
    supabase.rpc("current_trade_discount_pct" as any),
    opts.projectId
      ? supabase.from("projects").select("name, client_name, location, location_city, trade_multiplier").eq("id", opts.projectId).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const pickById = new Map((picksRes.data ?? []).map((p: any) => [p.id, p]));
  const priceById = new Map((priceRes.data ?? []).map((p: any) => [p.pick_id, p.trade_price_cents as number | null]));
  const matsById = new Map<string, string[]>();
  for (const m of (matRes.data ?? []) as any[]) {
    const n = m.material_taxonomy?.name;
    if (!n) continue;
    const list = matsById.get(m.pick_id) ?? [];
    if (!list.includes(n)) list.push(n);
    matsById.set(m.pick_id, list);
  }
  // The RPC returns a fraction (0.10 = 10%); normalise to a percentage.
  const rawPct = Number(pctRes.data) || 0;
  const tierPct = Math.round((rawPct <= 1 ? rawPct * 100 : rawPct) * 100) / 100;
  const proj = projRes.data as any;
  const multiplier = effectiveProjectMultiplier(proj?.trade_multiplier, opts.studio?.default_project_markup_percentage);

  const rows: SpecScheduleRow[] = opts.picks.map((ref, i) => {
    const p: any = pickById.get(ref.pickId) ?? {};
    const rrp = priceById.get(ref.pickId);
    const rrpCents = typeof rrp === "number" && Number.isFinite(rrp) && rrp > 0 ? rrp : null;
    return {
      ref: `FF-${String(i + 1).padStart(3, "0")}`,
      productName: p.title ?? "Untitled piece",
      room: ref.room,
      qty: ref.qty,
      dimensions: formatDims(p),
      finish: ref.finish?.trim() || "To be confirmed",
      materialLibrary: (matsById.get(ref.pickId) ?? []).join(", ") || (p.materials ?? "").trim() || "—",
      clientPriceCents: clientUnitCents(rrpCents, tierPct / 100, multiplier),
      currency: p.currency || "EUR",
      leadTime: ref.leadWeeks ? `${ref.leadWeeks} weeks` : (p.lead_time ?? "").trim() || "On request",
    };
  });

  return {
    profile: {
      projectName: proj?.name || "Untitled Project",
      clientName: proj?.client_name || "—",
      region: proj?.location_city || proj?.location || "—",
      studioName: opts.studio?.display_name?.trim() || opts.studio?.name?.trim() || "Your Studio",
      studioLogoUrl: opts.studio?.logo_url ?? null,
      studioFont: opts.studio?.primary_brand_font || "editorial",
    },
    rows,
    generatedAt: new Date().toISOString(),
  };
}

const money = (cents: number | null, cur: string) =>
  cents == null || !Number.isFinite(cents) || cents <= 0 ? "Price upon Request"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

async function toDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const data = await new Promise<string>((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const img = new Image(); img.onload = () => res({ w: img.width, h: img.height }); img.onerror = () => res({ w: 1, h: 1 }); img.src = data;
    });
    return { data, ...dims };
  } catch { return null; }
}

/** Renders the white-label schedule and triggers the native save dialog (blob download). */
export async function renderSpecSchedulePdf(ds: SpecScheduleDataset): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const ink: [number, number, number] = [28, 32, 31];
  const muted: [number, number, number] = [110, 118, 116];
  const jade: [number, number, number] = [42, 110, 98];
  const { profile } = ds;
  const studioName = profile.studioName?.trim() || "Your Studio";

  // Header — studio branding (white-label) left, document title right.
  const logo = profile.studioLogoUrl?.trim() ? await toDataUrl(profile.studioLogoUrl.trim()) : null;
  let logoDrawn = false;
  if (logo) {
    const h = 30; const w = Math.min(140, (logo.w / logo.h) * h);
    try { doc.addImage(logo.data, M, M - 6, w, h); logoDrawn = true; } catch { /* fall back to name */ }
  }
  if (!logoDrawn) {
    doc.setFont("times", "normal"); doc.setFontSize(16); doc.setTextColor(...ink);
    const wordmark = studioName.toLocaleUpperCase("en-US");
    doc.text(wordmark, M, M + 14, { charSpace: 1.6, maxWidth: W * 0.48 });
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text("SPECIFICATION SCHEDULE", W - M, M + 2, { align: "right" });
  doc.setFont("times", "italic"); doc.setFontSize(16); doc.setTextColor(...ink);
  doc.text(profile.projectName, W - M, M + 20, { align: "right" });
  doc.setDrawColor(...jade); doc.setLineWidth(0.6); doc.line(M, M + 34, W - M, M + 34);

  // Project profile blocks.
  const blocks: Array<[string, string]> = [
    ["PROJECT", profile.projectName],
    ["CLIENT", profile.clientName],
    ["REGION", profile.region],
    ["ISSUED", new Date(ds.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })],
  ];
  const bw = (W - M * 2) / blocks.length;
  blocks.forEach(([k, v], i) => {
    const x = M + i * bw;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text(k, x, M + 52, { charSpace: 1.5 });
    doc.setFontSize(9.5); doc.setTextColor(...ink);
    doc.text(doc.splitTextToSize(v, bw - 10).slice(0, 2), x, M + 66);
  });

  // Table.
  const cols: Array<{ h: string; w: number; get: (r: SpecScheduleRow) => string; right?: boolean }> = [
    { h: "REF", w: 46, get: (r) => r.ref },
    { h: "PRODUCT", w: 160, get: (r) => [r.productName, r.room].filter(Boolean).join("\n") },
    { h: "QTY", w: 28, get: (r) => String(r.qty), right: true },
    { h: "DIMENSIONS", w: 104, get: (r) => r.dimensions },
    { h: "FINISH", w: 92, get: (r) => r.finish },
    { h: "MATERIAL LIBRARY", w: 96, get: (r) => r.materialLibrary },
    { h: "CLIENT PRICE", w: 112, get: (r) => money(r.clientPriceCents, r.currency), right: true },
    { h: "LEAD TIME", w: 0, get: (r) => r.leadTime },
  ];
  const fixed = cols.reduce((a, c) => a + c.w, 0);
  cols[cols.length - 1].w = W - M * 2 - fixed;

  let y = M + 96;
  const header = () => {
    doc.setFillColor(244, 241, 237); doc.rect(M, y - 11, W - M * 2, 18, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.setTextColor(...muted);
    let x = M;
    for (const c of cols) { doc.text(c.h, c.right ? x + c.w - 6 : x + 6, y, { align: c.right ? "right" : "left" }); x += c.w; }
    y += 16;
  };
  header();
  doc.setFont("helvetica", "normal");
  for (const r of ds.rows) {
    doc.setFontSize(8.2);
    const cells = cols.map((c) => doc.splitTextToSize(c.get(r), c.w - 12) as string[]);
    const rowH = Math.max(...cells.map((l) => l.length)) * 10.5 + 8;
    if (y + rowH > H - M - 20) { doc.addPage(); y = M + 10; header(); doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); }
    let x = M;
    cols.forEach((c, i) => {
      doc.setTextColor(...(i === 1 ? ink : [60, 66, 64] as [number, number, number]));
      cells[i].forEach((line, li) => {
        if (i === 1 && li === 0) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
        doc.text(line, c.right ? x + c.w - 6 : x + 6, y + li * 10.5, { align: c.right ? "right" : "left" });
      });
      x += c.w;
    });
    y += rowH;
    doc.setDrawColor(225, 221, 216); doc.setLineWidth(0.4); doc.line(M, y - 9, W - M, y - 9);
  }

  // Totals (only priced rows; others remain Price upon Request).
   const totals = new Map<string, number>();
   for (const r of ds.rows) {
     if (r.clientPriceCents == null) continue;
     totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.clientPriceCents * r.qty);
   }
   if (y + Math.max(1, totals.size) * 16 + 30 > H - M - 20) { doc.addPage(); y = M + 10; }
   y += 6;
   doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...ink);
  const totalsX = M + cols.slice(0, 6).reduce((a, c) => a + c.w, 0);
   for (const [currency, amount] of totals) {
     doc.text("TOTAL (priced lines × qty)", totalsX - 6, y, { align: "right" });
     doc.text(money(amount, currency), totalsX + cols[6].w - 6, y, { align: "right" });
     y += 16;
   }

  // Footer.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text(`${studioName} · ${profile.projectName} · Specification Schedule`, M, H - 20);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 20, { align: "right" });
  }

  const safe = profile.projectName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Project";
   // jsPDF inserts its own generator name into /Producer; replace it with the
   // studio identity before creating the downloadable file.
   const { PDFDocument } = await import("pdf-lib");
   const branded = await PDFDocument.load(doc.output("arraybuffer"), { updateMetadata: false });
   branded.setProducer(studioName);
   branded.setCreator(studioName);
   branded.setTitle(`${profile.projectName} — Specification Schedule`);
   branded.setSubject("Client specification schedule");
   const blob = new Blob([await branded.save() as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${safe}_Specification-Schedule_${ds.generatedAt.slice(0, 10)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
