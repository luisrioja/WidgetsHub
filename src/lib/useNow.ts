import { useEffect, useState } from 'react';

/**
 * A ticking clock for rendering only.
 *
 * Timer state itself is stored as absolute deadlines, so components just need
 * a periodic nudge to re-derive what to display. Keeping `now` out of the
 * persisted store avoids writing to localStorage on every frame.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [intervalMs]);

  return now;
}
