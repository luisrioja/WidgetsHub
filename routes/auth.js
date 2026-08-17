import { Router } from 'express';
import { db } from '../lib/db.js';
import {
  verifyPassword,
  hashPassword,
  createSession,
  destroySession,
  destroyUserSessions,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  publicUser,
  MIN_PASSWORD_LENGTH,
} from '../lib/auth.js';
import {
  registerUser,
  isRegistrationOpen,
  RegistrationError,
} from '../lib/registration.js';

export const authRouter = Router();

/** Public, so the sign-in screen knows whether to offer the register tab. */
authRouter.get('/config', (_req, res) => {
  res.json({
    registrationOpen: isRegistrationOpen(),
    minPasswordLength: MIN_PASSWORD_LENGTH,
  });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const user = await registerUser(req.body ?? {});
    const token = createSession(user.id);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    setSessionCookie(req, res, token);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    const row = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);

    // Same message and roughly the same work either way, so the response does
    // not reveal whether an address is registered.
    const ok = row ? await verifyPassword(password, row.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });

    const token = createSession(row.id);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(row.id);
    setSessionCookie(req, res, token);
    res.json({ user: publicUser(row) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req, res) => {
  destroySession(req.sessionToken);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

authRouter.post('/password', requireAuth, async (req, res, next) => {
  try {
    const current = String(req.body?.currentPassword ?? '');
    const next_ = String(req.body?.newPassword ?? '');

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(current, row.password_hash))) {
      return res.status(403).json({ error: 'The current password is incorrect' });
    }
    if (next_.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `The password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      await hashPassword(next_),
      row.id,
    );
    // Changing your own password closes your other sessions, not this one.
    destroyUserSessions(row.id, req.sessionToken);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
