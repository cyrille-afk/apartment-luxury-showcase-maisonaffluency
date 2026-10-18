import { jsPDF } from 'jspdf';
import { formatPdfDate } from './pdfFormatting';
import { snapshotChanges, snapshotFinishes, snapshotFootprint } from './projectSnapshotComparison';
import type { ProjectSnapshot, ProjectSnapshotData } from './projectLayoutSnapshots';
import type { PlacedObject } from '@/components/trade/visualiser/SceneObject';

export type ComparisonSide = { snapshot: ProjectSnapshot; data: ProjectSnapshotData };
const JADE = [12, 49, 47] as const, INK = [40, 40, 40] as const, MUTED = [115, 115, 115] as const, RULE = [210, 215, 213] as const;

/** Allowlisted client content only; never serialize a scene or its pricing into a PDF. */
export function comparisonPieceText(object?: PlacedObject) {
  if (!object) return ['Not in this snapshot'];
  const finishes = snapshotFinishes(object);
  return [object.product_name || 'Furniture', object.brand_name,
    `X ${object.position[0].toFixed(2)} m / Z ${object.position[2].toFixed(2)} m / Rotation ${(object.rotation[1] * 180 / Math.PI).toFixed(0)}°`,
    ...(object.marbleSurface ? [`Marble surface: reflectivity ${(object.marbleSurface.reflectivity * 100).toFixed(0)}% / roughness ${(object.marbleSurface.roughness * 100).toFixed(0)}%`] : []),
    ...(finishes.length ? finishes.map(f => `${f.label}: ${f.name}`) : ['Original product finishes'])].filter(Boolean);
}

async function fontFile(path: string) {
  const response = await fetch(path, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('PDF font unavailable');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    response.blob().then(blob => reader.readAsDataURL(blob), reject);
  });
}

async function swatch(url: string): Promise<string | null> {
  try {
    const image = new Image(); image.crossOrigin = 'anonymous';
    const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; });
    image.src = url;
    await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error('Image unavailable')), 8000))]);
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 120;
    const context = canvas.getContext('2d'); if (!context) return null;
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 120, 120);
    return canvas.toDataURL('image/png');
  } catch { return null; }
}

/** Client-facing annotations typed by the studio; plain text only, never prices. */
export type ComparisonAnnotations = { summary?: string; notes?: Record<string, string>; highlightChanges?: boolean };
const ACCENT = [176, 112, 58] as const;
const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max);
export function comparisonAnnotationText(annotations: ComparisonAnnotations | undefined, id: string) { return clean(annotations?.notes?.[id], 600); }

