import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../styles/dotmatrix.module.css';
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

type TimerState = 'REST' | 'ALARM' | 'ACTIVATION';

interface State {
  phase: TimerState;
  secondsLeft: number;
  restDuration: number;      // in seconds
  activationDuration: number; // in seconds
}

type Action =
  | { type: 'TICK' }
  | { type: 'TRIGGER_ALARM' }
  | { type: 'START_ACTIVATION' }
  | { type: 'CONFIRM_RESET' }
  | { type: 'UPDATE_REST_DURATION'; payload: number }
  | { type: 'UPDATE_ACTIVATION_DURATION'; payload: number };

const DEFAULT_REST = 120 * 60;       // 2 hours
const DEFAULT_ACTIVATION = 60;       // 60 seconds

/* ============================================
   Reducer
   ============================================ */

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'TICK': {
      if (state.secondsLeft <= 1) {
        if (state.phase === 'REST') {
          return { ...state, phase: 'ALARM', secondsLeft: 0 };
        }
        if (state.phase === 'ACTIVATION') {
          // Auto-reset after activation finishes
          return { ...state, phase: 'REST', secondsLeft: state.restDuration };
        }
      }
      return { ...state, secondsLeft: state.secondsLeft - 1 };
    }
    case 'TRIGGER_ALARM':
      return { ...state, phase: 'ALARM', secondsLeft: 0 };
    case 'START_ACTIVATION':
      return { ...state, phase: 'ACTIVATION', secondsLeft: state.activationDuration };
    case 'CONFIRM_RESET':
      return { ...state, phase: 'REST', secondsLeft: state.restDuration };
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
    default:
      return state;
  }
}

/* ============================================
   Component
   ============================================ */

