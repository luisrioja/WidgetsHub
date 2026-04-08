import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/dotmatrix.module.css';
import WidgetPanel from '../components/WidgetPanel';
import { useWidgetStore } from '../lib/widgetStore';

export const title = 'Madrid';
export const defaultSize = { cols: 1, rows: 1 };

/* ============================================
   Settings persistence
   ============================================ */

interface ClockSettings {
  use24h: boolean;
  showSeconds: boolean;
  digitColor: string;
}

const STORAGE_KEY = 'widgethub-clock-settings';

function loadSettings(): ClockSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { use24h: true, showSeconds: true, digitColor: '#1a1a1a' };
}

function saveSettings(s: ClockSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/* ============================================
   Component
   ============================================ */

export default function RelojMadrid() {
  const [settings, setSettings] = useState<ClockSettings>(loadSettings);
  const [time, setTime] = useState(() => getMadridTime(settings));
  const [date, setDate] = useState(() => getMadridDate());
  const hideWidget = useWidgetStore((s) => s.hideWidget);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getMadridTime(settings));
      setDate(getMadridDate());
    }, 1000);
    return () => clearInterval(interval);
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<ClockSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const parts = time.split(':');
  const hours = parts[0];
  const minutes = parts[1];
  const seconds = parts[2]; // may be undefined if showSeconds is false

  return (
    <WidgetPanel
      title="Madrid"
      onHide={() => hideWidget('RelojMadrid')}
      settingsContent={
        <ClockSettingsPanel settings={settings} onChange={updateSettings} />
      }
    >
      <div className="flex flex-col items-center justify-center py-4">
        {/* Time display */}
        <div className="relative flex items-baseline gap-1">
          <span
            className={styles.dotmatrixLarge}
            style={{ color: settings.digitColor, fontSize: 'clamp(3rem, 8vw, 6rem)' }}
          >
            {hours}
          </span>
          <span
            className={`${styles.dotmatrixLarge} animate-dot-blink`}
            style={{ color: settings.digitColor, fontSize: 'clamp(3rem, 8vw, 6rem)' }}
          >
            :
          </span>
          <span
            className={styles.dotmatrixLarge}
            style={{ color: settings.digitColor, fontSize: 'clamp(3rem, 8vw, 6rem)' }}
          >
            {minutes}
          </span>
          {settings.showSeconds && seconds && (
            <span
              className={styles.dotmatrixMedium}
              style={{
                color: settings.digitColor,
                marginLeft: '4px',
                opacity: 0.5,
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              }}
            >
              {seconds}
            </span>
          )}
        </div>

        {/* Date */}
        <p
          className="mt-3 text-xs tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {date}
        </p>

        {/* Timezone badge */}
        <div
          className="mt-2 rounded-full border border-border px-3 py-0.5 text-[10px]
            tracking-[0.2em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Europe/Madrid · CET
        </div>
      </div>
    </WidgetPanel>
  );
}

/* ============================================
   Settings Panel Content
   ============================================ */

function ClockSettingsPanel({
  settings,
  onChange,
}: {
  settings: ClockSettings;
  onChange: (partial: Partial<ClockSettings>) => void;
}) {
  const presetColors = ['#1a1a1a', '#ff0000', '#0066ff', '#00aa55', '#ff8800', '#9933ff', '#ffffff'];

  return (
    <div className="space-y-6">
      {/* Time Format */}
      <div>
        <label
          className="mb-3 block text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Time Format
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => onChange({ use24h: true })}
            className={`rounded-[10px] border px-4 py-2 text-[11px] tracking-wider transition-all
              ${settings.use24h
                ? 'border-text-primary bg-text-primary text-surface'
                : 'border-border text-text-secondary hover:border-border-hover'
              }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            24H
          </button>
          <button
            onClick={() => onChange({ use24h: false })}
            className={`rounded-[10px] border px-4 py-2 text-[11px] tracking-wider transition-all
              ${!settings.use24h
                ? 'border-text-primary bg-text-primary text-surface'
                : 'border-border text-text-secondary hover:border-border-hover'
              }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            12H
          </button>
        </div>
      </div>

      {/* Display Format */}
      <div>
        <label
          className="mb-3 block text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Display
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => onChange({ showSeconds: true })}
            className={`rounded-[10px] border px-4 py-2 text-[11px] tracking-wider transition-all
              ${settings.showSeconds
                ? 'border-text-primary bg-text-primary text-surface'
                : 'border-border text-text-secondary hover:border-border-hover'
              }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            HH:mm:ss
          </button>
          <button
            onClick={() => onChange({ showSeconds: false })}
            className={`rounded-[10px] border px-4 py-2 text-[11px] tracking-wider transition-all
              ${!settings.showSeconds
                ? 'border-text-primary bg-text-primary text-surface'
                : 'border-border text-text-secondary hover:border-border-hover'
              }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            HH:mm
          </button>
        </div>
      </div>

      {/* Digit Color */}
      <div>
        <label
          className="mb-3 block text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Digit Color
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ digitColor: color })}
              className={`h-6 w-6 rounded-full border-2 transition-all
                ${settings.digitColor === color
                  ? 'border-text-primary scale-110'
                  : 'border-border hover:scale-105'
                }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* Custom color picker */}
          <label className="relative h-6 w-6 cursor-pointer">
            <input
              type="color"
              value={settings.digitColor}
              onChange={(e) => onChange({ digitColor: e.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border
                bg-gradient-to-br from-red-400 via-green-400 to-blue-400"
              title="Custom color"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   Helpers
   ============================================ */

function getMadridTime(settings: ClockSettings): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: !settings.use24h,
  };
  if (settings.showSeconds) {
    opts.second = '2-digit';
  }
  let result = new Intl.DateTimeFormat('es-ES', opts).format(new Date());
  // Remove AM/PM for cleaner display (it'll show in 12h context)
  result = result.replace(/\s?(a\.?\s?m\.?|p\.?\s?m\.?)/i, '');
  return result;
}

function getMadridDate(): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}
