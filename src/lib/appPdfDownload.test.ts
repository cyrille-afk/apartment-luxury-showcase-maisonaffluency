import { describe, expect, it } from 'vitest';
import { pdfPageCuts } from './appPdfDownload';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
describe('direct PDF exports', () => {
  it('keeps a product block intact at a page boundary', () => expect(pdfPageCuts(220, 100, [{ top: 80, bottom: 130 }])).toEqual([0, 80, 180, 220]));
  it('allows oversized content to continue instead of looping', () => expect(pdfPageCuts(250, 100, [{ top: 0, bottom: 250 }])).toEqual([0, 100, 200, 250]));
  it('does not cut a text line inside an oversized paragraph', () => expect(pdfPageCuts(150, 100, [{ top: 0, bottom: 150 }, { top: 94, bottom: 108 }])).toEqual([0, 94, 150]));
  it('honours editorial page breaks before filling the remaining page', () => expect(pdfPageCuts(300, 120, [], [70, 190])).toEqual([0, 70, 190, 300]));
  it('keeps forced room boundaries aligned even when product blocks cross a natural page end', () => expect(pdfPageCuts(320, 120, [{ top: 100, bottom: 150 }], [180])).toEqual([0, 100, 180, 300, 320]));
  it('prohibits browser print calls throughout application source', () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : /\.[jt]sx?$/.test(e.name) && !e.name.includes('.test.') ? [join(dir, e.name)] : []);
    const violations = walk('src').filter(file => /(?:window|contentWindow|win|w|frame)\??\.(?:print)\s*\(/.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')));
    expect(violations).toEqual([]);
  });
});