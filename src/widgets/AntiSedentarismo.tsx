import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../styles/dotmatrix.module.css';
import WidgetPanel from '../components/WidgetPanel';
import { useWidgetStore } from '../lib/widgetStore';
import {
  requestNotificationPermission,
  sendNotification,
  playAlarmBeep,
} from '../lib/notifications';

export const title = 'Glute Activation';
export const defaultSize = { cols: 1, rows: 1 };

/* ============================================
   Types & Constants
   ============================================ */

type TimerPhase = 'REST' | 'ALARM' | 'ACTIVATION';

interface State {
  phase: TimerPhase;
  secondsLeft: number;
  restDuration: number;
  activationDuration: number;
  isPaused: boolean;
  animationsEnabled: boolean;
  /** Timestamp (ms) when secondsLeft was last anchored — used to calculate real elapsed time */
  tickAnchor: number;
}

type Action =
  | { type: 'SYNC'; now: number }
  | { type: 'TRIGGER_ALARM' }
  | { type: 'START_ACTIVATION' }
  | { type: 'CONFIRM_RESET' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'RESTART' }
  | { type: 'UPDATE_REST_DURATION'; payload: number }
  | { type: 'UPDATE_ACTIVATION_DURATION'; payload: number }
  | { type: 'TOGGLE_ANIMATIONS' }
  | { type: 'LOAD_STATE'; payload: Partial<State> };

const DEFAULT_REST = 120 * 60;
const DEFAULT_ACTIVATION = 60;
const STORAGE_KEY = 'widgethub-sedentarismo-state';
const SAVE_INTERVAL = 30_000;

/* ============================================
   Persistence helpers
   ============================================ */

interface PersistedState {
  phase: TimerPhase;
  secondsLeft: number;
  restDuration: number;
  activationDuration: number;
  isPaused: boolean;
  animationsEnabled: boolean;
  savedAt: number;
  tickAnchor: number;
}

