import {
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react';
import { api, ApiError, type SessionUser } from '../../lib/api';
import { Button, Segmented } from '../ui';
import ThemeToggle from '../ThemeToggle';

type Mode = 'login' | 'register';

interface AuthConfig {
  registrationOpen: boolean;
  minPasswordLength: number;
}

export default function LoginScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: SessionUser) => void;
}) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    api
      .get<AuthConfig>('/api/auth/config')
      .then(setConfig)
      .catch(() => setConfig({ registrationOpen: false, minPasswordLength: 8 }));
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : form;
      const { user } = await api.post<{ user: SessionUser }>(
        `/api/auth/${mode}`,
        payload,
      );
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server');
      setBusy(false);
    }
  };

  const canRegister = config?.registrationOpen ?? false;

  return (
    <div className="dot-grid-subtle flex min-h-dvh flex-col">
      <header className="flex items-start justify-between px-6 py-10 sm:px-10 lg:px-14">
        <div>
          <h1 className="nd-display text-display-md sm:text-display-lg">WIDGET HUB</h1>
          <p className="nd-label mt-3">Modular instrument panel</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-16 sm:px-10">
        <div className="w-full max-w-[380px]">
          <div className="border-t border-line pt-3">
            <span className="nd-label">
              {mode === 'login' ? 'Restricted — sign in' : 'Create account'}
            </span>
          </div>

          {canRegister && (
            <div className="mt-6">
              <Segmented
                label="Mode"
                value={mode}
                options={[
                  { value: 'login' as Mode, label: 'Sign in' },
                  { value: 'register' as Mode, label: 'Register' },
                ]}
                onChange={(next) => {
                  setMode(next);
                  setError(null);
                }}
              />
            </div>
          )}

          <form onSubmit={submit} className="mt-8 space-y-6">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Name"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="given-name"
                  required
                />
                <Field
                  label="Surname"
                  value={form.surname}
                  onChange={set('surname')}
                  autoComplete="family-name"
                  required
                />
              </div>
            )}

            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />

            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? config?.minPasswordLength : undefined}
              required
            />

            {mode === 'register' && (
              <p className="nd-caption text-ink-disabled">
                MINIMUM {config?.minPasswordLength ?? 8} CHARACTERS
              </p>
            )}

            {error && (
              <p className="font-mono text-caption uppercase tracking-[0.04em] text-accent">
                [ERROR: {error}]
              </p>
            )}

            <Button type="submit" variant="primary" block disabled={busy}>
              {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {!canRegister && config && (
            <p className="nd-caption mt-6 text-ink-disabled">
              Registration is closed.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="nd-label">{label}</span>
      <input
        {...props}
        className="mt-2 w-full border-b border-line-strong bg-transparent pb-2
          font-mono text-body-sm text-ink outline-none transition-colors duration-200 ease-nd
          focus:border-ink-display"
      />
    </label>
  );
}
