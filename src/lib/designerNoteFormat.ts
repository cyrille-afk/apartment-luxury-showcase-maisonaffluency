/**
 * Lightweight Designer Notes formatting: **bold**, ==highlight== and "- " bullets.
 * Plain text in, structured runs out — never HTML, so notes can't inject markup.
 */
export interface NoteRun { text: string; bold: boolean; mark: boolean }
export interface NoteLine { bullet: boolean; indent?: boolean; runs: NoteRun[] }

export function parseDesignerNote(source: string): NoteLine[] {
  return (source || "").replace(/\r\n?/g, "\n").split("\n").map(raw => {
    const bulletMatch = /^\s*[-•*]\s+/.exec(raw);
    const body = bulletMatch ? raw.slice(bulletMatch[0].length) : raw;
    const runs: NoteRun[] = [];
    let bold = false, mark = false, buf = "";
    const flush = () => { if (buf) runs.push({ text: buf, bold, mark }); buf = ""; };
    for (let i = 0; i < body.length; i++) {
      const pair = body.slice(i, i + 2);
      if (pair === "**" && (bold || body.indexOf("**", i + 2) !== -1)) { flush(); bold = !bold; i++; continue; }
      if (pair === "==" && (mark || body.indexOf("==", i + 2) !== -1)) { flush(); mark = !mark; i++; continue; }
      buf += body[i];
    }
    flush();
    return { bullet: !!bulletMatch, runs };
  });
}

export function plainDesignerNote(source: string): string {
  return parseDesignerNote(source).map(l => (l.bullet ? "• " : "") + l.runs.map(r => r.text).join("")).join("\n");
}

/** Word-wraps parsed lines to `width` using a caller-supplied measurer (jsPDF text width). */
export function wrapDesignerNote(lines: NoteLine[], width: number, measure: (text: string, bold: boolean) => number, bulletIndent: number): NoteLine[] {
  const out: NoteLine[] = [];
  for (const line of lines) {
    const avail = line.bullet ? width - bulletIndent : width;
    let current: NoteRun[] = [], used = 0, first = true;
    const push = () => { out.push({ bullet: line.bullet && first, indent: line.bullet, runs: current }); first = false; current = []; used = 0; };
    const words = line.runs.flatMap(r => r.text.split(/(\s+)/).filter(Boolean).map(text => ({ ...r, text })));
    for (const word of words) {
      const space = /^\s+$/.test(word.text);
      if (space && !current.length) continue;
      const w = measure(word.text, word.bold);
      if (!space && used + w > avail && current.length) {
        while (current.length && /^\s+$/.test(current[current.length - 1].text)) current.pop();
        push();
      }
      const last = current[current.length - 1];
      if (last && last.bold === word.bold && last.mark === word.mark) last.text += word.text;
      else current.push({ ...word });
      used += w;
    }
    push();
  }
  return out;
}
