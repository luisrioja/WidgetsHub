import { db } from './db.js';

/**
 * Per-user widget state.
 *
 * Widget data used to live in the browser's localStorage, which meant it did
 * not survive clearing the browser and two accounts on the same machine
 * overwrote each other. It now lives here, keyed by user.
 *
 * Conflict resolution is last-write-wins on `updated_at`, supplied by the
 * client. Two devices editing the same widget converge on the later edit
 * rather than one silently clobbering the other on load.
 */

const MAX_KEY_LENGTH = 128;
const MAX_VALUE_BYTES = 256 * 1024;
const MAX_KEYS_PER_USER = 200;

export class StateError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertKey(key) {
  if (typeof key !== 'string' || !key.length || key.length > MAX_KEY_LENGTH) {
    throw new StateError('Invalid state key');
  }
}

/** Every stored key for a user, as `{ key: { value, updatedAt } }`. */
export function getAllState(userId) {
  const rows = db
    .prepare('SELECT key, value, updated_at FROM widget_state WHERE user_id = ?')
    .all(userId);

  const out = {};
  for (const row of rows) {
    out[row.key] = { value: row.value, updatedAt: row.updated_at };
  }
  return out;
}

/**
 * Writes a key unless the stored copy is newer. Returns the row that ended up
 * winning, so the client can reconcile when its write was rejected as stale.
 */
export function putState(userId, key, value, updatedAt) {
  assertKey(key);

  if (typeof value !== 'string') {
    throw new StateError('State value must be a JSON string');
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) {
    throw new StateError('State value is too large', 413);
  }

  const stamp = Number.isFinite(updatedAt) ? Number(updatedAt) : Date.now();

  const existing = db
    .prepare('SELECT value, updated_at FROM widget_state WHERE user_id = ? AND key = ?')
    .get(userId, key);

  if (existing && existing.updated_at > stamp) {
    return { value: existing.value, updatedAt: existing.updated_at, stale: true };
  }

  if (!existing) {
    const count = db
      .prepare('SELECT COUNT(*) AS n FROM widget_state WHERE user_id = ?')
      .get(userId).n;
    if (count >= MAX_KEYS_PER_USER) {
      throw new StateError('Too many stored keys', 409);
    }
  }

  db.prepare(
    `INSERT INTO widget_state (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE
       SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(userId, key, value, stamp);

  return { value, updatedAt: stamp, stale: false };
}

export function deleteState(userId, key) {
  assertKey(key);
  db.prepare('DELETE FROM widget_state WHERE user_id = ? AND key = ?').run(userId, key);
}

/**
 * One-shot import of the keys a browser still holds in localStorage. Existing
 * server keys always win, so running it twice cannot overwrite newer data.
 */
export function importState(userId, entries) {
  if (!entries || typeof entries !== 'object') return { imported: 0 };

  let imported = 0;
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value !== 'string') continue;
    try {
      assertKey(key);
    } catch {
      continue;
    }
    const exists = db
      .prepare('SELECT 1 FROM widget_state WHERE user_id = ? AND key = ?')
      .get(userId, key);
    if (exists) continue;

    putState(userId, key, value, Date.now());
    imported++;
  }
  return { imported };
}
