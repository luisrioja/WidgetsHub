import { db, getSetting, setSetting, countUsers } from './db.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from './auth.js';
import { isConfiguredAdmin, hasConfiguredAdmins } from './admins.js';

const KEY = 'registration_open';

/**
 * Registration is open while there are no accounts — otherwise nobody could
 * create the first one. After that it follows the stored setting.
 */
export function isRegistrationOpen() {
  if (countUsers() === 0) return true;
  return getSetting(KEY, '1') === '1';
}

export function setRegistrationOpen(open) {
  setSetting(KEY, open ? '1' : '0');
}

export class RegistrationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerUser({ name, surname, email, password }) {
  const cleanName = String(name ?? '').trim();
  const cleanSurname = String(surname ?? '').trim();
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  if (!cleanName || !cleanSurname) {
    throw new RegistrationError('Name and surname are required');
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    throw new RegistrationError('That email address is not valid');
  }
  if (String(password ?? '').length < MIN_PASSWORD_LENGTH) {
    throw new RegistrationError(
      `The password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  const firstUser = countUsers() === 0;

  // The owner can always register, even with registration closed — otherwise
  // a closed instance plus a lost account would be unrecoverable.
  if (!isRegistrationOpen() && !isConfiguredAdmin(cleanEmail)) {
    throw new RegistrationError('Registration is closed', 403);
  }

  if (db.prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(cleanEmail)) {
    throw new RegistrationError('That email is already registered', 409);
  }

  // With no configured owner the first account takes admin, so a fresh
  // deployment is bootstrappable without an address in the repository.
  const isAdmin =
    isConfiguredAdmin(cleanEmail) || (firstUser && !hasConfiguredAdmins);

  const passwordHash = await hashPassword(password);

  const result = db
    .prepare(
      `INSERT INTO users (name, surname, email, password_hash, is_admin)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(cleanName, cleanSurname, cleanEmail, passwordHash, isAdmin ? 1 : 0);

  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(result.lastInsertRowid);
}
