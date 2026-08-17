import { useGluteStore, remainingSeconds, type GlutePhase } from './gluteStore';
import { playAlarm, playComplete, playNag, playTick } from './audio';
import { sendNotification } from './notifications';

/**
 * Drives the glute timer for the whole app.
 *
 * Runs at App level rather than inside the widget so hiding the widget — or
 * scrolling it out of view — no longer stops the countdown. State transitions
 * are deadline-based and idempotent, so a throttled background tab simply
 * catches up on its next tick instead of losing time.
 */

const TICK_MS = 500;
const LEGACY_KEY = 'widgethub-sedentarismo-state';
const PERSIST_KEY = 'widgethub-glute';
const BEEP_CLAIM_KEY = 'widgethub-glute-beep';

/**
 * With several tabs open every tab reaches the same deadline at the same
 * moment. State stays consistent because transitions are idempotent, but the
 * sound would stack. The first tab to claim the slot plays it.
 */
function claimBeep(now: number, minGapMs = 1500): boolean {
  try {
    const last = Number(localStorage.getItem(BEEP_CLAIM_KEY) ?? 0);
    if (now - last < minGapMs) return false;
    localStorage.setItem(BEEP_CLAIM_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

/** Carries the durations over from the pre-refactor widget-local state. */
function migrateLegacyState(): void {
  try {
    if (localStorage.getItem(PERSIST_KEY)) return;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;

    const old = JSON.parse(raw) as {
      restDuration?: number;
      activationDuration?: number;
      animationsEnabled?: boolean;
    };

    const store = useGluteStore.getState();
    if (typeof old.restDuration === 'number' && old.restDuration > 0) {
      store.setRestMinutes(Math.round(old.restDuration / 60));
    }
    if (typeof old.activationDuration === 'number' && old.activationDuration > 0) {
      store.setActivationSeconds(old.activationDuration);
    }
    if (old.animationsEnabled === false) {
      store.toggleAnimations();
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* a corrupt legacy blob is not worth failing startup over */
  }
}

function notify(title: string, body: string, sticky: boolean, renotify: boolean) {
  if (!useGluteStore.getState().notificationsEnabled) return;
  sendNotification(title, body, {
    tag: 'widgethub-glute',
    sticky,
    renotify,
  });
}

export function startGluteEngine(): () => void {
  if (typeof window === 'undefined') return () => {};

  migrateLegacyState();

  let prevPhase: GlutePhase = useGluteStore.getState().phase;
  let prevActiveSeconds = -1;

  const sound = () => useGluteStore.getState().soundEnabled;

  const onPhaseChange = (phase: GlutePhase, now: number) => {
    if (phase === 'DUE') {
      if (sound() && claimBeep(now)) playAlarm();
      notify(
        'GLUTE ACTIVATION DUE',
        'Stand up. The timer waits until you start.',
        true,
        true,
      );
    }
    if (prevPhase === 'ACTIVE' && phase === 'REST') {
      if (sound() && claimBeep(now)) playComplete();
    }
  };

  const tick = () => {
    const now = Date.now();
    const store = useGluteStore.getState();

    store.tick(now);

    const next = useGluteStore.getState();

    if (next.phase !== prevPhase) {
      onPhaseChange(next.phase, now);
      prevPhase = next.phase;
      prevActiveSeconds = -1;
    }

    // Repeat reminder — the DUE state never expires on its own, so without
    // this a missed alert would sit there silently forever.
    if (next.phase === 'DUE') {
      const since = next.lastNagAt ?? next.dueSince ?? now;
      if (now - since >= next.nagSeconds * 1000) {
        useGluteStore.getState().markNagged(now);
        if (next.soundEnabled && claimBeep(now)) playNag();
        notify('STILL SITTING', 'Glute activation is still pending.', true, true);
      }
    }

    // Audible countdown over the final three seconds of an activation.
    if (next.phase === 'ACTIVE' && next.pausedRemaining === null) {
      const secs = remainingSeconds(next, now);
      if (secs !== prevActiveSeconds) {
        if (secs > 0 && secs <= 3 && next.soundEnabled && claimBeep(now, 400)) {
          playTick();
        }
        prevActiveSeconds = secs;
      }
    }
  };

  const interval = window.setInterval(tick, TICK_MS);

  // A throttled background tab can skip minutes of ticks; catching up the
  // instant it becomes visible keeps the display honest.
  const onWake = () => tick();
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('focus', onWake);

  // Keep sibling tabs in sync with whichever one the user acted in.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PERSIST_KEY) return;
    void useGluteStore.persist.rehydrate();
    prevPhase = useGluteStore.getState().phase;
  };
  window.addEventListener('storage', onStorage);

  tick();

  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onWake);
    window.removeEventListener('focus', onWake);
    window.removeEventListener('storage', onStorage);
  };
}
