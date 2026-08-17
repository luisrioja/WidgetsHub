import { db, countUsers } from './db.js';
import { hashPassword } from './auth.js';
import { isConfiguredAdmin } from './admins.js';
import { destroyUserSessions } from './auth.js';

export class AdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function getUser(id) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) throw new AdminError('No such user', 404);
  return row;
}

/**
 * The owner is protected from the UI: demoting or deleting them would leave
 * the instance with no administrator.
 */
function assertNotOwner(row, action) {
  if (isConfiguredAdmin(row.email)) {
    throw new AdminError(`The owner account cannot be ${action}`, 403);
  }
}

function assertNotLastAdmin(row, action) {
  const admins = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n;
  if (row.is_admin && admins <= 1) {
    throw new AdminError(`The last administrator cannot be ${action}`, 409);
  }
}

export function listUsers() {
  return db
    .prepare(
      `SELECT id, name, surname, email, is_admin, created_at, last_login,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = users.id
                 AND s.expires_at > datetime('now')) AS active_sessions
         FROM users
        ORDER BY created_at ASC`,
    )
    .all()
    .map((u) => ({
      id: u.id,
      name: u.name,
      surname: u.surname,
      email: u.email,
      isAdmin: Boolean(u.is_admin),
      isOwner: isConfiguredAdmin(u.email),
      createdAt: u.created_at,
      lastLogin: u.last_login,
      activeSessions: u.active_sessions,
    }));
}

export function overview() {
  const stateRows = db.prepare('SELECT COUNT(*) AS n FROM widget_state').get().n;
  const sessions = db
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now')")
    .get().n;
  return {
    users: countUsers(),
    admins: db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n,
    activeSessions: sessions,
    storedKeys: stateRows,
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
  };
}

export function setAdmin(id, makeAdmin) {
  const row = getUser(id);
  if (!makeAdmin) {
    assertNotOwner(row, 'demoted');
    assertNotLastAdmin(row, 'demoted');
  }
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(makeAdmin ? 1 : 0, id);
}

export async function resetPassword(id, password) {
  const row = getUser(id);
  if (String(password ?? '').length < 8) {
    throw new AdminError('The password must be at least 8 characters');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    await hashPassword(password),
    row.id,
  );
  // A forced password change invalidates that user's sessions.
  destroyUserSessions(row.id);
}

export function deleteUser(id) {
  const row = getUser(id);
  assertNotOwner(row, 'deleted');
  assertNotLastAdmin(row, 'deleted');
  // Sessions and widget_state cascade through their foreign keys, which
  // node:sqlite enforces by default.
  db.prepare('DELETE FROM users WHERE id = ?').run(row.id);
}
