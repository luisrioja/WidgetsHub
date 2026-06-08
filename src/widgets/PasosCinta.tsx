import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WidgetPanel from '../components/WidgetPanel';
import { useWidgetStore } from '../lib/widgetStore';

export const title = 'Treadmill Steps';
export const defaultSize = { cols: 1, rows: 1 };

/* ============================================
   Config & Persistence
   ============================================ */

interface StepsConfig {
  heightCm: number;
  strideMode: 'walk' | 'run';
}

const STORAGE_KEY = 'widgethub-treadmill-steps';

// Walking stride ≈ height × 0.414, Running stride ≈ height × 0.65
const STRIDE_FACTOR = { walk: 0.414, run: 0.65 };

function loadConfig(): StepsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('no config');
    return JSON.parse(raw);
  } catch {
    return { heightCm: 192, strideMode: 'walk' };
  }
}

function saveConfig(config: StepsConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ============================================
   Helpers
   ============================================ */

function calculateSteps(km: number, heightCm: number, mode: 'walk' | 'run'): number {
  const strideLengthM = (heightCm * STRIDE_FACTOR[mode]) / 100;
  if (strideLengthM <= 0) return 0;
  return Math.round((km * 1000) / strideLengthM);
}

function formatSteps(steps: number): string {
  return steps.toLocaleString('es-ES');
}

/* ============================================
   Component
   ============================================ */

export default function PasosCinta() {
  const [config, setConfig] = useState<StepsConfig>(loadConfig);
  const [inputValue, setInputValue] = useState('');
  const [km, setKm] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hideWidget = useWidgetStore((s) => s.hideWidget);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handleInput = useCallback((value: string) => {
    // Allow digits, dots and commas
    const sanitized = value.replace(/[^0-9.,]/g, '');
    setInputValue(sanitized);
    const parsed = parseFloat(sanitized.replace(',', '.'));
    setKm(isNaN(parsed) ? 0 : parsed);
  }, []);

  const steps = calculateSteps(km, config.heightCm, config.strideMode);
  const strideLengthCm = Math.round(config.heightCm * STRIDE_FACTOR[config.strideMode]);

  return (
    <WidgetPanel
      title="Treadmill Steps"
      onHide={() => hideWidget('PasosCinta')}
      settingsContent={
        <StepsSettings
          config={config}
          strideLengthCm={strideLengthCm}
          onChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
        />
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {/* Distance input */}
        <div className="relative w-full max-w-[200px]">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent text-center text-[40px] font-light text-text-primary
              outline-none placeholder:text-text-muted/30 caret-text-primary"
            style={{ fontFamily: 'var(--font-body)' }}
          />
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-[1px] w-3/4 transition-all duration-300"
            style={{
              background: km > 0
                ? 'linear-gradient(90deg, transparent, var(--color-text-muted), transparent)'
                : 'linear-gradient(90deg, transparent, var(--color-text-muted)/30, transparent)',
            }}
          />
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] tracking-[0.1em] uppercase text-text-muted"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            km
          </span>
        </div>

        {/* Steps result */}
        <AnimatePresence mode="wait">
          <motion.div
            key={steps}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center gap-1"
          >
            <span
              className={`text-[28px] font-semibold tracking-tight transition-colors duration-300 ${
                steps > 0 ? 'text-text-primary' : 'text-text-muted/30'
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {steps > 0 ? formatSteps(steps) : '—'}
            </span>
            <span
              className="text-[10px] tracking-[0.2em] uppercase text-text-muted"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              steps
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Mode indicator */}
        <div className="flex items-center gap-2">
          {(['walk', 'run'] as const).map((mode) => (
            <motion.button
              key={mode}
              whileTap={{ scale: 0.92 }}
              onClick={() => setConfig((prev) => ({ ...prev, strideMode: mode }))}
              className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[10px]
                tracking-[0.12em] uppercase transition-all duration-200
                ${config.strideMode === mode
                  ? 'border-text-primary bg-text-primary text-surface'
                  : 'border-border text-text-muted hover:border-border-hover hover:text-text-secondary'
                }`}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {mode === 'walk' ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="2" r="1.5" fill="currentColor" />
                  <path d="M5 4.5l-1.5 3.5h1.5L6 11M7 4.5l1.5 3.5H7L6 11M4.5 6h3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="7" cy="2" r="1.5" fill="currentColor" />
                  <path d="M5 4l-2 4h2l.5 3M8 4l2 3H8l-.5 3M4 5.5h4.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {mode === 'walk' ? 'Walk' : 'Run'}
            </motion.button>
          ))}
        </div>

        {/* Quick presets */}
        {km === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap justify-center gap-1.5 mt-1"
          >
            {[1, 2, 3, 5, 10].map((preset) => (
              <button
                key={preset}
                onClick={() => { setInputValue(String(preset)); setKm(preset); }}
                className="rounded-[8px] border border-border/50 px-2.5 py-1 text-[10px]
                  text-text-muted transition-colors hover:border-border-hover hover:text-text-secondary"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {preset} km
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </WidgetPanel>
  );
}

/* ============================================
   Settings Panel
   ============================================ */

function StepsSettings({
  config,
  strideLengthCm,
  onChange,
}: {
  config: StepsConfig;
  strideLengthCm: number;
  onChange: (updates: Partial<StepsConfig>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Height */}
      <div>
        <label
          className="mb-2 block text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Your Height
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={config.heightCm}
            onChange={(e) => onChange({ heightCm: Math.max(100, Math.min(230, Number(e.target.value))) })}
            className="w-20 rounded-[8px] border border-border bg-transparent px-2.5 py-1.5
              text-center text-[13px] text-text-primary outline-none
              focus:border-text-primary transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          <span
            className="text-[10px] tracking-[0.1em] uppercase text-text-muted"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            cm
          </span>
        </div>
      </div>

      {/* Stride info */}
      <div className="rounded-[10px] border border-border/50 bg-overlay-hover/30 p-3">
        <div
          className="text-[9px] tracking-[0.15em] uppercase text-text-muted mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Calculated Stride
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[18px] font-medium text-text-primary"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {strideLengthCm}
          </span>
          <span
            className="text-[10px] text-text-muted"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            cm / step
          </span>
        </div>
        <p
          className="mt-2 text-[10px] leading-relaxed text-text-muted/70"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {config.strideMode === 'walk'
            ? 'Walking: height × 0.414'
            : 'Running: height × 0.65'}
        </p>
      </div>
    </div>
  );
}
