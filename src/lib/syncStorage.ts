import type { StateStorage } from 'zustand/middleware';
import { api } from './api';

/**
 * Widget state backed by the server, keyed by the signed-in user.
 *
 * The whole of a user's state is fetched once before the app renders, so every
 * read here is synchronous and the stores can hydrate the way they did from
 * localStorage. Writes go to an in-memory cache immediately and are flushed to
 * the server on a short debounce, so typing in a widget does not produce a
 * request per keystroke.
 */

interface Entry {
  value: string;
  updatedAt: number;
}

const cache = new Map<string, Entry>();
const pending = new Set<string>();
let flushTimer: number | null = null;
let loaded = false;

const FLUSH_DELAY = 600;

/* ------------------------------------------------------------------ *
 * Cross-tab notification
 *
 * State used to live in localStorage, so sibling tabs learned about a change
 * from the `storage` event. Server-backed state never touches localStorage, so
 * that event no longer fires and a channel takes its place.
 * ------------------------------------------------------------------ */

type ChangeHandler = (key: string) => void;

const listeners = new Set<ChangeHandler>();

const channel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('widgethub-state');

if (channel) {
  channel.onmessage = (event: MessageEvent<{ key: string; entry: Entry | null }>) => {
    const { key, entry } = event.data;
    if (entry) cache.set(key, entry);
    else cache.delete(key);
    for (const listener of listeners) listener(key);
  };
}

function broadcast(key: string): void {
  channel?.postMessage({ key, entry: cache.get(key) ?? null });
}

/** Subscribes to changes made in another tab. Returns an unsubscribe function. */
export function onStateChange(handler: ChangeHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

/** Keys the browser used before state moved server-side. */
export const LEGACY_KEYS = [
  'widgethub-glute',
  'antigravity-widgets',
  'widgethub-reminders',
  'widgethub-clock-settings',
  'widgethub-treadmill-steps',
] as const;

export function isStateLoaded(): boolean {
  return loaded;
}

/** Fetches the signed-in user's entire state. Call before rendering the app. */
export async function loadRemoteState(): Promise<void> {
  const { state } = await api.get<{ state: Record<string, Entry> }>('/api/state');
  cache.clear();
  for (const [key, entry] of Object.entries(state)) cache.set(key, entry);
  loaded = true;
}

/**
 * Uploads whatever the browser still holds locally, once. The server keeps any
 * key it already has, so this cannot clobber newer data and is safe to repeat.
 */
export async function migrateLocalState(): Promise<number> {
  const entries: Record<string, string> = {};
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) entries[key] = raw;
  }
  if (Object.keys(entries).length === 0) return 0;

  const { imported } = await api.post<{ imported: number }>('/api/state/import', {
    entries,
  });

  // Clear them only once the server has accepted the data, so a failed
  // migration can be retried on the next sign-in.
  for (const key of Object.keys(entries)) localStorage.removeItem(key);
  return imported;
}

/** Drops the cache on sign-out so the next user never sees the previous one's data. */
export function clearStateCache(): void {
  cache.clear();
  pending.clear();
  loaded = false;
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/* ------------------------------------------------------------------ *
 * Flushing
 * ------------------------------------------------------------------ */

async function flushKey(key: string): Promise<void> {
  const entry = cache.get(key);
  try {
    if (entry === undefined) {
      await api.del(`/api/state/${encodeURIComponent(key)}`);
      return;
    }
    const result = await api.put<{ value: string; updatedAt: number; stale: boolean }>(
      `/api/state/${encodeURIComponent(key)}`,
      { value: entry.value, updatedAt: entry.updatedAt },
    );
    // Another device wrote something newer; adopt it rather than fight over it.
    if (result.stale) cache.set(key, { value: result.value, updatedAt: result.updatedAt });
  } catch (err) {
    console.warn(`[state] could not save "${key}"`, err);
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    const keys = [...pending];
    pending.clear();
    for (const key of keys) void flushKey(key);
  }, FLUSH_DELAY);
}

/** Sends anything still queued. Used when the page is going away. */
export function flushNow(): void {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  const keys = [...pending];
  pending.clear();

  for (const key of keys) {
    const entry = cache.get(key);
    if (entry === undefined) continue;
    // keepalive lets the request outlive the page, and unlike sendBeacon it
    // can use PUT with a JSON body, so it hits the same endpoint as usual.
    void fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: entry.value, updatedAt: entry.updatedAt }),
    }).catch(() => {
      /* the page is going away; nothing useful to do with the failure */
    });
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
}

/* ------------------------------------------------------------------ *
 * Public accessors
 * ------------------------------------------------------------------ */

export function readState<T>(key: string, fallback: T): T {
  const entry = cache.get(key);
  if (!entry) return fallback;
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    return fallback;
  }
}

export function writeState(key: string, value: unknown): void {
  cache.set(key, { value: JSON.stringify(value), updatedAt: Date.now() });
  pending.add(key);
  broadcast(key);
  scheduleFlush();
}

/** Storage adapter for zustand's persist middleware. */
export const syncStorage: StateStorage = {
  getItem: (name) => cache.get(name)?.value ?? null,
  setItem: (name, value) => {
    cache.set(name, { value, updatedAt: Date.now() });
    pending.add(name);
    broadcast(name);
    scheduleFlush();
  },
  removeItem: (name) => {
    cache.delete(name);
    pending.add(name);
    broadcast(name);
    scheduleFlush();
  },
};
