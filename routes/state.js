import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import {
  getAllState,
  putState,
  deleteState,
  importState,
  StateError,
} from '../lib/state.js';

export const stateRouter = Router();

stateRouter.use(requireAuth);

function handle(res, err, next) {
  if (err instanceof StateError) return res.status(err.status).json({ error: err.message });
  next(err);
}

/** The whole of a user's widget state, fetched once at boot. */
stateRouter.get('/', (req, res) => {
  res.json({ state: getAllState(req.user.id) });
});

stateRouter.put('/:key', (req, res, next) => {
  try {
    const result = putState(
      req.user.id,
      req.params.key,
      req.body?.value,
      req.body?.updatedAt,
    );
    res.json(result);
  } catch (err) {
    handle(res, err, next);
  }
});

stateRouter.delete('/:key', (req, res, next) => {
  try {
    deleteState(req.user.id, req.params.key);
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, next);
  }
});

/** One-shot migration of whatever the browser still holds locally. */
stateRouter.post('/import', (req, res, next) => {
  try {
    res.json(importState(req.user.id, req.body?.entries));
  } catch (err) {
    handle(res, err, next);
  }
});
