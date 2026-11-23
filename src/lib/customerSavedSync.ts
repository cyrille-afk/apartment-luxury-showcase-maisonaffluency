import { applySavedChanges, emptySavedCollection, parseSavedCollection, savedCollectionChanges, type SavedChange, type SavedCollection } from "./customerSavedCollection";

const keys = ['public_favorites', 'public_favorite_folders', 'public_favorite_assignments'] as const;
const events = ['public_favorites_changed', 'public_favorite_folders_changed'] as const;
export interface SavedRemote {
  read: (userId: string) => Promise<unknown>;
  change: (changes: SavedChange[]) => Promise<unknown>;
}
export interface SavedSyncState { userId: string | null; status: 'loading' | 'guest' | 'saved' | 'saving' | 'error' }
const initial: SavedSyncState = { userId: null, status: 'loading' };

/** Browser-only projection for existing public catalogue consumers; Trade favorites remain separate. */
export class CustomerSavedSync {
  private state: SavedSyncState = initial;
  private listeners = new Set<() => void>();
  private generation = 0;
  private baseline = emptySavedCollection();
  private pending: SavedChange[] = [];
  private remote: SavedRemote | null = null;
  private storage: Storage | null = null;
  private target: EventTarget | null = null;
  private applying = false;
  private running: Promise<void> | null = null;
  private initialized = false;
  getState = () => this.state;
  getServerState = () => initial;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private status(status: SavedSyncState['status']) { this.state = { userId: this.state.userId, status }; this.listeners.forEach(fn => fn()); }
  private cacheKey(id: string) { return `ma:customer-saved:v1:${id}`; }
  private readLocal(): SavedCollection {
    try {
      return parseSavedCollection({ favorites: JSON.parse(this.storage?.getItem(keys[0]) ?? '[]'), folders: JSON.parse(this.storage?.getItem(keys[1]) ?? '[]'), assignments: JSON.parse(this.storage?.getItem(keys[2]) ?? '{}') });
    } catch { return emptySavedCollection(); }
  }
  private publish(value: SavedCollection) {
    this.baseline = value;
    this.applying = true;
    try {
      this.storage?.setItem(keys[0], JSON.stringify(value.favorites));
      this.storage?.setItem(keys[1], JSON.stringify(Object.values(value.folders)));
      this.storage?.setItem(keys[2], JSON.stringify(value.assignments));
      for (const event of events) this.target?.dispatchEvent(new Event(event));
    } finally { this.applying = false; }
  }
  private cache() {
    const id = this.state.userId;
    if (id) this.storage?.setItem(this.cacheKey(id), JSON.stringify({ value: this.baseline, pending: this.pending }));
  }
  private localChange = () => {
    if (this.applying || !this.state.userId || this.state.status === 'loading') return;
    const next = this.readLocal();
    this.pending.push(...savedCollectionChanges(this.baseline, next));
    this.baseline = next;
    try { this.cache(); } catch { this.status('error'); return; }
    if (this.pending.length) void this.flush();
  };
  private onFocus = () => { void this.retry(); };
  async start(userId: string | null, remote: SavedRemote, storage: Storage, target: EventTarget) {
    if (this.initialized && this.state.userId === userId) return;
    this.initialized = true;
    const generation = ++this.generation;
    this.remote = remote; this.storage = storage;
    if (this.target) {
      for (const event of events) this.target.removeEventListener(event, this.localChange);
      this.target.removeEventListener('focus', this.onFocus); this.target.removeEventListener('online', this.onFocus);
    }
    this.target = target;
    const owner = storage.getItem('ma:customer-saved:projection-owner');
    const legacy = !owner && !storage.getItem('ma:customer-saved:legacy-claimed') ? this.readLocal() : emptySavedCollection();
    this.state = { userId, status: userId ? 'loading' : 'guest' };
    this.pending = []; this.running = null;
    this.publish(userId || owner ? emptySavedCollection() : legacy);
    this.listeners.forEach(fn => fn());
    if (!userId) { storage.removeItem('ma:customer-saved:projection-owner'); return; }
    storage.setItem('ma:customer-saved:projection-owner', userId);
    try {
      const cache = JSON.parse(storage.getItem(this.cacheKey(userId)) ?? 'null') as { value?: unknown; pending?: SavedChange[] } | null;
      this.pending = cache?.pending ?? [];
      const legacyChanges = savedCollectionChanges(emptySavedCollection(), legacy);
      this.pending.push(...legacyChanges);
      // Persist the adoption before the network read, including interrupted first sign-ins.
      this.baseline = applySavedChanges(parseSavedCollection(cache?.value), legacyChanges);
      this.cache();
      if (legacyChanges.length) storage.setItem('ma:customer-saved:legacy-claimed', userId);
      const loaded = parseSavedCollection(await remote.read(userId));
      if (generation !== this.generation) return;
      // Adopt old browser saves once, as additions, never replace an existing account collection.
      this.publish(applySavedChanges(loaded, this.pending));
      this.cache();
      for (const event of events) target.addEventListener(event, this.localChange);
      target.addEventListener('focus', this.onFocus); target.addEventListener('online', this.onFocus);
      this.status('saved');
      await this.flush();
    } catch {
      if (generation !== this.generation) return;
      // Never overwrite an unread account with the empty first-render projection.
      this.status('error');
    }
  }
  async flush(): Promise<void> {
    if (this.running) return this.running;
    const id = this.state.userId; const remote = this.remote; const generation = this.generation;
    if (!id || !remote || !this.pending.length) return;
    this.status('saving');
    this.running = (async () => {
      try {
        while (this.pending.length && generation === this.generation) {
          const batch = this.pending.slice(0, 500);
          const saved = parseSavedCollection(await remote.change(batch));
          if (generation !== this.generation) return;
          this.pending.splice(0, batch.length);
          this.publish(applySavedChanges(saved, this.pending));
          this.cache();
        }
        if (generation === this.generation) this.status('saved');
      } catch { if (generation === this.generation) this.status('error'); }
      finally { if (generation === this.generation) this.running = null; }
    })();
    return this.running;
  }
  async retry() {
    const id = this.state.userId; const remote = this.remote; const storage = this.storage; const target = this.target;
    if (!id || !remote || !storage || !target || this.running) return;
    if (this.state.status === 'error' || this.state.status === 'loading') { this.initialized = false; await this.start(id, remote, storage, target); return; }
    if (this.pending.length) { await this.flush(); return; }
    const generation = this.generation;
    try {
      const value = parseSavedCollection(await remote.read(id));
      if (generation === this.generation && !this.pending.length) { this.publish(value); this.cache(); this.status('saved'); }
    } catch { if (generation === this.generation) this.status('error'); }
  }
  clearProjection() {
    ++this.generation;
    this.initialized = false; this.pending = []; this.running = null;
    this.state = { userId: null, status: 'guest' };
    this.publish(emptySavedCollection());
    this.listeners.forEach(fn => fn());
  }
}
export const customerSavedSync = new CustomerSavedSync();