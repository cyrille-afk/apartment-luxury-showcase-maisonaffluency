import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SnapshotComparison from './SnapshotComparison';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/projectLayoutSnapshots', () => ({ loadProjectSnapshot: mocks.load }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const snapshots = [{ id: 'a', name: 'Oak room', created_at: '2026-10-18T12:00:00Z', piece_count: 1, thumbnail: null }, { id: 'b', name: 'Steel room', created_at: '2026-10-18T12:01:00Z', piece_count: 1, thumbnail: null }];
const room = { version: 1, bounds: { width: 12, depth: 8, height: 3 }, floorPlanUrl: null, scene: { objects: [{ instanceId: 'chair', product_name: 'Chair', brand_name: 'Studio', position: [1, 0, 2], rotation: [0, 0, 0], scale: 1, material: { id: 'oak', name: 'Oak', image_url: null } }] } };
describe('read-only snapshot review', () => {
  it('loads both owner-project snapshots without restoring on open or close', async () => {
    mocks.load.mockResolvedValue(room); const restore = vi.fn(), close = vi.fn();
    render(<SnapshotComparison projectKey="project" snapshots={snapshots} onRestore={restore} onClose={close} />);
    await screen.findByRole('img', { name: 'Oak room furniture layout' });
    expect(mocks.load.mock.calls).toEqual([['project', 'a'], ['project', 'b']]);
    expect(restore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce(); expect(restore).not.toHaveBeenCalled();
  });
  it('requests the selected snapshot only after an explicit restore click', async () => {
    mocks.load.mockResolvedValue(room); const restore = vi.fn();
    render(<SnapshotComparison projectKey="project" snapshots={snapshots} onRestore={restore} onClose={vi.fn()} />);
    const actions = await screen.findAllByRole('button', { name: 'Restore this snapshot' });
    fireEvent.click(actions[1]); expect(restore).toHaveBeenCalledWith(snapshots[1]);
  });
  it('allows retry after a failed read without requesting a restore', async () => {
    mocks.load.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(room); const restore = vi.fn();
    render(<SnapshotComparison projectKey="project" snapshots={snapshots} onRestore={restore} onClose={vi.fn()} />);
    await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('img', { name: 'Oak room furniture layout' }); expect(restore).not.toHaveBeenCalled();
  });
});