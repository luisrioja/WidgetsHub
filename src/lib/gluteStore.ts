import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { syncStorage } from './syncStorage';

/**
 * Glute activation timer state.
 *
 * Everything is anchored to an absolute `deadline` timestamp rather than a
 * decrementing counter. A countdown that subtracts "one second" on every tick
 * loses whatever fraction of a second the timer actually slept for, so it runs
 * progressively slow — the previous implementation lost time on every tab
 * switch. Deriving the remaining time from `deadline - now` cannot drift no
 * matter how irregularly the loop runs.
 *
 * The store is pure: it owns state transitions only. Sound, notifications and
 * the interval that drives `tick` live in `gluteEngine.ts`.
 */

export type GlutePhase =
  /** Sitting. Counting down to the next activation. */
  | 'REST'
  /** Rest elapsed. Waits for the user indefinitely — never auto-advances. */
  | 'DUE'
  /** Activation in progress. */
  | 'ACTIVE';

export type SessionOutcome = 'completed' | 'cut-short' | 'skipped';

export interface Session {
  at: number;
  outcome: SessionOutcome;
  /** Seconds actually spent activating. 0 for a skip. */
  seconds: number;
}

export const LIMITS = {
  rest: { min: 5, max: 180 },
  activation: { min: 15, max: 300 },
  snooze: { min: 1, max: 30 },
} as const;

const HISTORY_CAP = 200;

export interface GluteState {
  phase: GlutePhase;
  /** Epoch ms the current countdown ends. Meaningful in REST and ACTIVE. */
  deadline: number;
  /** Ms left at the moment of pausing; null while running. */
  pausedRemaining: number | null;
  /** Epoch ms the DUE state began. */
  dueSince: number | null;
  /** Epoch ms of the last audible reminder. */
  lastNagAt: number | null;
  /** Epoch ms the current ACTIVE run started, for partial-credit accounting. */
  activeSince: number | null;

  /** Minutes. */
  restMinutes: number;
  /** Seconds. */
  activationSeconds: number;
  /** Minutes. */
  snoozeMinutes: number;
  /** Seconds between audible reminders while DUE. */
  nagSeconds: number;

  soundEnabled: boolean;
  notificationsEnabled: boolean;
  animationsEnabled: boolean;

  history: Session[];

  /**
   * Deadline value of the last resolved countdown. Guards against two tabs
   * logging the same completion before persistence syncs between them.
   */
  lastResolvedDeadline: number;

  tick: (now: number) => void;
  beginActivation: (now?: number) => void;
  completeActivation: (now?: number) => void;
  endActivationEarly: (now?: number) => void;
  snooze: (now?: number) => void;
  skip: (now?: number) => void;
  togglePause: (now?: number) => void;
  restart: (now?: number) => void;
  markNagged: (now: number) => void;

  setRestMinutes: (minutes: number, now?: number) => void;
  setActivationSeconds: (seconds: number, now?: number) => void;
  setSnoozeMinutes: (minutes: number) => void;
  setNagSeconds: (seconds: number) => void;
  toggleSound: () => void;
  toggleNotifications: () => void;
  toggleAnimations: () => void;
  clearHistory: () => void;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v)));

const DEFAULTS = {
  restMinutes: 45,
  activationSeconds: 60,
  snoozeMinutes: 5,
  nagSeconds: 45,
};

function pushSession(history: Session[], session: Session): Session[] {
  return [session, ...history].slice(0, HISTORY_CAP);
}

