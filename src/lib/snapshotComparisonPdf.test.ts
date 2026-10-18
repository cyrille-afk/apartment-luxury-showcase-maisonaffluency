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