import { Router } from 'express';
import { requireAdmin } from '../lib/auth.js';
import {
  listUsers,
  overview,
  setAdmin,
  resetPassword,
  deleteUser,
  AdminError,
} from '../lib/admin.js';
import { isRegistrationOpen, setRegistrationOpen } from '../lib/registration.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

function handle(res, err, next) {
  if (err instanceof AdminError) return res.status(err.status).json({ error: err.message });
  next(err);
}

adminRouter.get('/overview', (_req, res) => {
  res.json({ ...overview(), registrationOpen: isRegistrationOpen() });
});

adminRouter.get('/users', (_req, res) => {
  res.json({ users: listUsers() });
});

adminRouter.put('/users/:id/admin', (req, res, next) => {
  try {
    setAdmin(Number(req.params.id), Boolean(req.body?.isAdmin));
    res.json({ users: listUsers() });
  } catch (err) {
    handle(res, err, next);
  }
});

adminRouter.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    await resetPassword(Number(req.params.id), req.body?.password);
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, next);
  }
});

adminRouter.delete('/users/:id', (req, res, next) => {
  try {
    deleteUser(Number(req.params.id));
    res.json({ users: listUsers() });
  } catch (err) {
    handle(res, err, next);
  }
});

adminRouter.put('/registration', (req, res) => {
  setRegistrationOpen(Boolean(req.body?.open));
  res.json({ registrationOpen: isRegistrationOpen() });
});
