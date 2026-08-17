import { useAuthStore } from '../lib/authStore';
import { Button } from './ui';

/**
 * Identity strip in the dashboard header. Initials only — the panel is shared
 * on a screen, so the full address stays in the admin view.
 */
export default function AccountMenu({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const initials = `${user.name[0] ?? ''}${user.surname[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {user.isAdmin && (
        <Button size="sm" variant="ghost" onClick={onOpenAdmin}>
          Admin
        </Button>
      )}

      <span
        title={user.email}
        className="flex h-9 w-9 items-center justify-center rounded-pill border
          border-line-strong font-mono text-label tracking-[0.04em] text-ink-muted"
      >
        {initials}
      </span>

      <Button size="sm" variant="ghost" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}
