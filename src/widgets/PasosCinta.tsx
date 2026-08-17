import { useCallback, useState } from 'react';
import WidgetPanel from '../components/WidgetPanel';
import { Segmented, SegmentedBar, Slider } from '../components/ui';
import { useWidgetStore } from '../lib/widgetStore';
import { readState, writeState } from '../lib/syncStorage';

export const title = 'Treadmill Steps';
export const defaultSize = { cols: 1, rows: 1 };

const STORAGE_KEY = 'widgethub-treadmill-steps';

type StrideMode = 'walk' | 'run';

interface StepsConfig {
  heightCm: number;
  strideMode: StrideMode;
}

/** Stride length as a fraction of height — the usual pedometer approximation. */
const STRIDE_FACTOR: Record<StrideMode, number> = { walk: 0.414, run: 0.65 };

const HEIGHT_RANGE = { min: 140, max: 215 };

// Deliberately a neutral placeholder rather than anyone's real height: this
// repository is public, and the value is per-user state anyway.
const DEFAULTS: StepsConfig = { heightCm: 175, strideMode: 'walk' };

const PRESETS = [1, 2, 3, 5, 10];

function loadConfig(): StepsConfig {
  return { ...DEFAULTS, ...readState<Partial<StepsConfig>>(STORAGE_KEY, {}) };
}

export default function PasosCinta() {
  const [config, setConfig] = useState<StepsConfig>(loadConfig);
  const [input, setInput] = useState('');
  const hideWidget = useWidgetStore((s) => s.hideWidget);

  const update = useCallback((partial: Partial<StepsConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      writeState(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const km = parseKm(input);
  const strideCm = Math.round(config.heightCm * STRIDE_FACTOR[config.strideMode]);
  const steps = strideCm > 0 ? Math.round((km * 100_000) / strideCm) : 0;

  return (
    <WidgetPanel
      title="Treadmill Steps"
      onHide={() => hideWidget('PasosCinta')}
      settingsContent={
        <StepsSettings config={config} strideCm={strideCm} onChange={update} />
      }
    >
      <div className="flex flex-1 flex-col">
        <p className="nd-label">Steps</p>

        {/* Layer 1 — the converted figure, the reason the widget exists. */}
        <div className="mt-3 flex items-baseline gap-2">
          {/* Doto renders an em-dash as a smear of dots, so the resting state
              is an honest zero rather than a placeholder glyph. */}
          <span
            className={`nd-display text-display-lg ${
              steps > 0 ? '' : 'text-ink-disabled'
            }`}
          >
            {steps.toLocaleString('es-ES')}
          </span>
        </div>

        {/* Distance entry — underline input, the lightest container that works. */}
        <div className="mt-6 flex items-baseline gap-3 border-b border-line-strong pb-2
          focus-within:border-ink-display transition-colors duration-200 ease-nd">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^0-9.,]/g, ''))}
            inputMode="decimal"
            placeholder="0"
            aria-label="Distance in kilometres"
            className="nd-data min-w-0 flex-1 bg-transparent text-heading text-ink
              outline-none placeholder:text-ink-disabled"
          />
          <span className="nd-label">KM</span>
        </div>

        <div className="mt-4">
          <Segmented
            label="Stride mode"
            value={config.strideMode}
            options={[
              { value: 'walk' as StrideMode, label: 'Walk' },
              { value: 'run' as StrideMode, label: 'Run' },
            ]}
            onChange={(strideMode) => update({ strideMode })}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setInput(String(preset))}
              className={`rounded-pill border px-3 py-1 font-mono text-[10px] uppercase
                tracking-[0.08em] transition-colors duration-200 ease-nd
                ${
                  km === preset
                    ? 'border-ink-display text-ink-display'
                    : 'border-line-strong text-ink-disabled hover:border-ink-display hover:text-ink-display'
                }`}
            >
              {preset} km
            </button>
          ))}
        </div>

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <div className="flex items-baseline justify-between">
            <span className="nd-label">Stride</span>
            <span className="nd-data text-body-sm text-ink-display">
              {strideCm} <span className="text-ink-muted">cm</span>
            </span>
          </div>

          {/* Stride against the plausible range — proportion beside the number. */}
          <SegmentedBar
            progress={(strideCm - 55) / (140 - 55)}
            segments={20}
            height={5}
            label="Stride length within the usual range"
          />
        </div>
      </div>
    </WidgetPanel>
  );
}

function StepsSettings({
  config,
  strideCm,
  onChange,
}: {
  config: StepsConfig;
  strideCm: number;
  onChange: (partial: Partial<StepsConfig>) => void;
}) {
  return (
    <>
      <Slider
        label="Your height"
        readout={`${config.heightCm} cm`}
        value={config.heightCm}
        min={HEIGHT_RANGE.min}
        max={HEIGHT_RANGE.max}
        onChange={(heightCm) => onChange({ heightCm })}
      />

      <div className="border-t border-line pt-5">
        <p className="nd-label mb-2">Calculated stride</p>
        <div className="flex items-baseline gap-2">
          <span className="nd-data text-display-md text-ink-display">{strideCm}</span>
          <span className="nd-label">CM / STEP</span>
        </div>
        <p className="nd-caption mt-3 text-ink-disabled">
          {config.strideMode === 'walk'
            ? 'WALKING — HEIGHT × 0.414'
            : 'RUNNING — HEIGHT × 0.65'}
        </p>
      </div>
    </>
  );
}

/** Accepts both decimal separators, since the panel is used in es-ES. */
function parseKm(raw: string): number {
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
