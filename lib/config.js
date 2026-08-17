import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Configuration comes from three places, in order of precedence:
 *   1. environment variables
 *   2. data/secrets.json  (gitignored, chmod 600, lives only on the server)
 *   3. the defaults below
 *
 * Nothing personal is hardcoded here. This repository is public, so the
 * owner's email address is never written into the source — it is supplied at
 * runtime through WIDGETHUB_ADMIN_EMAILS or data/secrets.json. See DEPLOY.md.
 */

const DATA_DIR = process.env.WIDGETHUB_DATA_DIR
  ? path.resolve(process.env.WIDGETHUB_DATA_DIR)
  : path.join(process.cwd(), 'data');

mkdirSync(DATA_DIR, { recursive: true });

function readSecrets() {
  try {
    return JSON.parse(readFileSync(path.join(DATA_DIR, 'secrets.json'), 'utf8'));
  } catch {
    // No secrets file is a valid state: everything has an env fallback.
    return {};
  }
}

const secrets = readSecrets();

function parseEmails(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const config = {
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, 'app.db'),
  port: Number(process.env.PORT) || 3080,

  /**
   * Emails promoted to admin on every boot. When this is empty the first
   * account to register becomes the admin instead, so a fresh deployment is
   * still recoverable without putting an address in the repository.
   */
  adminEmails: parseEmails(
    process.env.WIDGETHUB_ADMIN_EMAILS ?? secrets.adminEmails,
  ),

  sessionDays: Number(process.env.WIDGETHUB_SESSION_DAYS) || 30,
};
