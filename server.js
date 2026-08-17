import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { config } from './lib/config.js';
import { attachUser } from './lib/auth.js';
import { countUsers } from './lib/db.js';
import { hasConfiguredAdmins } from './lib/admins.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { stateRouter } from './routes/state.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'dist');

const app = express();

// Cloudflare terminates TLS in front of this, so the forwarded scheme decides
// whether session cookies are marked Secure.
app.set('trust proxy', true);
app.disable('x-powered-by');

app.use(express.json({ limit: '512kb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(attachUser);

/** Public: the deploy script polls this to confirm a release came up. */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/state', stateRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint' }));

/* ------------------------------------------------------------------ *
 * Static frontend
 * ------------------------------------------------------------------ */

if (existsSync(publicDir)) {
  // Vite fingerprints filenames under /assets, so those can be cached hard.
  app.use(
    '/assets',
    express.static(path.join(publicDir, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }),
  );

  // Everything else must revalidate, or a deploy leaves stale HTML behind.
  app.use(
    express.static(publicDir, {
      etag: true,
      lastModified: true,
      maxAge: 0,
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    }),
  );

  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[widgethub]', err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(config.port, () => {
  const users = countUsers();
  console.log(`[widgethub] listening on :${config.port}`);
  console.log(`[widgethub] data dir ${config.dataDir}`);
  if (!hasConfiguredAdmins) {
    console.log(
      users === 0
        ? '[widgethub] no admin configured — the first account to register becomes admin'
        : '[widgethub] no admin configured via WIDGETHUB_ADMIN_EMAILS',
    );
  }
  if (users === 0) {
    console.log('[widgethub] registration is open until the first account exists');
  }
});
