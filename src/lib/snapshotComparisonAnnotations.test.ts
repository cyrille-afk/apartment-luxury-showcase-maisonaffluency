import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), session: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, auth: { getSession: mocks.session } } }));
import { loadComparisonAnnotations, saveComparisonAnnotations, validateComparisonAnnotations } from './snapshotComparisonAnnotations';
describe('project comparison annotations', () => {
  it('reads only the selected project and ordered snapshot pair', async () => {
    const eq = vi.fn(); eq.mockReturnValue({ eq, maybeSingle: async () => ({ data: { annotations: { summary: 'Oak', photos: { __summary: ['data:image/jpeg;base64,YWJj'] } } }, error: null }) });
    mocks.from.mockReturnValue({ select: () => ({ eq }) });
    expect(await loadComparisonAnnotations('penthouse', 'left', 'right')).toEqual({ summary: 'Oak', photos: { __summary: ['data:image/jpeg;base64,YWJj'] } });
    expect(eq.mock.calls).toEqual([['project_key', 'penthouse'], ['left_snapshot_id', 'left'], ['right_snapshot_id', 'right']]);
  });
  it('updates one owner-bound pair atomically including photos', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null }); mocks.from.mockReturnValue({ upsert });
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null });
    const annotations = { summary: 'Retain oak', photos: { chair: ['data:image/jpeg;base64,YWJj'] } };
    await saveComparisonAnnotations('penthouse', 'left', 'right', annotations);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner', project_key: 'penthouse', left_snapshot_id: 'left', right_snapshot_id: 'right', annotations }), { onConflict: 'user_id,project_key,left_snapshot_id,right_snapshot_id' });
  });
  it('rejects remote photos and more than three reference photos per note', () => {
    expect(() => validateComparisonAnnotations({ photos: { chair: ['https://example.com/private.jpg'] } })).toThrow();
    expect(() => validateComparisonAnnotations({ photos: { chair: Array(4).fill('data:image/jpeg;base64,YWJj') } })).toThrow();
  });
  it('does not report failed writes as saved', async () => {
    mocks.from.mockReturnValue({ upsert: async () => ({ error: new Error('offline') }) });
    await expect(saveComparisonAnnotations('penthouse', 'left', 'right', {})).rejects.toThrow('offline');
  });
});