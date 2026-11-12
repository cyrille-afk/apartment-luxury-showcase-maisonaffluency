import { toast } from 'sonner';
import { getClientSafeMode } from './clientSafeMode';

export function pdfPageCuts(height: number, pageHeight: number, blocks: { top: number; bottom: number }[]): number[] {
  const cuts = [0];
  while (cuts[cuts.length - 1] < height) {
    const start = cuts[cuts.length - 1];
    let end = Math.min(height, start + pageHeight);
    for (;;) {
      const crossing = blocks.filter(b => b.top > start + 1 && b.top < end && b.bottom > end && b.bottom - b.top <= pageHeight);
      if (!crossing.length) break;
      const next = Math.min(...crossing.map(b => b.top));
      if (next >= end) break;
      end = next;
    }
    if (end <= start) end = Math.min(height, start + pageHeight);
    cuts.push(end);
  }
  return cuts;
}

let exporting = false;
/** Render only the supplied document, never the browser page URL or print chrome. */
export async function downloadDocumentPdf(input: { html?: string; element?: HTMLElement; filename: string; landscape?: boolean; marginMm?: number }) {
  if (exporting) return;
  exporting = true;
  const notice = toast.loading('Preparing PDF…');
  const frame = document.createElement('iframe');
  const width = input.landscape ? 1123 : 794;
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:1123px;border:0;pointer-events:none;`;
  frame.setAttribute('aria-hidden', 'true');
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Document unavailable');
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).map(e => e.outerHTML).join('');
    doc.open();
    doc.write(input.html || `<!doctype html><html><head>${styles}</head><body>${input.element?.outerHTML || ''}</body></html>`);
    doc.close();
    doc.querySelectorAll('script').forEach(e => e.remove());
    if (getClientSafeMode()) doc.querySelectorAll('[data-trade-sensitive]').forEach(e => e.remove());
    const override = doc.createElement('style');
    override.textContent = `html,body{margin:0!important;overflow:visible!important;width:${width}px!important;background:var(--background,white)}body{padding:0!important;display:flow-root!important}body>main{margin:0!important;width:100%!important;max-width:none!important}.proposal-print-sheet{box-shadow:none!important}[data-client-placeholder],.print\\:hidden{display:none!important}`;
    doc.head.appendChild(override);
    await doc.fonts.ready;
    await Promise.all(Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(async link => {
      const href = link.getAttribute('href');
      if (!href || !input.element) return;
      try {
        const response = await fetch(href);
        if (response.ok) { const style = doc.createElement('style'); style.textContent = await response.text(); doc.head.appendChild(style); }
      } catch { /* linked stylesheet can still load normally */ }
    }));
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(async img => {
      img.loading = 'eager';
      if (!img.complete) await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); });
      try { await img.decode(); } catch { /* existing missing-image placeholders remain */ }
    }));
    await new Promise(resolve => setTimeout(resolve, 100));
    const root = doc.body;
    const bounds = root.getBoundingClientRect();
    const blocks = Array.from(root.querySelectorAll('tr,article,.sheet,.cover,.proposal-line-item,h1,h2,h3,p,img')).map(e => {
      const rect = e.getBoundingClientRect();
      return { top: rect.top - bounds.top, bottom: rect.bottom - bounds.top };
    });
    // Oversized paragraphs still break between text lines, never through glyphs.
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if (textNode.textContent?.trim() && !textNode.parentElement?.closest('style,script')) {
        const range = doc.createRange();
        const lines = new Map<number, { top: number; bottom: number }>();
        for (let i = 0; i < (textNode.textContent?.length || 0); i++) {
          range.setStart(textNode, i); range.setEnd(textNode, i + 1);
          const rect = range.getBoundingClientRect();
          if (rect.height > 0) lines.set(Math.round(rect.top), { top: rect.top - bounds.top - 2, bottom: rect.bottom - bounds.top + 2 });
        }
        blocks.push(...lines.values());
      }
      textNode = walker.nextNode();
    }
    const canvas = await html2canvas(root, { scale: 1.5, useCORS: true, logging: false, windowWidth: width, width, height: root.scrollHeight });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: input.landscape ? 'landscape' : 'portrait' });
    pdf.setProperties({ title: input.filename.replace(/\.pdf$/i, ''), author: 'Maison Affluency', creator: 'Maison Affluency' });
    const margin = input.marginMm ?? 14;
    const pageW = pdf.internal.pageSize.getWidth() - margin * 2;
    const pageH = pdf.internal.pageSize.getHeight() - margin * 2;
    const scale = canvas.width / width;
    const cuts = pdfPageCuts(root.scrollHeight, pageH * width / pageW, blocks);
    for (let i = 0; i < cuts.length - 1; i++) {
      if (i > 0) pdf.addPage();
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.ceil((cuts[i + 1] - cuts[i]) * scale);
      const ctx = slice.getContext('2d');
      if (!ctx) throw new Error('PDF rendering unavailable');
      ctx.drawImage(canvas, 0, Math.round(cuts[i] * scale), canvas.width, slice.height, 0, 0, slice.width, slice.height);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.94), 'JPEG', margin, margin, pageW, slice.height / canvas.width * pageW);
    }
    const blob = pdf.output('blob');
    const filename = input.filename.endsWith('.pdf') ? input.filename : `${input.filename}.pdf`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    // A second, synchronous click preserves Safari user activation after PDF generation.
    toast.success('PDF ready', { id: notice, duration: 30000, action: { label: 'Download', onClick: () => {
      const retryUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = retryUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(retryUrl), 30000);
    } } });
  } catch (error) {
    console.error('PDF rendering failed', error instanceof Error ? error.message : 'Unknown rendering error');
    toast.error('The PDF could not be generated. Please try again.', { id: notice });
  } finally { frame.remove(); exporting = false; }
}