export async function buildSnapshotComparisonPdf(left: ComparisonSide, right: ComparisonSide, annotations: ComparisonAnnotations = {}): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const [bodyFont, headingFont] = await Promise.all([fontFile('/fonts/pdf/Inter-Light.ttf'), fontFile('/fonts/pdf/CormorantGaramond-Regular.ttf')]);
  doc.addFileToVFS('Inter.ttf', bodyFont); doc.addFont('Inter.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Cormorant.ttf', headingFont); doc.addFont('Cormorant.ttf', 'Cormorant', 'normal');
  doc.setProperties({ title: 'Project Snapshot Comparison', author: 'Maison Affluency', subject: 'Furniture layouts and finish selections' });
  const sides = [left, right];
  const changes = snapshotChanges(left.data, right.data);
  const urls = Array.from(new Set(sides.flatMap(side => side.data.scene.objects.flatMap(o => snapshotFinishes(o).flatMap(f => f.image ? [f.image] : [])))));
  const images = new Map(await Promise.all(urls.map(async url => [url, await swatch(url)] as const)));
  const M = 16, column = 127, xs = [M, 154];
  const header = (title: string) => {
    doc.setFont('Cormorant').setFontSize(25).setTextColor(...JADE).text('Maison Affluency', M, 19);
    doc.setFont('Inter').setFontSize(8).setTextColor(...MUTED).text('PROJECT SNAPSHOT COMPARISON', M, 26);
    doc.text(formatPdfDate(new Date(), 'en-GB'), 281, 19, { align: 'right' });
    doc.setDrawColor(...RULE).line(M, 32, 281, 32);
    doc.setFont('Cormorant').setFontSize(20).setTextColor(...JADE).text(title, M, 43);
  };
  const names = () => {
    let height = 0;
    sides.forEach((side, i) => {
      doc.setFont('Inter').setFontSize(10).setTextColor(...INK);
      const lines = doc.splitTextToSize(side.snapshot.name, column);
      doc.text(lines, xs[i], 54); height = Math.max(height, lines.length * 4.8);
    });
    return 54 + height + 5;
  };
  header('Furniture layouts');
  const top = names();
  // One shared scale and origin envelope for an honest side-by-side comparison.
  const extents = sides.flatMap(side => side.data.scene.objects.map(o => {
    const f = snapshotFootprint(o), r = Math.hypot(f.width, f.depth) / 2;
    return { x: Math.abs(o.position[0]) + r, z: Math.abs(o.position[2]) + r };
  }));
  const width = Math.max(...sides.map(s => s.data.bounds.width), ...extents.map(e => e.x * 2));
  const depth = Math.max(...sides.map(s => s.data.bounds.depth), ...extents.map(e => e.z * 2));
  const scale = Math.min((column - 8) / width, 83 / depth);
  const numbers = new Map(changes.map((c, i) => [c.id, i + 1]));
  const highlight = annotations.highlightChanges !== false;
  const changedIds = new Set(changes.filter(c => c.status !== 'Unchanged').map(c => c.id));
  sides.forEach((side, i) => {
    const cx = xs[i] + column / 2, cy = top + 46;
    doc.setDrawColor(...RULE).setLineWidth(0.3).rect(cx - side.data.bounds.width * scale / 2, cy - side.data.bounds.depth * scale / 2, side.data.bounds.width * scale, side.data.bounds.depth * scale);
    side.data.scene.objects.forEach(o => {
      const f = snapshotFootprint(o), angle = -o.rotation[1], cos = Math.cos(angle), sin = Math.sin(angle);
      const points = [[-f.width / 2, -f.depth / 2], [f.width / 2, -f.depth / 2], [f.width / 2, f.depth / 2], [-f.width / 2, f.depth / 2]].map(([x, z]) => [cx + (o.position[0] + x * cos - z * sin) * scale, cy + (o.position[2] + x * sin + z * cos) * scale]);
      const flagged = highlight && changedIds.has(o.instanceId);
      doc.setLineWidth(flagged ? 0.7 : 0.3);
      if (flagged) doc.setDrawColor(...ACCENT).setFillColor(246, 230, 214); else doc.setDrawColor(...JADE).setFillColor(228, 236, 233);
      doc.lines(points.slice(1).map((p, j) => [p[0] - points[j][0], p[1] - points[j][1]]), points[0][0], points[0][1], [1, 1], 'FD', true);
      doc.setLineWidth(0.3);
      doc.setFont('Inter').setFontSize(8).setTextColor(...(flagged ? ACCENT : JADE)).text(String(numbers.get(o.instanceId)), cx + o.position[0] * scale, cy + o.position[2] * scale + 1, { align: 'center' });
    });
    doc.setFont('Inter').setFontSize(8).setTextColor(...MUTED);
    const b = side.data.bounds;
    doc.text(`${b.width.toFixed(2)} × ${b.depth.toFixed(2)} m (${(b.width * 3.28084).toFixed(1)} × ${(b.depth * 3.28084).toFixed(1)} ft) / ${side.data.scene.objects.length} pieces`, xs[i], top + 96);
    doc.text(`Saved ${formatPdfDate(new Date(side.snapshot.created_at), 'en-GB')}`, xs[i], top + 102);
    const surfaces = `Floor: ${side.data.scene.floorFinish ?? 'Default'} / Wall: ${side.data.scene.featureWallFinish ?? side.data.scene.wallFinish ?? 'Default'}`;
    doc.text(doc.splitTextToSize(surfaces, column), xs[i], top + 109);
  });
  doc.setFont('Inter').setFontSize(9).setTextColor(...INK).text(`${changes.filter(c => c.status !== 'Unchanged').length} changed pieces / ${changes.filter(c => c.status === 'Added').length} added / ${changes.filter(c => c.status === 'Removed').length} removed`, M, 186);
  if (highlight && changedIds.size) {
    doc.setDrawColor(...ACCENT).setFillColor(246, 230, 214).setLineWidth(0.7).rect(190, 183, 4, 4, 'FD').setLineWidth(0.3);
    doc.setFontSize(8).setTextColor(...ACCENT).text('Highlighted: changed, added or removed pieces', 197, 186);
  }
  let y = 0;
  const nextPage = () => { doc.addPage(); header('Furniture & finish differences'); y = names(); };
  nextPage();
  const summary = clean(annotations.summary, 1200);
  if (summary) {
    const lines = doc.setFont('Inter').setFontSize(9).splitTextToSize(summary, 257) as string[];
    const h = lines.length * 4.6 + 12;
    doc.setFillColor(250, 244, 238).setDrawColor(...ACCENT).rect(M, y - 2, 265, h, 'F').setLineWidth(0.8).line(M, y - 2, M, y - 2 + h).setLineWidth(0.3);
    doc.setFontSize(7).setTextColor(...ACCENT).text('STUDIO NOTE', M + 5, y + 3);
    doc.setFontSize(9).setTextColor(...INK).text(lines, M + 5, y + 8.5);
    y += h + 6;
  }
  if (!changes.length) doc.setFont('Inter').setFontSize(10).text('Both snapshots have no furniture.', M, y + 8);
  for (const change of changes) {
    const objects = [change.before, change.after];
    const columns = objects.map(o => {
      const text = comparisonPieceText(o);
      const metadata = o && snapshotFinishes(o).length ? text.slice(0, o.marbleSurface ? 4 : 3) : text;
      return metadata.flatMap(line => doc.setFont('Inter').setFontSize(9).splitTextToSize(line, column - 4));
    });
    const count = Math.max(...columns.map(c => c.length));
    if (y + 17 > 192) nextPage();
    doc.setFont('Inter').setFontSize(8).setTextColor(...JADE).setTextColor(...(highlight && changedIds.has(change.id) ? ACCENT : JADE)).text(`${numbers.get(change.id)} / ${change.status}${change.layoutChanged ? ' / Layout' : ''}${change.finishesChanged ? ' / Finishes' : ''}`, M, y + 4); y += 11;
    for (let row = 0; row < count; row++) {
      if (y + 5 > 192) nextPage();
      columns.forEach((lines, i) => { if (lines[row]) doc.setFont('Inter').setFontSize(9).setTextColor(...INK).text(lines[row], xs[i], y); });
      y += 5;
    }
    const finishes = objects.map(o => o ? snapshotFinishes(o) : []);
    const finishCount = Math.max(...finishes.map(f => f.length));
    for (let row = 0; row < finishCount; row++) {
      doc.setFont('Inter').setFontSize(8);
      const texts = finishes.map(list => {
        const f = list[row];
        return f ? doc.splitTextToSize(`${f.label}: ${f.name}${f.image && !images.get(f.image) ? ' (image unavailable)' : ''}`, column - 20) as string[] : [];
      });
      const rowHeight = Math.max(19, ...texts.map(t => t.length * 4 + 5));
      if (y + rowHeight > 192) nextPage();
      finishes.forEach((list, i) => {
        const f = list[row]; if (!f) return;
        const image = f.image ? images.get(f.image) : null;
        if (image) doc.addImage(image, 'PNG', xs[i], y, 14, 14);
        doc.setFont('Inter').setFontSize(8).setTextColor(...MUTED).text(texts[i], xs[i] + (image ? 19 : 0), y + 4);
      });
      y += rowHeight;
    }
    const note = comparisonAnnotationText(annotations, change.id);
    if (note) {
      const lines = doc.setFont('Inter').setFontSize(8.5).splitTextToSize(note, 255) as string[];
      const h = lines.length * 4.3 + 9;
      if (y + h > 192) nextPage();
      doc.setFillColor(250, 244, 238).rect(M, y, 265, h, 'F').setDrawColor(...ACCENT).setLineWidth(0.8).line(M, y, M, y + h).setLineWidth(0.3);
      doc.setFontSize(6.5).setTextColor(...ACCENT).text(`NOTE ${numbers.get(change.id)}`, M + 4, y + 4);
      doc.setFontSize(8.5).setTextColor(...INK).text(lines, M + 4, y + 8);
      y += h + 2;
    }
    doc.setDrawColor(...RULE).line(M, y + 1, 281, y + 1); y += 8;
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFont('Inter').setFontSize(7).setTextColor(...MUTED);
    doc.text('Furniture footprints / Indicative layout, not a construction drawing', M, 202);
    doc.text(`maisonaffluency.com / ${p} of ${pages}`, 281, 202, { align: 'right' });
  }
  return doc.output('blob');
}

/** Called synchronously once the prepared PDF is ready, preserving Safari user activation. */
export async function downloadSnapshotComparison(blob: Blob) {
  const file = new File([blob], 'snapshot-comparison.pdf', { type: 'application/pdf' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Snapshot comparison' }); return; }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}