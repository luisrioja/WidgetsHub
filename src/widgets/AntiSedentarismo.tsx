import { useReducer, useEffect, useRef, useCallback } from 'react';
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
}

type Action =
  | { type: 'TICK' }
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
const SAVE_INTERVAL = 30_000; // Save every 30 seconds

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
  savedAt: number; // timestamp
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
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('no saved state');
    const saved: PersistedState = JSON.parse(raw);

    // Calculate elapsed time since save to subtract from timer
    const elapsedSeconds = Math.floor((Date.now() - saved.savedAt) / 1000);

    // If it was paused, don't subtract elapsed time
    if (saved.isPaused) {
      return {
        phase: saved.phase,
        secondsLeft: Math.max(0, saved.secondsLeft),
        restDuration: saved.restDuration,
        activationDuration: saved.activationDuration,
        isPaused: true,
        animationsEnabled: saved.animationsEnabled,
      };
    }

    // Subtract elapsed time
    let adjustedSeconds = saved.secondsLeft - elapsedSeconds;

    // Handle timer expiry during page absence
    if (adjustedSeconds <= 0) {
      if (saved.phase === 'REST') {
        // REST expired → go to ALARM
        return {
          phase: 'ALARM',
          secondsLeft: 0,
          restDuration: saved.restDuration,
          activationDuration: saved.activationDuration,
          isPaused: false,
          animationsEnabled: saved.animationsEnabled,
        };
      }
      if (saved.phase === 'ACTIVATION') {
        // ACTIVATION expired → restart REST
        return {
          phase: 'REST',
          secondsLeft: saved.restDuration,
          restDuration: saved.restDuration,
          activationDuration: saved.activationDuration,
          isPaused: false,
          animationsEnabled: saved.animationsEnabled,
        };
      }
      adjustedSeconds = 0;
    }

    return {
      phase: saved.phase,
      secondsLeft: adjustedSeconds,
      restDuration: saved.restDuration,
      activationDuration: saved.activationDuration,
      isPaused: false,
      animationsEnabled: saved.animationsEnabled,
    };
  } catch {
    return {
      phase: 'REST',
      secondsLeft: DEFAULT_REST,
      restDuration: DEFAULT_REST,
      activationDuration: DEFAULT_ACTIVATION,
      isPaused: false,
      animationsEnabled: true,
    };
  }
}

