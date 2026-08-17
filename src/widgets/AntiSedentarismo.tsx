import { useMemo, useState, type ReactNode } from 'react';
import WidgetPanel from '../components/WidgetPanel';
import { Button, Icon, IconButton, SegmentedBar, Segmented, Slider, Toggle } from '../components/ui';
import { useWidgetStore } from '../lib/widgetStore';
import { useNow } from '../lib/useNow';
import {
  useGluteStore,
  computeStats,
  elapsedFraction,
  remainingSeconds,
  LIMITS,
  type GluteState,
} from '../lib/gluteStore';
import {
  notificationPermission,
  requestNotificationPermission,
} from '../lib/notifications';

export const title = 'Glute Activation';
export const defaultSize = { cols: 1, rows: 1 };

/**
 * Presentation only. The timer itself lives in `gluteStore` and is driven by
 * `gluteEngine` at App level, so it keeps running while this widget is hidden.
 */
export default function AntiSedentarismo() {
  const hideWidget = useWidgetStore((s) => s.hideWidget);
  const state = useGluteStore();
  const now = useNow(500);

  const stats = useMemo(
    () => computeStats(state.history, now),
    // Recomputing once a minute is enough for day-bucketed counters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.history, Math.floor(now / 60_000)],
  );

  const paused = state.pausedRemaining !== null;
  const due = state.phase === 'DUE';

  return (
    <WidgetPanel
      title="Glute Activation"
      signal={due || state.phase === 'ACTIVE'}
      status={paused ? 'PAUSED' : undefined}
      onHide={() => hideWidget('AntiSedentarismo')}
      settingsContent={<GluteSettings state={state} />}
    >
      <div className="flex flex-1 flex-col">
        {state.phase === 'REST' && <RestView state={state} now={now} />}
        {due && <DueView state={state} now={now} />}
        {state.phase === 'ACTIVE' && <ActiveView state={state} now={now} />}

        <Footer stats={stats} animate={state.animationsEnabled} />
      </div>
    </WidgetPanel>
  );
}

/* ============================================================
   Phases
   ============================================================ */

function RestView({ state, now }: { state: GluteState; now: number }) {
  const secs = remainingSeconds(state, now);
  const paused = state.pausedRemaining !== null;

  return (
    <div className="flex flex-1 flex-col">
      <p className="nd-label">{paused ? 'Hold' : 'Next activation'}</p>

      {/* Layer 1 — the only display-size element in the card. */}
      <p
        className={`nd-display mt-3 text-display-lg ${paused ? 'text-ink-disabled' : ''}`}
      >
        {formatClock(secs)}
      </p>

      <div className="mt-6">
        <SegmentedBar
          progress={elapsedFraction(state, now)}
          label="Rest elapsed"
          height={10}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="nd-caption">
          {paused ? 'PAUSED' : `DUE ${formatTimeOfDay(state.deadline)}`}
        </span>
        <div className="flex gap-2">
          <IconButton
            label={paused ? 'Resume' : 'Pause'}
            onClick={() => useGluteStore.getState().togglePause()}
          >
            <Icon name={paused ? 'play' : 'pause'} size={18} />
          </IconButton>
          <IconButton
            label="Restart rest"
            onClick={() => useGluteStore.getState().restart()}
          >
            <Icon name="restart" size={18} />
          </IconButton>
        </div>
      </div>

      <div className="mt-4">
        <Button
          block
          size="sm"
          onClick={() => useGluteStore.getState().beginActivation()}
        >
          Activate now
        </Button>
      </div>
    </div>
  );
}

