import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  api,
  ApiError,
  type AdminOverview,
  type AdminUser,
} from '../lib/api';
import { useAuthStore } from '../lib/authStore';
import { Button, Icon, Toggle } from './ui';

/** Instrument-panel admin view. Replaces the dashboard rather than floating over it. */
export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchAll = useCallback(
    async () =>
      Promise.all([
        api.get<AdminOverview>('/api/admin/overview'),
        api.get<{ users: AdminUser[] }>('/api/admin/users'),
      ]),
    [],
  );

  const refresh = useCallback(async () => {
    const [o, u] = await fetchAll();
    setOverview(o);
    setUsers(u.users);
    setError(null);
  }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([o, u]) => {
        if (cancelled) return;
        setOverview(o);
        setUsers(u.users);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load admin data');
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const act = async (fn: () => Promise<unknown>, message?: string) => {
    try {
      await fn();
      await refresh();
      setError(null);
      if (message) {
        setNotice(message);
        window.setTimeout(() => setNotice(null), 4000);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    }
  };

  return (
    <div className="dot-grid-subtle min-h-dvh">
      <div className="mx-auto max-w-[1100px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="nd-display text-display-md">ADMIN</h1>
            <p className="nd-label mt-3">Users, access and instance state</p>
          </div>
          <Button size="sm" onClick={onClose}>
            Back to panel
          </Button>
        </header>

        {error && (
          <p className="mt-8 font-mono text-caption uppercase tracking-[0.04em] text-accent">
            [ERROR: {error}]
          </p>
        )}
        {notice && (
          <p className="mt-8 font-mono text-caption uppercase tracking-[0.04em] text-success">
            [{notice}]
          </p>
        )}

        {/* Instance readout */}
        <section className="mt-10 border-t border-line pt-4">
          <h2 className="nd-label">Instance</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Users" value={overview?.users} />
            <Stat label="Admins" value={overview?.admins} />
            <Stat label="Sessions" value={overview?.activeSessions} />
            <Stat label="Stored keys" value={overview?.storedKeys} />
            <Stat label="Uptime" value={formatUptime(overview?.uptimeSeconds)} />
            <Stat label="Node" value={overview?.node} />
          </div>
        </section>

        {/* Registration gate */}
        <section className="mt-10 flex items-center justify-between border-t border-line pt-4">
          <div>
            <h2 className="nd-label">Registration</h2>
            <p className="nd-caption mt-2 text-ink-disabled">
              {overview?.registrationOpen
                ? 'ANYONE CAN CREATE AN ACCOUNT — CLOSE THIS ONCE YOU HAVE YOURS'
                : 'CLOSED. ONLY EXISTING ACCOUNTS CAN SIGN IN'}
            </p>
          </div>
          <Toggle
            label="Registration open"
            checked={Boolean(overview?.registrationOpen)}
            onChange={() =>
              act(() =>
                api.put('/api/admin/registration', { open: !overview?.registrationOpen }),
              )
            }
          />
        </section>

        {/* Users */}
        <section className="mt-10 border-t border-line pt-4">
          <h2 className="nd-label">Users</h2>
          <ul className="mt-2">
            {users.map((user) => (
              <UserRow key={user.id} user={user} onAct={act} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="py-2">
      <p className="nd-label">{label}</p>
      <p className="nd-data mt-1 text-subheading text-ink-display">
        {value ?? '—'}
      </p>
    </div>
  );
}

function UserRow({
  user,
  onAct,
}: {
  user: AdminUser;
  onAct: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const me = useAuthStore((s) => s.user);
  const isSelf = me?.id === user.id;

  return (
    <li className="border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-body-sm text-ink">
          {user.name} {user.surname}
        </span>
        <span className="nd-data text-caption text-ink-muted">{user.email}</span>

        {user.isOwner && <Tag tone="accent">OWNER</Tag>}
        {user.isAdmin && !user.isOwner && <Tag>ADMIN</Tag>}
        {isSelf && <Tag>YOU</Tag>}

        <span className="nd-caption ml-auto text-ink-disabled">
          {user.activeSessions} SESSION{user.activeSessions === 1 ? '' : 'S'} ·{' '}
          {user.lastLogin ? `LAST ${user.lastLogin.replace(' ', ' · ')}` : 'NEVER SIGNED IN'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={user.isOwner}
          onClick={() =>
            onAct(() =>
              api.put(`/api/admin/users/${user.id}/admin`, { isAdmin: !user.isAdmin }),
            )
          }
        >
          {user.isAdmin ? 'Revoke admin' : 'Make admin'}
        </Button>

        <Button size="sm" variant="ghost" onClick={() => setResetting((v) => !v)}>
          Reset password
        </Button>

        {confirmDelete ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                onAct(
                  () => api.del(`/api/admin/users/${user.id}`),
                  `DELETED ${user.email}`,
                )
              }
            >
              Confirm delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            disabled={user.isOwner}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>

      {resetting && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="NEW PASSWORD"
            className="min-w-0 flex-1 border-b border-line-strong bg-transparent pb-1
              font-mono text-caption uppercase tracking-[0.06em] text-ink outline-none
              placeholder:text-ink-disabled focus:border-ink-display"
          />
          <Button
            size="sm"
            disabled={password.length < 8}
            onClick={() =>
              onAct(async () => {
                await api.post(`/api/admin/users/${user.id}/reset-password`, {
                  password,
                });
                setPassword('');
                setResetting(false);
              }, `PASSWORD RESET FOR ${user.email} — THEIR SESSIONS WERE CLOSED`)
            }
          >
            <Icon name="check" size={14} />
            Apply
          </Button>
        </div>
      )}
    </li>
  );
}

function Tag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <span
      className={`rounded-tech border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
        tone === 'accent'
          ? 'border-accent text-accent'
          : 'border-line-strong text-ink-muted'
      }`}
    >
      {children}
    </span>
  );
}

function formatUptime(seconds?: number): string | undefined {
  if (seconds === undefined) return undefined;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