function saveState(state: State) {
  const persisted: PersistedState = {
    phase: state.phase,
    secondsLeft: state.secondsLeft,
    restDuration: state.restDuration,
    activationDuration: state.activationDuration,
    isPaused: state.isPaused,
    animationsEnabled: state.animationsEnabled,
    savedAt: Date.now(),
    tickAnchor: state.tickAnchor,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function loadState(): State {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('no saved state');
    const saved: PersistedState = JSON.parse(raw);

    // Use tickAnchor if available, otherwise fall back to savedAt
    const anchor = saved.tickAnchor || saved.savedAt;

    if (saved.isPaused) {
      return {
        phase: saved.phase,
        secondsLeft: Math.max(0, saved.secondsLeft),
        restDuration: saved.restDuration,
        activationDuration: saved.activationDuration,
        isPaused: true,
        animationsEnabled: saved.animationsEnabled,
        tickAnchor: now,
      };
    }

    const elapsedSeconds = Math.floor((now - anchor) / 1000);
    let adjustedSeconds = saved.secondsLeft - elapsedSeconds;

    if (adjustedSeconds <= 0) {
      if (saved.phase === 'REST') {
        return {
          phase: 'ALARM', secondsLeft: 0,
          restDuration: saved.restDuration, activationDuration: saved.activationDuration,
          isPaused: false, animationsEnabled: saved.animationsEnabled,
          tickAnchor: now,
        };
      }
      if (saved.phase === 'ACTIVATION') {
        return {
          phase: 'REST', secondsLeft: saved.restDuration,
          restDuration: saved.restDuration, activationDuration: saved.activationDuration,
          isPaused: false, animationsEnabled: saved.animationsEnabled,
          tickAnchor: now,
        };
      }
      adjustedSeconds = 0;
    }

    return {
      phase: saved.phase, secondsLeft: adjustedSeconds,
      restDuration: saved.restDuration, activationDuration: saved.activationDuration,
      isPaused: false, animationsEnabled: saved.animationsEnabled,
      tickAnchor: now,
    };
  } catch {
    return {
      phase: 'REST', secondsLeft: DEFAULT_REST,
      restDuration: DEFAULT_REST, activationDuration: DEFAULT_ACTIVATION,
      isPaused: false, animationsEnabled: true,
      tickAnchor: now,
    };
  }
}

/* ============================================
   Reducer
   ============================================ */

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SYNC': {
      if (state.isPaused) return state;
      // Calculate real elapsed time since the anchor
      const elapsed = Math.floor((action.now - state.tickAnchor) / 1000);
      const remaining = state.secondsLeft - elapsed;

      if (remaining <= 0) {
        if (state.phase === 'REST') {
          return { ...state, phase: 'ALARM', secondsLeft: 0, tickAnchor: action.now };
        }
        if (state.phase === 'ACTIVATION') {
          return { ...state, phase: 'REST', secondsLeft: state.restDuration, tickAnchor: action.now };
        }
      }
      return { ...state, secondsLeft: remaining, tickAnchor: action.now };
    }
    case 'TRIGGER_ALARM':
      return { ...state, phase: 'ALARM', secondsLeft: 0, tickAnchor: Date.now() };
    case 'START_ACTIVATION':
      return { ...state, phase: 'ACTIVATION', secondsLeft: state.activationDuration, isPaused: false, tickAnchor: Date.now() };
    case 'CONFIRM_RESET':
      return { ...state, phase: 'REST', secondsLeft: state.restDuration, isPaused: false, tickAnchor: Date.now() };
    case 'TOGGLE_PAUSE': {
      const nowPausing = !state.isPaused;
      // When unpausing, reset anchor to now so elapsed calculation restarts from 0
      return { ...state, isPaused: nowPausing, tickAnchor: nowPausing ? state.tickAnchor : Date.now() };
    }
    case 'RESTART': {
      const now = Date.now();
      if (state.phase === 'REST') return { ...state, secondsLeft: state.restDuration, isPaused: false, tickAnchor: now };
      if (state.phase === 'ACTIVATION') return { ...state, secondsLeft: state.activationDuration, isPaused: false, tickAnchor: now };
      return state;
    }
    case 'UPDATE_REST_DURATION': {
      const now = Date.now();
      return { ...state, restDuration: action.payload, secondsLeft: state.phase === 'REST' ? action.payload : state.secondsLeft, tickAnchor: now };
    }
    case 'UPDATE_ACTIVATION_DURATION': {
      const now = Date.now();
      return { ...state, activationDuration: action.payload, secondsLeft: state.phase === 'ACTIVATION' ? action.payload : state.secondsLeft, tickAnchor: now };
    }
    case 'TOGGLE_ANIMATIONS':
      return { ...state, animationsEnabled: !state.animationsEnabled };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

/* ============================================
   Component
   ============================================ */

