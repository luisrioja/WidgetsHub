import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { adminEmails } from './admins.js';

/**
 * The schema is applied on every boot and is idempotent, so the database is
 * correct whatever state it starts from — fresh, restored from backup, or
 * mid-upgrade.
 */

export const db = new DatabaseSync(config.dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    surname       TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_login    TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS widget_state (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
`);

// ALTER TABLE ADD COLUMN is not idempotent, so the real schema is inspected
// first. Additive only — a migration never drops data.
const MIGRATIONS = [];

const columnsOf = (table) =>
  db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

for (const [table, column, sql] of MIGRATIONS) {
  if (!columnsOf(table).includes(column)) db.exec(sql);
}

// Indexes go after the migration loop so they can depend on migrated columns.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_state_user    ON widget_state(user_id);
`);

/** Drops sessions whose expiry has passed. Cheap enough to run on every boot. */
export function purgeExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

/**
 * Promotes the configured owner emails to admin. Runs on every boot so the
 * owner cannot be locked out of their own instance by a bad UI action.
 */
export function promoteConfiguredAdmins() {
  const stmt = db.prepare('UPDATE users SET is_admin = 1 WHERE lower(email) = ?');
  for (const email of adminEmails) stmt.run(email);
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, String(value));
}

export function countUsers() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

purgeExpiredSessions();
promoteConfiguredAdmins();