function DueView({ state, now }: { state: GluteState; now: number }) {
  const waiting = Math.max(0, Math.floor((now - (state.dueSince ?? now)) / 1000));

  return (
    <div className="flex flex-1 flex-col">
      <p className="nd-label text-accent">Activation due</p>

      <p className="nd-display mt-3 text-display-lg text-accent">NOW</p>

      <p className="nd-caption mt-3">
        WAITING {formatClock(waiting)} · NOTHING STARTS WITHOUT YOU
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Button
          block
          variant="destructive"
          onClick={() => useGluteStore.getState().beginActivation()}
        >
          Start activation
        </Button>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            onClick={() => useGluteStore.getState().snooze()}
          >
            Snooze {state.snoozeMinutes}m
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant="ghost"
            onClick={() => useGluteStore.getState().skip()}
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActiveView({ state, now }: { state: GluteState; now: number }) {
  const secs = remainingSeconds(state, now);
  const paused = state.pausedRemaining !== null;

  return (
    <div className="flex flex-1 flex-col">
      <p className="nd-label text-accent">{paused ? 'Activation held' : 'Activate'}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="nd-display text-display-xl text-accent">{secs}</span>
        <span className="nd-label text-accent">SEC</span>
      </div>

      <div className="mt-6">
        <SegmentedBar
          progress={elapsedFraction(state, now)}
          tone="accent"
          label="Activation progress"
          height={14}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="nd-caption">
          {state.activationSeconds}S SET · SQUEEZE AND HOLD
        </span>
        <div className="flex gap-2">
          <IconButton
            label={paused ? 'Resume' : 'Pause'}
            signal
            onClick={() => useGluteStore.getState().togglePause()}
          >
            <Icon name={paused ? 'play' : 'pause'} size={18} />
          </IconButton>
          <IconButton
            label="Restart activation"
            signal
            onClick={() => useGluteStore.getState().restart()}
          >
            <Icon name="restart" size={18} />
          </IconButton>
        </div>
      </div>

      <div className="mt-4">
        <Button
          block
          size="sm"
          onClick={() => useGluteStore.getState().endActivationEarly()}
        >
          End early
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
   Footer — tertiary data, pushed to the bottom edge
   ============================================================ */

function Footer({
  stats,
  animate,
}: {
  stats: ReturnType<typeof computeStats>;
  animate: boolean;
}) {
  const max = Math.max(1, ...stats.week);

  return (
    <div className="mt-auto space-y-3 border-t border-line pt-4">
      <div className="flex items-baseline justify-between">
        <span className="nd-label">Today</span>
        <span className="nd-data text-body-sm text-ink-display">
          {stats.today}
          {stats.skippedToday > 0 && (
            <span className="text-ink-disabled"> / {stats.skippedToday} skipped</span>
          )}
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="nd-label">Streak</span>
        <span
          className={`nd-data text-body-sm ${
            stats.streak > 0 ? 'text-success' : 'text-ink-disabled'
          }`}
        >
          {stats.streak}d
        </span>
      </div>

      {/* Seven-day history as a dot column per day — opacity carries the value. */}
      <div className="flex items-end gap-[3px] pt-1" aria-label="Last seven days">
        {stats.week.map((count, i) => (
          <span
            key={i}
            title={`${count} reps`}
            className={`h-6 flex-1 transition-opacity duration-200 ease-nd ${
              count > 0 ? 'bg-ink-display' : 'bg-line'
            } ${animate && i === 6 && count > 0 ? 'animate-nd-signal' : ''}`}
            style={count > 0 ? { opacity: 0.35 + 0.65 * (count / max) } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Settings
   ============================================================ */

function GluteSettings({ state }: { state: GluteState }) {
  const [permission, setPermission] = useState(notificationPermission);
  const store = useGluteStore.getState();

  // Turning the switch on is the gesture the browser needs in order to show
  // its permission prompt, so ask here rather than leaving a dead toggle.
  const toggleNotifications = async () => {
    if (!state.notificationsEnabled && permission === 'default') {
      const granted = await requestNotificationPermission();
      setPermission(notificationPermission());
      if (!granted) return;
    }
    store.toggleNotifications();
  };

  return (
    <>
      <Slider
        label="Rest interval"
        readout={`${state.restMinutes} min`}
        value={state.restMinutes}
        min={LIMITS.rest.min}
        max={LIMITS.rest.max}
        onChange={(v) => store.setRestMinutes(v)}
      />

      <Slider
        label="Activation length"
        readout={`${state.activationSeconds} sec`}
        value={state.activationSeconds}
        min={LIMITS.activation.min}
        max={LIMITS.activation.max}
        step={5}
        onChange={(v) => store.setActivationSeconds(v)}
      />

      <Slider
        label="Snooze length"
        readout={`${state.snoozeMinutes} min`}
        value={state.snoozeMinutes}
        min={LIMITS.snooze.min}
        max={LIMITS.snooze.max}
        onChange={(v) => store.setSnoozeMinutes(v)}
      />

      <div>
        <p className="nd-label mb-2">Remind every</p>
        <Segmented
          label="Reminder cadence"
          value={String(state.nagSeconds)}
          options={[
            { value: '30', label: '30s' },
            { value: '45', label: '45s' },
            { value: '120', label: '2m' },
            { value: '300', label: '5m' },
          ]}
          onChange={(v) => store.setNagSeconds(Number(v))}
        />
      </div>

      <div className="space-y-4 border-t border-line pt-5">
        <SettingRow label="Sound">
          <Toggle checked={state.soundEnabled} onChange={store.toggleSound} label="Sound" />
        </SettingRow>

        <SettingRow
          label="Notifications"
          note={
            permission === 'denied'
              ? '[BLOCKED BY BROWSER]'
              : permission === 'unsupported'
                ? '[UNSUPPORTED]'
                : undefined
          }
        >
          <Toggle
            checked={state.notificationsEnabled && permission === 'granted'}
            onChange={() => void toggleNotifications()}
            label="Notifications"
          />
        </SettingRow>

        <SettingRow label="Animations">
          <Toggle
            checked={state.animationsEnabled}
            onChange={store.toggleAnimations}
            label="Animations"
          />
        </SettingRow>
      </div>

      {state.history.length > 0 && (
        <div className="border-t border-line pt-5">
          <Button block size="sm" variant="destructive" onClick={store.clearHistory}>
            Clear {state.history.length} logged sessions
          </Button>
        </div>
      )}
    </>
  );
}

function SettingRow({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="nd-label">{label}</p>
        {note && <p className="nd-label mt-1 text-accent">{note}</p>}
      </div>
      {children}
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function formatTimeOfDay(ts: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ts);
}