export default function AntiSedentarismo() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const alarmFiredRef = useRef(false);
  const hideWidget = useWidgetStore((s) => s.hideWidget);

  useEffect(() => { requestNotificationPermission(); }, []);

  // Timer sync — uses real timestamps, immune to background tab throttling
  useEffect(() => {
    if (state.phase === 'ALARM' || state.isPaused) return;

    // SYNC every second for UI updates; the actual elapsed time is
    // computed from Date.now() vs tickAnchor, so even if the browser
    // throttles intervals, the next tick auto-corrects.
    const interval = setInterval(() => {
      dispatch({ type: 'SYNC', now: Date.now() });
    }, 1000);

    // Also sync immediately when the tab regains focus
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        dispatch({ type: 'SYNC', now: Date.now() });
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.phase, state.isPaused]);

  // Persist state
  useEffect(() => {
    saveState(state);
    const interval = setInterval(() => saveState(state), SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    const handler = () => saveState(state);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  // Alarm trigger — auto-transition to ACTIVATION after 3s
  useEffect(() => {
    if (state.phase !== 'ALARM') return;

    // Play sound & notification only once
    if (!alarmFiredRef.current) {
      alarmFiredRef.current = true;
      playAlarmBeep();
      sendNotification('⚡ GLUTE ACTIVATION', 'Time to move! Stand up and activate.');
    }

    const timer = setTimeout(() => {
      dispatch({ type: 'START_ACTIVATION' });
    }, 3000);

    return () => {
      clearTimeout(timer);
      // Reset ref on cleanup so it works after React Strict Mode re-mount
      alarmFiredRef.current = false;
    };
  }, [state.phase]);

  const handleReset = useCallback(() => { dispatch({ type: 'CONFIRM_RESET' }); }, []);

  return (
    <WidgetPanel
      title="Glute Activation"
      isAlarm={state.phase === 'ALARM'}
      onHide={() => hideWidget('AntiSedentarismo')}
      settingsContent={
        <TimerSettingsContent
          restDuration={state.restDuration}
          activationDuration={state.activationDuration}
          animationsEnabled={state.animationsEnabled}
          onRestChange={(v) => dispatch({ type: 'UPDATE_REST_DURATION', payload: v })}
          onActivationChange={(v) => dispatch({ type: 'UPDATE_ACTIVATION_DURATION', payload: v })}
          onToggleAnimations={() => dispatch({ type: 'TOGGLE_ANIMATIONS' })}
        />
      }
    >
      <div className="relative min-h-[300px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {state.phase === 'REST' && (
            <RestPhase key="rest" secondsLeft={state.secondsLeft} totalSeconds={state.restDuration}
              isPaused={state.isPaused} animationsEnabled={state.animationsEnabled}
              onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
              onRestart={() => dispatch({ type: 'RESTART' })} />
          )}
          {state.phase === 'ALARM' && (
            <AlarmPhase
              key="alarm"
              onStartActivation={() => dispatch({ type: 'START_ACTIVATION' })}
              onSkip={handleReset}
            />
          )}
          {state.phase === 'ACTIVATION' && (
            <ActivationPhase key="activation" secondsLeft={state.secondsLeft}
              totalSeconds={state.activationDuration} isPaused={state.isPaused}
              animationsEnabled={state.animationsEnabled} onReset={handleReset}
              onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
              onRestart={() => dispatch({ type: 'RESTART' })} />
          )}
        </AnimatePresence>
      </div>
    </WidgetPanel>
  );
}

/* ============================================
   Phase Components
   ============================================ */

function RestPhase({ secondsLeft, totalSeconds, isPaused, animationsEnabled, onTogglePause, onRestart }: {
  secondsLeft: number; totalSeconds: number; isPaused: boolean; animationsEnabled: boolean;
  onTogglePause: () => void; onRestart: () => void;
}) {
  const progress = secondsLeft / totalSeconds;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-4">
      <PixelPersonSitting animate={animationsEnabled && !isPaused} />
      <div className="text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-text-muted mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}>
          {isPaused ? 'Paused' : 'Next activation in'}
        </p>
        <p className={styles.dotmatrixMedium}>{formatTime(secondsLeft)}</p>
      </div>
      <div className="h-[2px] w-full max-w-[200px] overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--color-progress-bg)' }}>
        <motion.div className="h-full" style={{ backgroundColor: 'var(--color-progress-fill)' }}
          animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5 }} />
      </div>
      <div className="flex items-center gap-3 mt-1">
        <ControlButton onClick={onTogglePause} icon={isPaused ? 'play' : 'pause'} label={isPaused ? 'Resume' : 'Pause'} />
        <ControlButton onClick={onRestart} icon="restart" label="Restart" />
      </div>
    </motion.div>
  );
}