export const useGluteStore = create<GluteState>()(
  persist(
    (set, get) => ({
      phase: 'REST',
      deadline: Date.now() + DEFAULTS.restMinutes * 60_000,
      pausedRemaining: null,
      dueSince: null,
      lastNagAt: null,
      activeSince: null,

      restMinutes: DEFAULTS.restMinutes,
      activationSeconds: DEFAULTS.activationSeconds,
      snoozeMinutes: DEFAULTS.snoozeMinutes,
      nagSeconds: DEFAULTS.nagSeconds,

      soundEnabled: true,
      notificationsEnabled: true,
      animationsEnabled: true,

      history: [],
      lastResolvedDeadline: 0,

      /* --- Engine-driven transitions --- */

      tick: (now) => {
        const s = get();
        if (s.pausedRemaining !== null) return;

        if (s.phase === 'REST' && now >= s.deadline) {
          if (s.lastResolvedDeadline === s.deadline) return;
          set({
            phase: 'DUE',
            dueSince: now,
            lastNagAt: null,
            lastResolvedDeadline: s.deadline,
          });
          return;
        }

        if (s.phase === 'ACTIVE' && now >= s.deadline) {
          get().completeActivation(now);
        }
      },

      markNagged: (now) => set({ lastNagAt: now }),

      /* --- User transitions --- */

      beginActivation: (now = Date.now()) =>
        set((s) => ({
          phase: 'ACTIVE',
          deadline: now + s.activationSeconds * 1000,
          pausedRemaining: null,
          dueSince: null,
          lastNagAt: null,
          activeSince: now,
        })),

      completeActivation: (now = Date.now()) =>
        set((s) => {
          if (s.phase !== 'ACTIVE') return s;
          if (s.lastResolvedDeadline === s.deadline) return s;
          return {
            phase: 'REST',
            deadline: now + s.restMinutes * 60_000,
            pausedRemaining: null,
            dueSince: null,
            lastNagAt: null,
            activeSince: null,
            lastResolvedDeadline: s.deadline,
            history: pushSession(s.history, {
              at: now,
              outcome: 'completed',
              seconds: s.activationSeconds,
            }),
          };
        }),

      endActivationEarly: (now = Date.now()) =>
        set((s) => {
          if (s.phase !== 'ACTIVE') return s;
          const elapsed = s.activeSince
            ? Math.round((now - s.activeSince) / 1000)
            : 0;
          const done = elapsed >= s.activationSeconds;
          return {
            phase: 'REST',
            deadline: now + s.restMinutes * 60_000,
            pausedRemaining: null,
            dueSince: null,
            lastNagAt: null,
            activeSince: null,
            lastResolvedDeadline: s.deadline,
            history: pushSession(s.history, {
              at: now,
              outcome: done ? 'completed' : 'cut-short',
              seconds: Math.max(0, Math.min(elapsed, s.activationSeconds)),
            }),
          };
        }),

      snooze: (now = Date.now()) =>
        set((s) => ({
          phase: 'REST',
          deadline: now + s.snoozeMinutes * 60_000,
          pausedRemaining: null,
          dueSince: null,
          lastNagAt: null,
          lastResolvedDeadline: 0,
        })),

      skip: (now = Date.now()) =>
        set((s) => ({
          phase: 'REST',
          deadline: now + s.restMinutes * 60_000,
          pausedRemaining: null,
          dueSince: null,
          lastNagAt: null,
          activeSince: null,
          lastResolvedDeadline: 0,
          history: pushSession(s.history, {
            at: now,
            outcome: 'skipped',
            seconds: 0,
          }),
        })),

      togglePause: (now = Date.now()) =>
        set((s) => {
          // DUE has no countdown to pause; it already waits indefinitely.
          if (s.phase === 'DUE') return s;
          if (s.pausedRemaining === null) {
            return { pausedRemaining: Math.max(0, s.deadline - now) };
          }
          return { deadline: now + s.pausedRemaining, pausedRemaining: null };
        }),

      restart: (now = Date.now()) =>
        set((s) => {
          const ms =
            s.phase === 'ACTIVE'
              ? s.activationSeconds * 1000
              : s.restMinutes * 60_000;
          return {
            phase: s.phase === 'DUE' ? 'REST' : s.phase,
            deadline: now + ms,
            pausedRemaining: s.pausedRemaining === null ? null : ms,
            dueSince: null,
            lastNagAt: null,
            activeSince: s.phase === 'ACTIVE' ? now : null,
            lastResolvedDeadline: 0,
          };
        }),

      /* --- Settings --- */

      setRestMinutes: (minutes, now = Date.now()) =>
        set((s) => {
          const restMinutes = clamp(minutes, LIMITS.rest.min, LIMITS.rest.max);
          if (s.phase !== 'REST') return { restMinutes };
          const ms = restMinutes * 60_000;
          return {
            restMinutes,
            deadline: now + ms,
            pausedRemaining: s.pausedRemaining === null ? null : ms,
            lastResolvedDeadline: 0,
          };
        }),

      setActivationSeconds: (seconds, now = Date.now()) =>
        set((s) => {
          const activationSeconds = clamp(
            seconds,
            LIMITS.activation.min,
            LIMITS.activation.max,
          );
          if (s.phase !== 'ACTIVE') return { activationSeconds };
          const ms = activationSeconds * 1000;
          return {
            activationSeconds,
            deadline: now + ms,
            pausedRemaining: s.pausedRemaining === null ? null : ms,
            activeSince: now,
            lastResolvedDeadline: 0,
          };
        }),

      setSnoozeMinutes: (minutes) =>
        set({
          snoozeMinutes: clamp(minutes, LIMITS.snooze.min, LIMITS.snooze.max),
        }),

      setNagSeconds: (seconds) => set({ nagSeconds: clamp(seconds, 15, 600) }),

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleNotifications: () =>
        set((s) => ({ notificationsEnabled: !s.notificationsEnabled })),
      toggleAnimations: () =>
        set((s) => ({ animationsEnabled: !s.animationsEnabled })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'widgethub-glute',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
      partialize: (s) => ({
        phase: s.phase,
        deadline: s.deadline,
        pausedRemaining: s.pausedRemaining,
        dueSince: s.dueSince,
        lastNagAt: s.lastNagAt,
        activeSince: s.activeSince,
        restMinutes: s.restMinutes,
        activationSeconds: s.activationSeconds,
        snoozeMinutes: s.snoozeMinutes,
        nagSeconds: s.nagSeconds,
        soundEnabled: s.soundEnabled,
        notificationsEnabled: s.notificationsEnabled,
        animationsEnabled: s.animationsEnabled,
        history: s.history,
        lastResolvedDeadline: s.lastResolvedDeadline,
      }),
    },
  ),
);

/* ============================================================
   Selectors — derived values, never stored
   ============================================================ */

/** Ms left on the current countdown. DUE has no countdown, so it reports 0. */
export function remainingMs(s: GluteState, now: number): number {
  if (s.phase === 'DUE') return 0;
  if (s.pausedRemaining !== null) return Math.max(0, s.pausedRemaining);
  return Math.max(0, s.deadline - now);
}

/** Whole seconds left, rounded up so the display shows "1" for the last second. */
export function remainingSeconds(s: GluteState, now: number): number {
  return Math.ceil(remainingMs(s, now) / 1000);
}

/** Total duration of the current countdown, in ms. */
export function totalMs(s: GluteState): number {
  return s.phase === 'ACTIVE'
    ? s.activationSeconds * 1000
    : s.restMinutes * 60_000;
}

/** 0–1 elapsed fraction of the current countdown. */
export function elapsedFraction(s: GluteState, now: number): number {
  if (s.phase === 'DUE') return 1;
  const total = totalMs(s);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs(s, now) / total));
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface GluteStats {
  today: number;
  skippedToday: number;
  /** Consecutive days ending today (or yesterday) with at least one rep. */
  streak: number;
  /** Completed reps per day for the last 7 days, oldest first. */
  week: number[];
}

export function computeStats(history: Session[], now = Date.now()): GluteStats {
  const today = startOfDay(now);
  const DAY = 86_400_000;

  const completedDays = new Set<number>();
  let todayCount = 0;
  let skippedToday = 0;
  const week = new Array(7).fill(0) as number[];

  for (const s of history) {
    const day = startOfDay(s.at);
    if (s.outcome === 'completed') {
      completedDays.add(day);
      if (day === today) todayCount++;
      const index = 6 - Math.round((today - day) / DAY);
      if (index >= 0 && index < 7) week[index]++;
    } else if (s.outcome === 'skipped' && day === today) {
      skippedToday++;
    }
  }

  // A streak stays alive through today even before the first rep of the day.
  let streak = 0;
  let cursor = completedDays.has(today) ? today : today - DAY;
  while (completedDays.has(cursor)) {
    streak++;
    cursor -= DAY;
  }

  return { today: todayCount, skippedToday, streak, week };
}