export default function AntiSedentarismo() {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'REST',
    secondsLeft: DEFAULT_REST,
    restDuration: DEFAULT_REST,
    activationDuration: DEFAULT_ACTIVATION,
  });

  const [showSettings, setShowSettings] = useState(false);
  const alarmFiredRef = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Timer tick
  useEffect(() => {
    if (state.phase === 'ALARM') return; // Don't tick in alarm state
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(interval);
  }, [state.phase]);

  // Handle alarm trigger
  useEffect(() => {
    if (state.phase === 'ALARM' && !alarmFiredRef.current) {
      alarmFiredRef.current = true;
      playAlarmBeep();
      sendNotification(
        '⚡ GLUTE ACTIVATION',
        'Time to move! Stand up and activate for 60 seconds.'
      );
      // Auto-transition to activation after a brief alarm display
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
    <div className="relative min-h-[280px] flex flex-col items-center justify-center">
      {/* Settings toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-0 right-0 z-30 flex h-7 w-7 items-center justify-center
          rounded-full transition-colors hover:bg-white/10"
        title="Settings"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="text-text-muted"
        >
          <circle cx="7" cy="2" r="1.2" fill="currentColor" />
          <circle cx="7" cy="7" r="1.2" fill="currentColor" />
          <circle cx="7" cy="12" r="1.2" fill="currentColor" />
        </svg>
      </button>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            restDuration={state.restDuration}
            activationDuration={state.activationDuration}
            onRestChange={(v) =>
              dispatch({ type: 'UPDATE_REST_DURATION', payload: v })
            }
            onActivationChange={(v) =>
              dispatch({ type: 'UPDATE_ACTIVATION_DURATION', payload: v })
            }
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content by phase */}
      <AnimatePresence mode="wait">
        {state.phase === 'REST' && (
          <RestPhase
            key="rest"
            secondsLeft={state.secondsLeft}
            totalSeconds={state.restDuration}
          />
        )}
        {state.phase === 'ALARM' && <AlarmPhase key="alarm" />}
        {state.phase === 'ACTIVATION' && (
          <ActivationPhase
            key="activation"
            secondsLeft={state.secondsLeft}
            totalSeconds={state.activationDuration}
            onReset={handleReset}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================
   Phase Components
   ============================================ */

function RestPhase({
  secondsLeft,
  totalSeconds,
}: {
  secondsLeft: number;
  totalSeconds: number;
}) {
  const progress = secondsLeft / totalSeconds;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-5"
    >
      {/* Seated figure SVG */}
      <SeatedFigure />

      {/* Timer */}
      <div className="text-center">
        <p
          className="text-xs tracking-[0.2em] uppercase text-text-muted mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Next activation in
        </p>
        <p className={styles.dotmatrixMedium}>{formatTime(secondsLeft)}</p>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full max-w-[200px] overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full bg-white/20"
          initial={{ width: '100%' }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5 }}
        />
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
      {/* Flashing alert icon */}
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
  onReset,
}: {
  secondsLeft: number;
  totalSeconds: number;
  onReset: () => void;
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
      className="flex flex-col items-center gap-4"
    >
      {/* Circular progress */}
      <div className="relative flex items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          {/* Background circle */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="rgba(255,0,0,0.1)"
            strokeWidth="4"
          />
          {/* Progress circle */}
          <motion.circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#FF0000"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </svg>

        {/* Center time */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={styles.dotmatrixGlowRed} style={{ fontSize: '2rem' }}>
            {secondsLeft}
          </span>
        </div>
      </div>

      {/* Message */}
      <p
        className="text-center text-xs font-semibold tracking-[0.2em] uppercase text-accent-alarm"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Time to move. Glute activation.
      </p>

      {/* Moving figure */}
      <MovingFigure />

      {/* Reset button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onReset}
        className="mt-2 rounded-[12px] border border-accent-alarm/30 bg-accent-alarm/10
          px-6 py-2.5 text-xs font-semibold tracking-[0.15em] uppercase text-accent-alarm
          transition-colors hover:border-accent-alarm/50 hover:bg-accent-alarm/20"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Confirm Reset
      </motion.button>
    </motion.div>
  );
}

/* ============================================
   Settings Panel
   ============================================ */

function SettingsPanel({
  restDuration,
  activationDuration,
  onRestChange,
  onActivationChange,
  onClose,
}: {
  restDuration: number;
  activationDuration: number;
  onRestChange: (v: number) => void;
  onActivationChange: (v: number) => void;
  onClose: () => void;
}) {
  const restMinutes = Math.floor(restDuration / 60);
  const activationSeconds = activationDuration;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute inset-0 z-20 flex flex-col rounded-[16px] bg-surface-elevated/95
        p-5 backdrop-blur-sm border border-border"
    >
      <div className="flex items-center justify-between mb-5">
        <h4
          className="text-[11px] font-medium tracking-[0.2em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Timer Settings
        </h4>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full
            hover:bg-white/10 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Rest duration */}
      <div className="mb-5">
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
          className="w-full accent-white h-1 bg-white/10 rounded-full appearance-none
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
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
          Activation Duration: {activationSeconds} sec
        </label>
        <input
          type="range"
          min={10}
          max={300}
          value={activationSeconds}
          onChange={(e) => onActivationChange(Number(e.target.value))}
          className="w-full accent-white h-1 bg-white/10 rounded-full appearance-none
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="mt-1 flex justify-between text-[9px] text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}>
          <span>10 sec</span>
          <span>300 sec</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================
   SVG Illustrations
   ============================================ */

function SeatedFigure() {
  return (
    <motion.svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Head */}
      <circle cx="32" cy="12" r="6" stroke="white" strokeWidth="1.5" />
      {/* Body (seated) */}
      <path
        d="M32 18v14"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Arms resting */}
      <path
        d="M32 24l-10 6M32 24l10 6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Legs bent (seated) */}
      <path
        d="M32 32l-8 10h-4M32 32l8 10h4"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Chair suggestion */}
      <path
        d="M18 42h28"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </motion.svg>
  );
}

function MovingFigure() {
  return (
    <motion.svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      animate={{ rotate: [0, -5, 5, -5, 0] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    >
      {/* Head */}
      <circle cx="24" cy="8" r="4.5" stroke="#FF0000" strokeWidth="1.5" />
      {/* Body */}
      <path
        d="M24 12.5v10"
        stroke="#FF0000"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Arms up - active */}
      <motion.path
        d="M24 16l-9-4M24 16l9-4"
        stroke="#FF0000"
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ d: ['M24 16l-9-4M24 16l9-4', 'M24 16l-8-7M24 16l8-7'] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
      />
      {/* Legs spread - active */}
      <path
        d="M24 22.5l-7 12M24 22.5l7 12"
        stroke="#FF0000"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
