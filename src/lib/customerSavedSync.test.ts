import { describe, it, expect } from 'vitest';
import { CustomerSavedSync, type SavedRemote } from './customerSavedSync';
import { applySavedChanges, emptySavedCollection, type SavedCollection } from './customerSavedCollection';

function device(remote: SavedRemote) {
  const data = new Map<string, string>();
  const storage: Storage = { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); }, clear: () => data.clear() };
  const sync = new CustomerSavedSync(); const target = new EventTarget();
  const save = (ids: string[]) => { storage.setItem('public_favorites', JSON.stringify(ids)); target.dispatchEvent(new Event('public_favorites_changed')); };
  return { sync, storage, target, save, start: (id: string | null) => sync.start(id, remote, storage, target) };
}
function backend() {
  let value = emptySavedCollection(); let failing = false;
  const remote: SavedRemote = {
    read: async () => { if (failing) throw Error('unavailable'); return structuredClone(value); },
    change: async changes => { if (failing) throw Error('unavailable'); value = applySavedChanges(value, changes); return structuredClone(value); },
  };
  return { remote, get: () => value, fail: (flag: boolean) => { failing = flag; }, set: (next: SavedCollection) => { value = next; } };
}

describe('private public-customer saving', () => {
  it('restores favorites and named folder membership on a fresh device without Trade roles', async () => {
    const db = backend(); const a = device(db.remote); await a.start('customer');
    a.save(['mono-sts']); await a.sync.flush();
    a.storage.setItem('public_favorite_folders', JSON.stringify([{ id: 'living-room', name: 'Living room', createdAt: 1 }]));
    a.target.dispatchEvent(new Event('public_favorite_folders_changed'));
    a.storage.setItem('public_favorite_assignments', JSON.stringify({ 'mono-sts': ['living-room'] }));
    a.target.dispatchEvent(new Event('public_favorites_changed')); await a.sync.flush();
    const b = device(db.remote); await b.start('customer');
    expect(JSON.parse(b.storage.getItem('public_favorites') ?? '[]')).toEqual(['mono-sts']);
    expect(JSON.parse(b.storage.getItem('public_favorite_folders') ?? '[]')).toEqual([{ id: 'living-room', name: 'Living room', createdAt: 1 }]);
    expect(JSON.parse(b.storage.getItem('public_favorite_assignments') ?? '{}')).toEqual({ 'mono-sts': ['living-room'] });
  });
  it('merges independent additions from stale devices instead of replacing the other device', async () => {
    const db = backend(); const a = device(db.remote); const b = device(db.remote);
    await a.start('customer'); await b.start('customer');
    a.save(['mono-sts']); await a.sync.flush(); b.save(['rift-cts']); await b.sync.flush();
    expect(db.get().favorites).toEqual(['mono-sts', 'rift-cts']);
    await a.sync.retry(); expect(a.storage.getItem('public_favorites')).toBe('["mono-sts","rift-cts"]');
  });
  it('adopts legacy browser saves as additions once and never copies them into another account', async () => {
    const db = backend(); db.set({ ...emptySavedCollection(), favorites: ['existing'] });
    const a = device(db.remote); a.storage.setItem('public_favorites', '["legacy"]'); await a.start('customer-a');
    expect(db.get().favorites).toEqual(['existing', 'legacy']);
    a.sync.clearProjection(); expect(a.storage.getItem('public_favorites')).toBe('[]');
    db.set(emptySavedCollection()); await a.start('customer-b');
    expect(db.get().favorites).toEqual([]);
  });
  it('keeps failed pending saves through reload and retries idempotently', async () => {
    const db = backend(); const a = device(db.remote); await a.start('customer'); db.fail(true);
    a.save(['mono-sts']); await a.sync.flush(); expect(a.sync.getState().status).toBe('error');
    db.fail(false);
    const reloaded = new CustomerSavedSync(); await reloaded.start('customer', db.remote, a.storage, new EventTarget());
    expect(db.get().favorites).toEqual(['mono-sts']); expect(reloaded.getState().status).toBe('saved');
  });
  it('never writes an empty snapshot after an initial read failure and preserves legacy adoption', async () => {
    const db = backend(); db.fail(true); const a = device(db.remote); a.storage.setItem('public_favorites', '["legacy"]');
    await a.start('customer'); expect(db.get().favorites).toEqual([]); expect(a.sync.getState().status).toBe('error');
    db.fail(false); await a.sync.retry(); expect(db.get().favorites).toEqual(['legacy']);
  });
  it('removing a favorite also removes its folder assignment on all devices', async () => {
    const db = backend(); db.set({ favorites: ['mono-sts'], folders: { room: { id: 'room', name: 'Room', createdAt: 1 } }, assignments: { 'mono-sts': ['room'] } });
    const a = device(db.remote); await a.start('customer'); a.save([]); await a.sync.flush();
    expect(db.get().favorites).toEqual([]); expect(db.get().assignments).toEqual({}); expect(db.get().folders['room']?.name).toBe('Room');
  });
  it('ignores an old account read that finishes after switching accounts', async () => {
    let resolveOld: ((value: unknown) => void) | undefined;
    const remote: SavedRemote = { read: id => id === 'old' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve(emptySavedCollection()), change: async () => emptySavedCollection() };
    const a = device(remote); const old = a.start('old'); await a.start('new');
    resolveOld?.({ ...emptySavedCollection(), favorites: ['private-old'] }); await old;
    expect(a.sync.getState().userId).toBe('new'); expect(a.storage.getItem('public_favorites')).toBe('[]');
  });
});