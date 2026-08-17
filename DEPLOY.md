# DEPLOY — WidgetsHub

Server inventory for this app. Host-specific values (addresses, hostnames,
owner email) are deliberately **not** in this file: the repository is public.
They live in the private infrastructure notes and in `data/secrets.json` on the
host.

---

## Shape

| | |
|---|---|
| Runtime | Node 22 (Express + `node:sqlite`) in Docker |
| Internal port | `3080` |
| Published port | `3080` |
| Install path | `/DATA/AppData/widgethub` (CasaOS AppData) |
| Repo clone | `/DATA/AppData/widgethub/repo`, branch `main` |
| Persistent data | `/DATA/AppData/widgethub/data` → `/app/data` |
| Autodeploy | cron, every minute, `deploy/update.sh` |
| Health | `GET /api/health` → `{"ok":true}`, public |

**The port is fixed at 3080.** The Cloudflare tunnel's public hostname points
at it; changing the port breaks the tunnel.

---

## Documented deviations from the global blueprint

The blueprint assumes a build-less frontend on systemd, no Docker. This app
deviates, deliberately:

| Blueprint | Here | Why |
|---|---|---|
| No frontend build | Vite + TypeScript build | The UI is a React SPA with a design-token layer. A build-less rewrite would be a rewrite of the whole app. |
| systemd unit + timer | Docker + CasaOS, cron timer | It was already deployed this way behind an existing Cloudflare hostname on 3080. Migrating to systemd would mean re-pointing the tunnel for no functional gain. |
| Port block 72xx | 3080 | Same reason: the tunnel already points here. |
| Nginx for statics | Node serves statics | Sessions, admin and per-user state need a server. One process now owns both. |

Everything else follows the blueprint: `node:sqlite` in WAL, idempotent schema
with additive migrations, mandatory login with an Admin section, `data/`
outside git, public health endpoint, pull-based autodeploy.

---

## The owner's email is never in the repo

`lib/admins.js` has **no default address**. Owner emails are read at runtime
from, in order of precedence:

1. `WIDGETHUB_ADMIN_EMAILS` — comma separated
2. `adminEmails` in `data/secrets.json`

```json
{
  "adminEmails": ["you@example.com"]
}
```

`chmod 600`, inside the mounted `data/` directory, never committed.

**If the list is empty, the first account to register becomes the admin.** That
keeps a fresh deployment bootstrappable without putting an address in a public
repository. Configuring the email additionally protects that account: the owner
cannot be demoted or deleted from the UI, and can always register even with
registration closed.

---

## First install

```bash
git clone https://github.com/luisrioja/WidgetsHub.git /DATA/AppData/widgethub/repo
cd /DATA/AppData/widgethub/repo
git checkout main
./deploy/setup.sh
```

`setup.sh` is idempotent. It creates `data/` (0700) and a `secrets.json`
skeleton (0600), fixes the executable bits, replaces any stale cron line with
the every-minute entry, builds and waits for health.

Then, in the browser:

1. Register — the first account becomes admin.
2. **Close registration** from the Admin section. Do this immediately if the
   app is reachable from the internet.

---

## Autodeploy

`deploy/update.sh` runs every minute:

```
fetch origin/main
 └─ no new commits → exit quietly
 └─ new commits    → reset --hard → docker compose build → up -d
                     → poll /api/health for 20s
                        ├─ healthy   → log success
                        └─ unhealthy → log failure (container left running)
```

`git reset --hard` only touches tracked files, so `data/` — the database and
`secrets.json` — survives every deploy.

A `flock` guard prevents overlapping runs, since a build on this hardware can
outlast the one-minute tick. The script body is wrapped in a `main()` function
so that rewriting the script mid-run cannot make bash execute a half-updated
file.

```bash
# force a deploy now
FORCE=1 /DATA/AppData/widgethub/repo/deploy/update.sh

# logs
tail -f /DATA/AppData/widgethub/update.log
docker logs -f widgethub
```

### History

The previous autodeploy was broken. Cron ran **weekly**, and the script it
called had at some point been overwritten with an unrelated installer, so from
April onwards every run did a `git fetch` and then died — the log never reached
its "finished" line again. The container in production was a build from June.
That is why this replacement verifies health and logs both outcomes.

---

## Troubleshooting: `npm error Exit handler never called!`

If `docker compose build` dies inside `npm ci` with:

```
npm error Exit handler never called!
```

the container has no outbound network. npm hangs on the registry and then exits
with that misleading message — it is not a lockfile or base-image problem.

The usual cause on a developer machine is a host firewall dropping forwarded
traffic from the Docker bridge (`ufw` ships with `DEFAULT_FORWARD_POLICY="DROP"`).
Confirm it in one command:

```bash
# bridge network — hangs when forwarding is blocked
docker run --rm node:22-alpine wget -qO- --timeout=10 https://registry.npmjs.org/react

# host network — succeeds either way
docker run --rm --network host node:22-alpine wget -qO- --timeout=10 https://registry.npmjs.org/react
```

Host-network works while the bridge fails ⇒ it is the firewall, not the build.
Either allow forwarding for the bridge, or build one-off with
`docker build --network host`.

The deployment host has no firewall enabled, so this only ever bites locally.

---

## Backups

The database is the only thing here that is not reproducible from git.

```bash
docker exec widgethub node -e "
  const {DatabaseSync} = require('node:sqlite');
  new DatabaseSync('/app/data/app.db').exec(\"VACUUM INTO '/app/data/backup.db'\");
"
```

Copy `data/backup.db` off the host afterwards. Do not copy `app.db` directly
while the container is running: in WAL mode that yields an inconsistent
snapshot.

---

## Endpoints

```
GET  /api/health                       public

GET  /api/auth/config                  public — is registration open
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/password                change your own

GET  /api/state                        all of the signed-in user's widget state
PUT  /api/state/:key                   last-write-wins on updatedAt
DELETE /api/state/:key
POST /api/state/import                 one-shot localStorage migration

GET    /api/admin/overview             admin only
GET    /api/admin/users
PUT    /api/admin/users/:id/admin
POST   /api/admin/users/:id/reset-password
DELETE /api/admin/users/:id
PUT    /api/admin/registration
```