/* ============================================
   Reducer
   ============================================ */

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'TICK': {
      if (state.isPaused) return state;
      if (state.secondsLeft <= 1) {
        if (state.phase === 'REST') {
          return { ...state, phase: 'ALARM', secondsLeft: 0 };
        }
        if (state.phase === 'ACTIVATION') {
          return { ...state, phase: 'REST', secondsLeft: state.restDuration };
        }
      }
      return { ...state, secondsLeft: state.secondsLeft - 1 };
    }
    case 'TRIGGER_ALARM':
      return { ...state, phase: 'ALARM', secondsLeft: 0 };
    case 'START_ACTIVATION':
      return { ...state, phase: 'ACTIVATION', secondsLeft: state.activationDuration, isPaused: false };
    case 'CONFIRM_RESET':
      return { ...state, phase: 'REST', secondsLeft: state.restDuration, isPaused: false };
    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };
    case 'RESTART':
      if (state.phase === 'REST') {
        return { ...state, secondsLeft: state.restDuration, isPaused: false };
      }
      if (state.phase === 'ACTIVATION') {
        return { ...state, secondsLeft: state.activationDuration, isPaused: false };
      }
      return state;
    case 'UPDATE_REST_DURATION':
      return {
        ...state,
        restDuration: action.payload,
        secondsLeft: state.phase === 'REST' ? action.payload : state.secondsLeft,
      };
    case 'UPDATE_ACTIVATION_DURATION':
      return {
        ...state,
        activationDuration: action.payload,
        secondsLeft: state.phase === 'ACTIVATION' ? action.payload : state.secondsLeft,
      };
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

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Timer tick
  useEffect(() => {
    if (state.phase === 'ALARM' || state.isPaused) return;
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(interval);
  }, [state.phase, state.isPaused]);

  // Persist state periodically
  useEffect(() => {
    // Save immediately on significant state changes
    saveState(state);

    // Also set up periodic saving
    const interval = setInterval(() => saveState(state), SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [state]);

  // Save on page unload
  useEffect(() => {
    const handler = () => saveState(state);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  // Handle alarm trigger
  useEffect(() => {
    if (state.phase === 'ALARM' && !alarmFiredRef.current) {
      alarmFiredRef.current = true;
      playAlarmBeep();
      sendNotification(
        '⚡ GLUTE ACTIVATION',
        'Time to move! Stand up and activate for 60 seconds.'
      );
      const timer = setTimeout(() => {
        dispatch({ type: 'START_ACTIVATION' });
        alarmFiredRef.current = false;
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'CONFIRM_RESET' });
  }, []);

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
      <div className="relative min-h-[280px] flex flex-col items-center justify-center">
        {/* Main content by phase */}
        <AnimatePresence mode="wait">
          {state.phase === 'REST' && (
            <RestPhase
              key="rest"
              secondsLeft={state.secondsLeft}
              totalSeconds={state.restDuration}
              isPaused={state.isPaused}
              animationsEnabled={state.animationsEnabled}
              onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
              onRestart={() => dispatch({ type: 'RESTART' })}
            />
          )}
          {state.phase === 'ALARM' && <AlarmPhase key="alarm" />}
          {state.phase === 'ACTIVATION' && (
            <ActivationPhase
              key="activation"
              secondsLeft={state.secondsLeft}
              totalSeconds={state.activationDuration}
              isPaused={state.isPaused}
              animationsEnabled={state.animationsEnabled}
              onReset={handleReset}
              onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
              onRestart={() => dispatch({ type: 'RESTART' })}
            />
          )}
        </AnimatePresence>
      </div>
    </WidgetPanel>
  );
}

/* ============================================
   Phase Components
   ============================================ */

function RestPhase({
  secondsLeft,
  totalSeconds,
  isPaused,
  animationsEnabled,
  onTogglePause,
  onRestart,
}: {
  secondsLeft: number;
  totalSeconds: number;
  isPaused: boolean;
  animationsEnabled: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
}) {
  const progress = secondsLeft / totalSeconds;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-4"
    >
      {/* Seated at computer figure */}
      <SeatedAtComputerFigure animate={animationsEnabled} />

      {/* Timer */}
      <div className="text-center">
        <p
          className="text-xs tracking-[0.2em] uppercase text-text-muted mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {isPaused ? 'Paused' : 'Next activation in'}
        </p>
        <p className={styles.dotmatrixMedium}>{formatTime(secondsLeft)}</p>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full max-w-[200px] overflow-hidden rounded-full bg-black/5">
        <motion.div
          className="h-full bg-black/20"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-3 mt-1">
        <ControlButton
          onClick={onTogglePause}
          icon={isPaused ? 'play' : 'pause'}
          label={isPaused ? 'Resume' : 'Pause'}
        />
        <ControlButton onClick={onRestart} icon="restart" label="Restart" />
      </div>
    </motion.div>
  );
}

function AlarmPhase() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center gap-4"
    >
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [1, 0.6, 1],
        }}
        transition={{ duration: 0.6, repeat: Infinity }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="#FF0000" strokeWidth="2" />
          <path
            d="M24 14v14M24 34v2"
            stroke="#FF0000"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      <p className={styles.dotmatrixGlowRed} style={{ fontSize: '1.5rem' }}>
        ⚡ ALERT
      </p>
      <p
        className="text-xs tracking-wider text-accent-alarm/70"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        PREPARING ACTIVATION...
      </p>
    </motion.div>
  );
}