function AlarmPhase({ onStartActivation, onSkip }: { onStartActivation: () => void; onSkip: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-5">
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 0.6, repeat: Infinity }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="#FF0000" strokeWidth="2" />
          <path d="M24 14v14M24 34v2" stroke="#FF0000" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </motion.div>
      <p className={styles.dotmatrixGlowRed} style={{ fontSize: '1.5rem' }}>⚡ ALERT</p>
      <p className="text-xs tracking-wider text-accent-alarm/70" style={{ fontFamily: 'var(--font-mono)' }}>
        PREPARING ACTIVATION...
      </p>

      {/* Manual buttons */}
      <div className="flex items-center gap-3 mt-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartActivation}
          className="rounded-[12px] border border-accent-alarm/40 bg-accent-alarm/15
            px-5 py-2.5 text-[11px] font-semibold tracking-[0.15em] uppercase text-accent-alarm
            transition-colors hover:bg-accent-alarm/25"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Start Activation
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSkip}
          className="rounded-[12px] border border-border
            px-5 py-2.5 text-[11px] tracking-[0.15em] uppercase text-text-muted
            transition-colors hover:border-border-hover hover:text-text-secondary"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Skip
        </motion.button>
      </div>
    </motion.div>
  );
}

function ActivationPhase({ secondsLeft, totalSeconds, isPaused, animationsEnabled, onReset, onTogglePause, onRestart }: {
  secondsLeft: number; totalSeconds: number; isPaused: boolean; animationsEnabled: boolean;
  onReset: () => void; onTogglePause: () => void; onRestart: () => void;
}) {
  const progress = secondsLeft / totalSeconds;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <svg width="130" height="130" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,0,0,0.1)" strokeWidth="4" />
          <motion.circle cx="70" cy="70" r={radius} fill="none" stroke="#FF0000" strokeWidth="4"
            strokeLinecap="round" strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }} transition={{ duration: 0.5, ease: 'linear' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={styles.dotmatrixGlowRed} style={{ fontSize: '1.8rem' }}>{secondsLeft}</span>
        </div>
      </div>
      <p className="text-center text-xs font-semibold tracking-[0.2em] uppercase text-accent-alarm"
        style={{ fontFamily: 'var(--font-mono)' }}>
        {isPaused ? 'Paused' : 'Time to move. Glute activation.'}
      </p>
      <PixelPersonSquatting animate={animationsEnabled && !isPaused} />
      <div className="flex items-center gap-3">
        <ControlButton onClick={onTogglePause} icon={isPaused ? 'play' : 'pause'} label={isPaused ? 'Resume' : 'Pause'} />
        <ControlButton onClick={onRestart} icon="restart" label="Restart" />
      </div>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onReset}
        className="rounded-[12px] border border-accent-alarm/30 bg-accent-alarm/10
          px-5 py-2 text-[11px] font-semibold tracking-[0.15em] uppercase text-accent-alarm
          transition-colors hover:border-accent-alarm/50 hover:bg-accent-alarm/20"
        style={{ fontFamily: 'var(--font-mono)' }}>
        Confirm Reset
      </motion.button>
    </motion.div>
  );
}

/* ============================================
   Control Button
   ============================================ */

function ControlButton({ onClick, icon, label }: { onClick: () => void; icon: 'play' | 'pause' | 'restart'; label: string }) {
  return (
    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border
        bg-surface-elevated transition-colors hover:border-border-hover"
      title={label} aria-label={label}>
      {icon === 'play' && (
        <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" className="ml-0.5">
          <path d="M0 0l12 7-12 7V0z" />
        </svg>
      )}
      {icon === 'pause' && (
        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
          <rect width="3" height="12" rx="1" />
          <rect x="7" width="3" height="12" rx="1" />
        </svg>
      )}
      {icon === 'restart' && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 7a6 6 0 1 1 1.5 3.9" />
          <path d="M1 11V7h4" />
        </svg>
      )}
    </motion.button>
  );
}

/* ============================================
   Settings Content (for popup)
   ============================================ */

