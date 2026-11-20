export const PITCH_WIDTH = 1920;
export const PITCH_HEIGHT = 1080;
/** Bump on every content change so recipients can confirm they hold the latest export. */
export const PITCH_VERSION = 'v5';

const pitchGeneratedLabel = () =>
  new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** Isolated, exact-ratio slide capture: no browser chrome or private workspace. */
export async function exportPitchPdf(element: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'), import('jspdf'),
  ]);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${PITCH_WIDTH}px;height:${PITCH_HEIGHT}px;border:0;`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Presentation unavailable');
    const links = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(node => node.outerHTML).join('');
    doc.open();
    doc.write(`<!doctype html><html><head>${links}</head><body><main class="developer-pitch pitch-export">${element.innerHTML}</main></body></html>`);
    doc.close();
    const styles = await Promise.all([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(async link => {
      const response = await fetch(link.href);
      return response.ok ? response.text() : '';
    }));
    const style = doc.createElement('style');
    style.textContent = styles.join('\n') + `html,body{margin:0!important;width:1920px!important}.pitch-slide-viewport{width:1920px!important;height:1080px!important;aspect-ratio:16/9}.pitch-slide{transform:none!important;position:relative!important;inset:auto!important;margin:0!important}.pitch-export{padding:0!important}.pitch-slide-viewport{margin:0!important}`;
    doc.head.appendChild(style);
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(async image => { image.loading = 'eager'; try { await image.decode(); } catch { throw new Error('A presentation image could not load'); } }));
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [338.6667, 190.5], compress: true });
    const stamp = `${PITCH_VERSION} · Generated ${pitchGeneratedLabel()}`;
    pdf.setProperties({
      title: 'Developer Partnership — Cipriani Residences Miami × Maison Affluency',
      author: 'Maison Affluency',
      subject: `Version ${PITCH_VERSION}, generated ${pitchGeneratedLabel()}`,
    });
    for (const [index, slide] of [...doc.querySelectorAll<HTMLElement>('.pitch-slide')].entries()) {
      if (index) pdf.addPage([338.6667, 190.5], 'landscape');
      const canvas = await html2canvas(slide, { scale: 1.5, useCORS: true, logging: false, windowWidth: PITCH_WIDTH, width: PITCH_WIDTH, height: PITCH_HEIGHT });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 338.6667, 190.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(120, 116, 110);
      pdf.text(`Maison Affluency · Confidential · ${stamp}`, 338.6667 - 4, 190.5 - 3, { align: 'right' });
    }
    pdf.save(`Maison-Affluency-Developer-Partnership-Cipriani_${PITCH_VERSION}.pdf`);
  } finally { frame.remove(); }
}