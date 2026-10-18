import { describe, expect, it } from 'vitest';
import { pairingMediaKey, pairingMediaPreview, pairingUploadError, pairingMediaError } from './pairingMedia';
describe('pairing finish media', () => {
  it('isolates exact finish combinations and custom identities', () => {
    expect(pairingMediaKey({ base: 'Ivory', top: 'Brass', label: 'Large' })).not.toBe(pairingMediaKey({ base: 'Black', top: 'Brass', label: 'Large' }));
    expect(pairingMediaKey({ base: null, top: null, label: null }, 'a')).toBe('custom:a');
  });
  it('shows the assigned photo instead of a macro', () => { expect(pairingMediaPreview('hero','photo','tile')).toEqual({ image: 'photo', macro: null, status: 'Finish photo' }); });
  it('falls back to hero and macro when the assigned photo fails', () => { expect(pairingMediaPreview('hero','photo','tile',['photo']).macro).toBe('tile'); expect(pairingMediaPreview('hero','photo','tile',['photo']).image).toBe('hero'); });
  it('flags missing fallback assets', () => { expect(pairingMediaPreview('hero',null,'tile',['tile']).status).toBe('Missing finish photo and texture detail'); });
  it('rejects unsupported files and oversized images', () => { expect(pairingUploadError({ type:'image/svg+xml', size:100 })).not.toBeNull(); expect(pairingUploadError({type:'image/jpeg',size:21*1024*1024})).not.toBeNull(); expect(pairingUploadError({type:'image/jpeg',size:1024})).toBeNull(); });
  it('rejects duplicates and non-HTTPS image assignments', () => { expect(pairingMediaError([{key:'a',label:'A',product_image_url:'javascript:bad'}])).not.toBeNull(); expect(pairingMediaError([{key:'a',label:'A'},{key:'a',label:'A'}])).not.toBeNull(); });
});