function TimerSettingsContent({ restDuration, activationDuration, animationsEnabled, onRestChange, onActivationChange, onToggleAnimations }: {
  restDuration: number; activationDuration: number; animationsEnabled: boolean;
  onRestChange: (v: number) => void; onActivationChange: (v: number) => void; onToggleAnimations: () => void;
}) {
  const restMinutes = Math.floor(restDuration / 60);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <label className="text-[10px] tracking-[0.15em] uppercase text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
          Animations
        </label>
        <button onClick={onToggleAnimations}
          className={`relative h-6 w-11 rounded-full transition-colors duration-200
            ${animationsEnabled ? 'bg-text-primary' : ''}`}
          style={{ backgroundColor: animationsEnabled ? undefined : 'var(--color-slider-track)' }}>
          <motion.div className="absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm"
            animate={{ left: animationsEnabled ? '22px' : '2px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
        </button>
      </div>
      <div>
        <label className="mb-3 block text-[10px] tracking-[0.15em] uppercase text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
          Rest Duration: {restMinutes} min
        </label>
        <input type="range" min={1} max={180} value={restMinutes}
          onChange={(e) => onRestChange(Number(e.target.value) * 60)}
          className="w-full h-1 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:cursor-pointer"
          style={{ backgroundColor: 'var(--color-slider-track)' }} />
        <div className="mt-2 flex justify-between text-[9px] text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
          <span>1 min</span><span>180 min</span>
        </div>
      </div>
      <div>
        <label className="mb-3 block text-[10px] tracking-[0.15em] uppercase text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
          Activation Duration: {activationDuration} sec
        </label>
        <input type="range" min={10} max={300} value={activationDuration}
          onChange={(e) => onActivationChange(Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:cursor-pointer"
          style={{ backgroundColor: 'var(--color-slider-track)' }} />
        <div className="mt-2 flex justify-between text-[9px] text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
          <span>10 sec</span><span>300 sec</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   PIXEL ART — Seated at Computer (animated)
   Each "pixel" is a 3x3 rect in a grid.
   Animates: typing hands + subtle screen flicker
   ============================================ */

const PX = 3; // pixel size

function Pixel({ x, y, color }: { x: number; y: number; color: string }) {
  return <rect x={x * PX} y={y * PX} width={PX} height={PX} fill={color} />;
}

function PixelPersonSitting({ animate }: { animate: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => setFrame((f) => (f + 1) % 4), 400);
    return () => clearInterval(interval);
  }, [animate]);

  const fg = 'var(--color-pixel-figure)';
  const desk = 'var(--color-text-muted)';
  const screen = frame % 2 === 0 ? 'rgba(100,200,255,0.3)' : 'rgba(100,200,255,0.5)';

  // Frame-based hand positions for typing animation
  const leftHandY = frame % 2 === 0 ? 11 : 12;
  const rightHandY = frame % 2 === 0 ? 12 : 11;

  return (
    <svg width={30 * PX} height={22 * PX} viewBox={`0 0 ${30 * PX} ${22 * PX}`}>
      {/* Monitor body */}
      <Pixel x={10} y={2} color={desk} />
      <Pixel x={11} y={2} color={desk} />
      <Pixel x={12} y={2} color={desk} />
      <Pixel x={13} y={2} color={desk} />
      <Pixel x={14} y={2} color={desk} />
      <Pixel x={15} y={2} color={desk} />
      <Pixel x={16} y={2} color={desk} />
      <Pixel x={10} y={3} color={desk} />
      <Pixel x={16} y={3} color={desk} />
      <Pixel x={10} y={4} color={desk} />
      <Pixel x={16} y={4} color={desk} />
      <Pixel x={10} y={5} color={desk} />
      <Pixel x={16} y={5} color={desk} />
      <Pixel x={10} y={6} color={desk} />
      <Pixel x={16} y={6} color={desk} />
      <Pixel x={10} y={7} color={desk} />
      <Pixel x={11} y={7} color={desk} />
      <Pixel x={12} y={7} color={desk} />
      <Pixel x={13} y={7} color={desk} />
      <Pixel x={14} y={7} color={desk} />
      <Pixel x={15} y={7} color={desk} />
      <Pixel x={16} y={7} color={desk} />
      {/* Screen glow */}
      <Pixel x={11} y={3} color={screen} />
      <Pixel x={12} y={3} color={screen} />
      <Pixel x={13} y={3} color={screen} />
      <Pixel x={14} y={3} color={screen} />
      <Pixel x={15} y={3} color={screen} />
      <Pixel x={11} y={4} color={screen} />
      <Pixel x={12} y={4} color={screen} />
      <Pixel x={13} y={4} color={screen} />
      <Pixel x={14} y={4} color={screen} />
      <Pixel x={15} y={4} color={screen} />
      <Pixel x={11} y={5} color={screen} />
      <Pixel x={12} y={5} color={screen} />
      <Pixel x={13} y={5} color={screen} />
      <Pixel x={14} y={5} color={screen} />
      <Pixel x={15} y={5} color={screen} />
      <Pixel x={11} y={6} color={screen} />
      <Pixel x={12} y={6} color={screen} />
      <Pixel x={13} y={6} color={screen} />
      <Pixel x={14} y={6} color={screen} />
      <Pixel x={15} y={6} color={screen} />
      {/* Monitor stand */}
      <Pixel x={13} y={8} color={desk} />
      <Pixel x={12} y={9} color={desk} />
      <Pixel x={13} y={9} color={desk} />
      <Pixel x={14} y={9} color={desk} />
      {/* Desk surface */}
      {Array.from({ length: 20 }, (_, i) => (
        <Pixel key={`desk-${i}`} x={i + 5} y={10} color={desk} />
      ))}
      {/* Desk legs */}
      <Pixel x={6} y={11} color={desk} />
      <Pixel x={6} y={12} color={desk} />
      <Pixel x={6} y={13} color={desk} />
      <Pixel x={23} y={11} color={desk} />
      <Pixel x={23} y={12} color={desk} />
      <Pixel x={23} y={13} color={desk} />

      {/* Person — Head (2x2) */}
      <Pixel x={20} y={4} color={fg} />
      <Pixel x={21} y={4} color={fg} />
      <Pixel x={20} y={5} color={fg} />
      <Pixel x={21} y={5} color={fg} />
      {/* Neck */}
      <Pixel x={20} y={6} color={fg} />
      {/* Body */}
      <Pixel x={19} y={7} color={fg} />
      <Pixel x={20} y={7} color={fg} />
      <Pixel x={21} y={7} color={fg} />
      <Pixel x={19} y={8} color={fg} />
      <Pixel x={20} y={8} color={fg} />
      <Pixel x={21} y={8} color={fg} />
      <Pixel x={20} y={9} color={fg} />
      {/* Arms reaching to keyboard — animated typing */}
      <Pixel x={18} y={8} color={fg} />
      <Pixel x={17} y={9} color={fg} />
      <Pixel x={16} y={leftHandY - 2} color={fg} />
      <Pixel x={22} y={8} color={fg} />
      <Pixel x={23} y={9} color={fg} />
      <Pixel x={24} y={rightHandY - 2} color={fg} />
      {/* Legs (seated) */}
      <Pixel x={19} y={10} color={fg} />
      <Pixel x={21} y={10} color={fg} />
      <Pixel x={18} y={11} color={fg} />
      <Pixel x={22} y={11} color={fg} />
      <Pixel x={18} y={12} color={fg} />
      <Pixel x={22} y={12} color={fg} />
      {/* Feet */}
      <Pixel x={17} y={13} color={fg} />
      <Pixel x={18} y={13} color={fg} />
      <Pixel x={22} y={13} color={fg} />
      <Pixel x={23} y={13} color={fg} />

      {/* Chair (subtle) */}
      <Pixel x={18} y={9} color={desk} />
      <Pixel x={19} y={9} color={desk} />
      <Pixel x={21} y={9} color={desk} />
      <Pixel x={22} y={9} color={desk} />
    </svg>
  );
}

/* ============================================
   PIXEL ART — Squatting Person (animated)
   Two-frame squat loop: standing ↔ squat
   ============================================ */

function PixelPersonSquatting({ animate }: { animate: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => setFrame((f) => (f + 1) % 4), 500);
    return () => clearInterval(interval);
  }, [animate]);

  const color = '#FF0000';

  // 4-frame animation: standing → going down → squat → going up
  const isDown = frame === 1 || frame === 2;
  const isMid = frame === 1 || frame === 3;

  const headY = isDown ? 6 : isMid ? 4 : 2;
  const bodyTop = headY + 2;
  const armY = bodyTop + 1;
  const legStartY = bodyTop + 3;

  return (
    <svg width={20 * PX} height={20 * PX} viewBox={`0 0 ${20 * PX} ${20 * PX}`}>
      {/* Head */}
      <Pixel x={9} y={headY} color={color} />
      <Pixel x={10} y={headY} color={color} />
      <Pixel x={9} y={headY + 1} color={color} />
      <Pixel x={10} y={headY + 1} color={color} />
      {/* Body */}
      <Pixel x={9} y={bodyTop} color={color} />
      <Pixel x={10} y={bodyTop} color={color} />
      <Pixel x={9} y={bodyTop + 1} color={color} />
      <Pixel x={10} y={bodyTop + 1} color={color} />
      <Pixel x={9} y={bodyTop + 2} color={color} />
      <Pixel x={10} y={bodyTop + 2} color={color} />
      {/* Arms — extend forward for balance when squatting */}
      {isDown ? (
        <>
          <Pixel x={7} y={armY} color={color} />
          <Pixel x={6} y={armY} color={color} />
          <Pixel x={5} y={armY} color={color} />
          <Pixel x={12} y={armY} color={color} />
          <Pixel x={13} y={armY} color={color} />
          <Pixel x={14} y={armY} color={color} />
        </>
      ) : (
        <>
          <Pixel x={8} y={armY} color={color} />
          <Pixel x={7} y={armY + 1} color={color} />
          <Pixel x={11} y={armY} color={color} />
          <Pixel x={12} y={armY + 1} color={color} />
        </>
      )}
      {/* Legs */}
      {isDown ? (
        <>
          {/* Bent legs — squat position */}
          <Pixel x={8} y={legStartY} color={color} />
          <Pixel x={7} y={legStartY + 1} color={color} />
          <Pixel x={6} y={legStartY + 2} color={color} />
          <Pixel x={7} y={legStartY + 2} color={color} />
          <Pixel x={11} y={legStartY} color={color} />
          <Pixel x={12} y={legStartY + 1} color={color} />
          <Pixel x={12} y={legStartY + 2} color={color} />
          <Pixel x={13} y={legStartY + 2} color={color} />
        </>
      ) : (
        <>
          {/* Straight legs — standing */}
          <Pixel x={8} y={legStartY} color={color} />
          <Pixel x={8} y={legStartY + 1} color={color} />
          <Pixel x={8} y={legStartY + 2} color={color} />
          <Pixel x={7} y={legStartY + 3} color={color} />
          <Pixel x={8} y={legStartY + 3} color={color} />
          <Pixel x={11} y={legStartY} color={color} />
          <Pixel x={11} y={legStartY + 1} color={color} />
          <Pixel x={11} y={legStartY + 2} color={color} />
          <Pixel x={11} y={legStartY + 3} color={color} />
          <Pixel x={12} y={legStartY + 3} color={color} />
        </>
      )}
      {/* Ground line */}
      {Array.from({ length: 14 }, (_, i) => (
        <Pixel key={`ground-${i}`} x={i + 3} y={17} color="rgba(255,0,0,0.15)" />
      ))}
    </svg>
  );
}

/* ============================================
   Helpers
   ============================================ */

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
