import { config } from './config.js';

/**
 * Owner emails, supplied at runtime only.
 *
 * This repository is public, so no address is hardcoded. Set
 * WIDGETHUB_ADMIN_EMAILS (comma separated) or `adminEmails` in
 * data/secrets.json. When the list is empty the first account to register
 * becomes the admin, which keeps a fresh deployment bootstrappable.
 */
export const adminEmails = config.adminEmails;

export const hasConfiguredAdmins = adminEmails.length > 0;

export function isConfiguredAdmin(email) {
  return adminEmails.includes(String(email).trim().toLowerCase());
}
