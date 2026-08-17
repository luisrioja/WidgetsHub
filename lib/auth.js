import {
  scrypt,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import { config } from './config.js';

const scryptAsync = promisify(scrypt);

const KEYLEN = 64;
const COOKIE = 'widgethub_session';

export const MIN_PASSWORD_LENGTH = 8;

/* ------------------------------------------------------------------ *
 * Passwords
 * ------------------------------------------------------------------ */

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, KEYLEN);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = await scryptAsync(password, salt, KEYLEN);

  // timingSafeEqual throws when the lengths differ, which would itself leak.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

export function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES (?, ?, datetime('now', ?))`,
  ).run(token, userId, `+${config.sessionDays} days`);
  return token;
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** Drops every session for a user. Used when a password changes. */
export function destroyUserSessions(userId, exceptToken = null) {
  if (exceptToken) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(
      userId,
      exceptToken,
    );
  } else {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
}

export function getSessionUser(token) {
  if (!token) return null;
  return (
    db
      .prepare(
        `SELECT u.id, u.name, u.surname, u.email, u.is_admin, u.created_at, u.last_login
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token = ? AND s.expires_at > datetime('now')`,
      )
      .get(token) ?? null
  );
}

/* ------------------------------------------------------------------ *
 * Cookies
 * ------------------------------------------------------------------ */

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Cloudflare terminates TLS, so trust the forwarded scheme to decide Secure. */
function isHttps(req) {
  return req.secure || req.get('x-forwarded-proto') === 'https';
}

export function setSessionCookie(req, res, token) {
  const parts = [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${config.sessionDays * 24 * 60 * 60}`,
  ];
  if (isHttps(req)) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req, res) {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (isHttps(req)) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function readSessionToken(req) {
  return parseCookies(req.get('cookie') || '')[COOKIE] || null;
}

/* ------------------------------------------------------------------ *
 * Middleware
 * ------------------------------------------------------------------ */

/** Attaches req.user when a valid session is present. Never rejects. */
export function attachUser(req, _res, next) {
  req.sessionToken = readSessionToken(req);
  req.user = getSessionUser(req.sessionToken);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
}

/** The shape sent to the client. Never includes password_hash. */
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    surname: row.surname,
    email: row.email,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}
