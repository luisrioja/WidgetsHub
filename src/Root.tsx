import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { api, type SessionUser } from './lib/api';
import { useAuthStore } from './lib/authStore';
import { loadRemoteState, migrateLocalState } from './lib/syncStorage';
import LoginScreen from './components/auth/LoginScreen';
import './lib/themeStore';

type Phase = 'checking' | 'anonymous' | 'loading' | 'ready' | 'failed';

/**
 * Boot sequence.
 *
 * Widget stores hydrate synchronously from the state cache the moment their
 * module is imported, so the app module must not be imported until that cache
 * is filled. That is why App arrives through a dynamic import here rather than
 * a static one at the top of the file.
 */
export default function Root() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);
  const [App, setApp] = useState<ComponentType | null>(null);
  const setUser = useAuthStore((s) => s.setUser);

  const enter = useCallback(
    async (user: SessionUser) => {
      setUser(user);
      setPhase('loading');
      try {
        await migrateLocalState();
        await loadRemoteState();
        const mod = await import('./App');
        setApp(() => mod.default);
        setPhase('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('failed');
      }
    },
    [setUser],
  );

  useEffect(() => {
    api
      .get<{ user: SessionUser | null }>('/api/auth/me')
      .then(({ user }) => (user ? enter(user) : setPhase('anonymous')))
      .catch(() => setPhase('anonymous'));
  }, [enter]);

  if (phase === 'anonymous') return <LoginScreen onAuthenticated={enter} />;

  if (phase === 'ready' && App) return <App />;

  return (
    <div className="dot-grid-subtle flex min-h-dvh items-center justify-center px-6">
      <p
        className={`font-mono text-caption uppercase tracking-[0.08em] ${
          phase === 'failed' ? 'text-accent' : 'text-ink-muted'
        }`}
      >
        {phase === 'failed' ? `[ERROR: ${error}]` : '[LOADING…]'}
      </p>
    </div>
  );
}
