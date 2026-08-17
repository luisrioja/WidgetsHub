import { useCallback, useState } from 'react';
import WidgetPanel from '../components/WidgetPanel';
import { Segmented, SegmentedBar, Toggle } from '../components/ui';
import { useWidgetStore } from '../lib/widgetStore';
import { useNow } from '../lib/useNow';
import { readState, writeState } from '../lib/syncStorage';

export const title = 'Madrid';
export const defaultSize = { cols: 1, rows: 1 };

const TZ = 'Europe/Madrid';
const STORAGE_KEY = 'widgethub-clock-settings';

type Ink = 'display' | 'signal';

interface ClockSettings {
  use24h: boolean;
  showSeconds: boolean;
  ink: Ink;
}

const DEFAULTS: ClockSettings = { use24h: true, showSeconds: true, ink: 'display' };

function loadSettings(): ClockSettings {
  return { ...DEFAULTS, ...readState<Partial<ClockSettings>>(STORAGE_KEY, {}) };
}

export default function RelojMadrid() {
  const [settings, setSettings] = useState<ClockSettings>(loadSettings);
  const hideWidget = useWidgetStore((s) => s.hideWidget);
  const now = useNow(1000);

  const update = useCallback((partial: Partial<ClockSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      writeState(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const parts = zonedParts(now, settings.use24h);
  const inkClass = settings.ink === 'signal' ? 'text-accent' : 'text-ink-display';

  return (
    <WidgetPanel
      title="Madrid"
      onHide={() => hideWidget('RelojMadrid')}
      settingsContent={<ClockSettingsPanel settings={settings} onChange={update} />}
    >
      <div className="flex flex-1 flex-col">
        <p className="nd-label">{TZ}</p>

        {/* Layer 1 — dot-matrix time, the widget's whole reason to exist. */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`nd-display text-display-xl ${inkClass}`}>
            {parts.hour}
          </span>
          <span className={`nd-display text-display-xl ${inkClass} animate-nd-blink`}>
            :
          </span>
          <span className={`nd-display text-display-xl ${inkClass}`}>
            {parts.minute}
          </span>
          {settings.showSeconds && (
            <span className="nd-data text-heading text-ink-muted">{parts.second}</span>
          )}
          {!settings.use24h && (
            <span className="nd-label self-start pt-2">{parts.dayPeriod}</span>
          )}
        </div>

        {/* Seconds as a 60-segment sweep — a second reading of the same clock. */}
        <div className="mt-6">
          <SegmentedBar
            progress={Number(parts.second) / 60}
            segments={30}
            height={6}
            label="Seconds of the current minute"
          />
        </div>

        <div className="mt-auto flex items-baseline justify-between border-t border-line pt-4">
          <span className="nd-label">{parts.date}</span>
          <span className="nd-data text-caption text-ink-disabled">{parts.offset}</span>
        </div>
      </div>
    </WidgetPanel>
  );
}

function ClockSettingsPanel({
  settings,
  onChange,
}: {
  settings: ClockSettings;
  onChange: (partial: Partial<ClockSettings>) => void;
}) {
  return (
    <>
      <div>
        <p className="nd-label mb-2">Format</p>
        <Segmented
          label="Time format"
          value={settings.use24h ? '24' : '12'}
          options={[
            { value: '24', label: '24 H' },
            { value: '12', label: '12 H' },
          ]}
          onChange={(v) => onChange({ use24h: v === '24' })}
        />
      </div>

      <div>
        <p className="nd-label mb-2">Digit ink</p>
        <Segmented
          label="Digit ink"
          value={settings.ink}
          options={[
            { value: 'display', label: 'Mono' },
            { value: 'signal', label: 'Signal' },
          ]}
          onChange={(v) => onChange({ ink: v })}
        />
      </div>

      <div className="flex items-center justify-between border-t border-line pt-5">
        <p className="nd-label">Seconds</p>
        <Toggle
          checked={settings.showSeconds}
          onChange={() => onChange({ showSeconds: !settings.showSeconds })}
          label="Show seconds"
        />
      </div>
    </>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

interface ClockParts {
  hour: string;
  minute: string;
  second: string;
  dayPeriod: string;
  date: string;
  offset: string;
}

/**
 * `formatToParts` avoids the locale-dependent string surgery the previous
 * version needed to strip "a. m." out of a formatted time.
 */
function zonedParts(ts: number, use24h: boolean): ClockParts {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24h,
  }).formatToParts(ts);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const date = new Intl.DateTimeFormat('es-ES', {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .format(ts)
    .replace(/\./g, '');

  const offset =
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'shortOffset' })
      .formatToParts(ts)
      .find((p) => p.type === 'timeZoneName')?.value ?? '';

  return {
    hour: pick('hour').padStart(2, '0'),
    minute: pick('minute'),
    second: pick('second'),
    dayPeriod: pick('dayPeriod').toUpperCase().replace(/\./g, ''),
    date,
    offset,
  };
}
