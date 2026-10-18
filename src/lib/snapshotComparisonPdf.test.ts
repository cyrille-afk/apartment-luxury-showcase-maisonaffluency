import { describe, expect, it } from 'vitest';
import { comparisonPieceText } from './snapshotComparisonPdf';
import type { PlacedObject } from '@/components/trade/visualiser/SceneObject';

describe('client comparison export', () => {
  it('allowlists furniture and finish details without leaking prices or private identifiers', () => {
    const object = { product_name: 'Chair', brand_name: 'Maker', position: [1, 0, 2], rotation: [0, Math.PI / 4, 0], material: { name: 'Tobacco Oak', id: 'private-finish-id' }, trade_price_cents: 123456, client_id: 'private-client-id' } as unknown as PlacedObject;
    const text = comparisonPieceText(object).join('\n');
    expect(text).toContain('Tobacco Oak'); expect(text).toContain('Rotation 45°');
    expect(text).not.toContain('123456'); expect(text).not.toContain('private-client-id'); expect(text).not.toContain('private-finish-id');
  });
});
describe('comparison annotations', () => {
  it('caps a piece note at 600 characters and strips control characters', async () => {
    const { comparisonAnnotationText } = await import('./snapshotComparisonPdf');
    expect(comparisonAnnotationText({ notes: { a: `Hello\u0007 ${'x'.repeat(700)}` } }, 'a')).toHaveLength(600);
    expect(comparisonAnnotationText({ notes: { a: 'Hi\u0007' } }, 'a')).toBe('Hi');
    expect(comparisonAnnotationText({}, 'a')).toBe('');
  });
});

describe('annotation photos', () => {
  it('embeds at most three local JPEG photos per note and ignores remote URLs', async () => {
    const { annotationPhotos } = await import('./snapshotComparisonPdf');
    const jpg = 'data:image/jpeg;base64,AAAA';
    expect(annotationPhotos({ photos: { a: [jpg, 'https://evil.example/x.jpg', jpg, jpg, jpg] } }, 'a')).toEqual([jpg, jpg, jpg]);
    expect(annotationPhotos({}, 'a')).toEqual([]);
  });
});
