import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SnapshotComparison from './SnapshotComparison';
const mocks = vi.hoisted(() => ({ load: vi.fn(), build: vi.fn(), download: vi.fn(), annotations: vi.fn().mockResolvedValue(null), saveAnnotations: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/snapshotComparisonAnnotations', () => ({ loadComparisonAnnotations: mocks.annotations, saveComparisonAnnotations: mocks.saveAnnotations, validateComparisonAnnotations: (v: unknown) => v }));
vi.mock('@/lib/projectLayoutSnapshots', () => ({ loadProjectSnapshot: mocks.load }));
vi.mock('@/lib/snapshotComparisonPdf', () => ({ buildSnapshotComparisonPdf: mocks.build, downloadSnapshotComparison: mocks.download }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });
const snapshots = [{ id: 'a', name: 'Oak room', created_at: '2026-10-18T12:00:00Z', piece_count: 1, thumbnail: null }, { id: 'b', name: 'Steel room', created_at: '2026-10-18T12:01:00Z', piece_count: 1, thumbnail: null }];
const room = { version: 1, bounds: { width: 12, depth: 8, height: 3 }, floorPlanUrl: null, scene: { objects: [{ instanceId: 'chair', product_name: 'Chair', brand_name: 'Studio', position: [1, 0, 2], rotation: [0, 0, 0], scale: 1, material: { id: 'oak', name: 'Oak', image_url: null } }] } };
describe('read-only snapshot review', () => {
  it('reopens saved project notes and photos and saves edits without restoring the scene', async () => {
    const photo = 'data:image/jpeg;base64,YWJj';
    mocks.load.mockResolvedValue(room);
    mocks.annotations.mockResolvedValueOnce({ summary: 'Keep the oak', notes: { chair: 'Retain this finish' }, photos: { __summary: [photo] } });
    const restore = vi.fn();
    render(<SnapshotComparison projectKey="project" snapshots={snapshots} onRestore={restore} onClose={vi.fn()} />);
    const note = await screen.findByRole('textbox', { name: 'Studio note for client' });
    await vi.waitFor(() => expect(note).toHaveValue('Keep the oak'));
    expect(screen.getByAltText('studio note reference photo 1')).toHaveAttribute('src', photo);
    fireEvent.change(note, { target: { value: 'Prefer oak for the client' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save annotations to project' }));
    await vi.waitFor(() => expect(mocks.saveAnnotations).toHaveBeenCalledWith('project', 'a', 'b', { summary: 'Prefer oak for the client', notes: { chair: 'Retain this finish' }, photos: { __summary: [photo] } }));
    expect(restore).not.toHaveBeenCalled();
  });
  it('keeps edits and reference photos available after a save failure', async () => {
    mocks.load.mockResolvedValue(room); mocks.saveAnnotations.mockRejectedValueOnce(new Error('offline'));
    render(<SnapshotComparison projectKey="project" snapshots={snapshots} onRestore={vi.fn()} onClose={vi.fn()} />);
    const note = await screen.findByRole('textbox', { name: 'Studio note for client' });
    await vi.waitFor(() => expect(note).toBeEnabled());
    fireEvent.change(note, { target: { value: 'Preserve my draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save annotations to project' }));
    await screen.findByRole('button', { name: 'Retry annotations' });
    expect(note).toHaveValue('Preserve my draft');
  });
  it('exports the loaded comparison without restoring or changing either scene', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    mocks.load.mockResolvedValue(room); mocks.build.mockResolvedValue(blob); mocks.download.mockResolvedValue(undefined);
    const restore = vi.fn(), previous = JSON.stringify(room);
    render(<SnapshotComparison projectKey="project" snapshots={snapshots} onRestore={restore} onClose={vi.fn()} />);
    const button = await screen.findByRole('button', { name: 'Download client PDF' });
    await vi.waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(mocks.build).toHaveBeenCalledWith({ snapshot: snapshots[0], data: room }, { snapshot: snapshots[1], data: room }, {});
    expect(mocks.download).toHaveBeenCalledWith(blob);
    expect(restore).not.toHaveBeenCalled(); expect(JSON.stringify(room)).toBe(previous);
  });
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