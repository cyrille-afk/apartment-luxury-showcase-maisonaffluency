import { describe, expect, it } from 'vitest';
import { snapshotChanges, snapshotFinishes, snapshotFootprint } from './projectSnapshotComparison';
import type { PlacedObject } from '@/components/trade/visualiser/SceneObject';
import type { ProjectSnapshotData } from './projectLayoutSnapshots';
const chair = { instanceId: 'chair', product_name: 'Chair', position: [1, 0, 2], rotation: [0, 0, 0], scale: 1, width_mm: 800, depth_mm: 900, material: { id: 'oak', name: 'Oak', image_url: 'https://example.com/oak.jpg' }, partMaterials: { frame: { id: 'brass', name: 'Brass', image_url: null } } } as PlacedObject;
const data = (objects: PlacedObject[]): ProjectSnapshotData => ({ version: 1, scene: { objects }, bounds: { width: 12, depth: 8, height: 3 }, floorPlanUrl: null });
describe('snapshot comparison', () => {
  it('matches repeated product instances by instance id and identifies additions/removals', () => {
    const other = { ...chair, instanceId: 'other' };
    const changes = snapshotChanges(data([chair]), data([other]));
    expect(changes.map(c => [c.id, c.status])).toEqual([['chair', 'Removed'], ['other', 'Added']]);
  });
  it('detects moved and rotated pieces without changing snapshots', () => {
    const left = data([chair]); const before = JSON.stringify(left);
    const right = data([{ ...chair, position: [3, 0, 2], rotation: [0, Math.PI / 2, 0] }]);
    expect(snapshotChanges(left, right)[0]).toMatchObject({ status: 'Changed', layoutChanged: true, finishesChanged: false });
    expect(JSON.stringify(left)).toBe(before);
    expect(right.scene.objects[0].position).toEqual([3, 0, 2]);
  });
  it('detects finish changes on independent mesh parts', () => {
    const right = { ...chair, partMaterials: { frame: { ...chair.partMaterials?.frame, id: 'steel', name: 'Steel' } } } as PlacedObject;
    expect(snapshotChanges(data([chair]), data([right]))[0]).toMatchObject({ layoutChanged: false, finishesChanged: true });
    expect(snapshotFinishes(chair)).toEqual([expect.objectContaining({ name: 'Oak', image: 'https://example.com/oak.jpg' }), expect.objectContaining({ name: 'Brass' })]);
  });
  it('uses recorded dimensions and scale for top-down footprints', () => {
    expect(snapshotFootprint({ ...chair, scale: 2 })).toEqual({ width: 1.6, depth: 1.8 });
  });
  it('keeps identical pieces unchanged and handles empty snapshots', () => {
    expect(snapshotChanges(data([chair]), data([structuredClone(chair)]))[0].status).toBe('Unchanged');
    expect(snapshotChanges(data([]), data([]))).toEqual([]);
  });
});