function ActivationPhase({
  secondsLeft,
  totalSeconds,
  isPaused,
  animationsEnabled,
  onReset,
  onTogglePause,
  onRestart,
}: {
  secondsLeft: number;
  totalSeconds: number;
  isPaused: boolean;
  animationsEnabled: boolean;
  onReset: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}) {
  const progress = secondsLeft / totalSeconds;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-3"
    >
      {/* Circular progress */}
      <div className="relative flex items-center justify-center">
        <svg width="130" height="130" viewBox="0 0 140 140" className="-rotate-90">
          <circle
            cx="70" cy="70" r={radius}
            fill="none" stroke="rgba(255,0,0,0.1)" strokeWidth="4"
          />
          <motion.circle
            cx="70" cy="70" r={radius}
            fill="none" stroke="#FF0000" strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={styles.dotmatrixGlowRed} style={{ fontSize: '1.8rem' }}>
            {secondsLeft}
          </span>
        </div>
      </div>

      {/* Message */}
      <p
        className="text-center text-xs font-semibold tracking-[0.2em] uppercase text-accent-alarm"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {isPaused ? 'Paused' : 'Time to move. Glute activation.'}
      </p>

      {/* Squatting figure */}
      <SquattingFigure animate={animationsEnabled} />

      {/* Control buttons */}
      <div className="flex items-center gap-3">
        <ControlButton
          onClick={onTogglePause}
          icon={isPaused ? 'play' : 'pause'}
          label={isPaused ? 'Resume' : 'Pause'}
        />
        <ControlButton onClick={onRestart} icon="restart" label="Restart" />
      </div>

      {/* Reset button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onReset}
        className="rounded-[12px] border border-accent-alarm/30 bg-accent-alarm/10
          px-5 py-2 text-[11px] font-semibold tracking-[0.15em] uppercase text-accent-alarm
          transition-colors hover:border-accent-alarm/50 hover:bg-accent-alarm/20"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Confirm Reset
      </motion.button>
    </motion.div>
  );
}

/* ============================================
   Control Button
   ============================================ */

function ControlButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: 'play' | 'pause' | 'restart';
  label: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border
        bg-surface-elevated transition-colors hover:border-border-hover"
      title={label}
      aria-label={label}
    >
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

function TimerSettingsContent({
  restDuration,
  activationDuration,
  animationsEnabled,
  onRestChange,
  onActivationChange,
  onToggleAnimations,
}: {
  restDuration: number;
  activationDuration: number;
  animationsEnabled: boolean;
  onRestChange: (v: number) => void;
  onActivationChange: (v: number) => void;
  onToggleAnimations: () => void;
}) {
  const restMinutes = Math.floor(restDuration / 60);

  return (
    <div className="space-y-5">
      {/* Animations toggle */}
      <div className="flex items-center justify-between">
        <label
          className="text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Animations
        </label>
        <button
          onClick={onToggleAnimations}
          className={`relative h-6 w-11 rounded-full transition-colors duration-200
            ${animationsEnabled ? 'bg-text-primary' : 'bg-black/10'}`}
        >
          <motion.div
            className="absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm"
            animate={{ left: animationsEnabled ? '22px' : '2px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Rest duration */}
      <div>
        <label
          className="mb-2 block text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Rest Duration: {restMinutes} min
        </label>
        <input
          type="range"
          min={1}
          max={180}
          value={restMinutes}
          onChange={(e) => onRestChange(Number(e.target.value) * 60)}
          className="w-full h-1 bg-black/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="mt-1 flex justify-between text-[9px] text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}>
          <span>1 min</span>
          <span>180 min</span>
        </div>
      </div>

      {/* Activation duration */}
      <div>
        <label
          className="mb-2 block text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Activation Duration: {activationDuration} sec
        </label>
        <input
          type="range"
          min={10}
          max={300}
          value={activationDuration}
          onChange={(e) => onActivationChange(Number(e.target.value))}
          className="w-full h-1 bg-black/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="mt-1 flex justify-between text-[9px] text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}>
          <span>10 sec</span>
          <span>300 sec</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   SVG Illustrations — Animated Loop
   ============================================ */

/** Person seated at a computer desk — gentle idle breathing animation */
function SeatedAtComputerFigure({ animate }: { animate: boolean }) {
  return (
    <motion.svg
      width="100"
      height="80"
      viewBox="0 0 100 80"
      fill="none"
      animate={animate ? { y: [0, -1.5, 0] } : {}}
      transition={animate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      {/* Desk */}
      <rect x="10" y="50" width="80" height="2" rx="1" fill="#888" opacity="0.3" />
      {/* Desk legs */}
      <line x1="15" y1="52" x2="15" y2="72" stroke="#888" strokeWidth="1.5" opacity="0.2" />
      <line x1="85" y1="52" x2="85" y2="72" stroke="#888" strokeWidth="1.5" opacity="0.2" />

      {/* Monitor */}
      <rect x="38" y="28" width="24" height="18" rx="2" stroke="#888" strokeWidth="1.5" fill="none" opacity="0.5" />
      {/* Monitor stand */}
      <line x1="50" y1="46" x2="50" y2="50" stroke="#888" strokeWidth="1.5" opacity="0.4" />
      <line x1="44" y1="50" x2="56" y2="50" stroke="#888" strokeWidth="1.5" opacity="0.3" />
      {/* Screen glow */}
      <rect x="40" y="30" width="20" height="14" rx="1" fill="#888" opacity="0.06" />

      {/* Person — Head */}
      <motion.circle
        cx="50" cy="18" r="6"
        stroke="currentColor" strokeWidth="1.5"
        animate={animate ? { cy: [18, 17, 18] } : {}}
        transition={animate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
      />
      {/* Body */}
      <motion.path
        d="M50 24v14"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        animate={animate ? { d: ['M50 24v14', 'M50 23v14', 'M50 24v14'] } : {}}
        transition={animate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
      />
      {/* Arms reaching to desk/keyboard */}
      <path d="M50 30l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M50 30l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Legs (seated on chair) */}
      <path d="M50 38l-8 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M50 38l8 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Feet */}
      <path d="M42 52h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M58 52h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Chair */}
      <path d="M38 40c0 0 4 4 12 4s12-4 12-4" stroke="#888" strokeWidth="1" opacity="0.3" />
    </motion.svg>
  );
}

/** Person doing squats — full squat loop animation */
function SquattingFigure({ animate }: { animate: boolean }) {
  return (
    <motion.svg
      width="60"
      height="70"
      viewBox="0 0 60 70"
      fill="none"
    >
      {/* Head */}
      <motion.circle
        cx="30" r="5"
        stroke="#FF0000" strokeWidth="1.5"
        animate={animate
          ? { cy: [10, 22, 10] }
          : { cy: 10 }
        }
        transition={animate
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : {}
        }
      />
      {/* Body */}
      <motion.path
        stroke="#FF0000" strokeWidth="1.5" strokeLinecap="round"
        animate={animate
          ? { d: ['M30 15v16', 'M30 27v8', 'M30 15v16'] }
          : { d: 'M30 15v16' }
        }
        transition={animate
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : {}
        }
      />
      {/* Arms — extend forward during squat for balance */}
      <motion.path
        stroke="#FF0000" strokeWidth="1.5" strokeLinecap="round"
        animate={animate
          ? {
              d: [
                'M30 20l-10 6 M30 20l10 6',
                'M30 32l-14 0 M30 32l14 0',
                'M30 20l-10 6 M30 20l10 6',
              ],
            }
          : { d: 'M30 20l-10 6 M30 20l10 6' }
        }
        transition={animate
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : {}
        }
      />
      {/* Left leg — bends during squat */}
      <motion.path
        stroke="#FF0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        animate={animate
          ? {
              d: [
                'M30 31l-8 16l-4 8',
                'M30 35l-12 8l-2 12',
                'M30 31l-8 16l-4 8',
              ],
            }
          : { d: 'M30 31l-8 16l-4 8' }
        }
        transition={animate
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : {}
        }
      />
      {/* Right leg — bends during squat */}
      <motion.path
        stroke="#FF0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        animate={animate
          ? {
              d: [
                'M30 31l8 16l4 8',
                'M30 35l12 8l2 12',
                'M30 31l8 16l4 8',
              ],
            }
          : { d: 'M30 31l8 16l4 8' }
        }
        transition={animate
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : {}
        }
      />
      {/* Ground line */}
      <line x1="10" y1="62" x2="50" y2="62" stroke="#FF0000" strokeWidth="0.5" opacity="0.2" />
    </motion.svg>
  );
}

/* ============================================
   Helpers
   ============================================ */

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
