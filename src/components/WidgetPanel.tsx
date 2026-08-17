import { useState, type ReactNode } from 'react';
import { useDragHandle } from './DragHandleContext';
import { Icon, IconButton } from './ui';

interface WidgetPanelProps {
  /** Rendered as the instrument-panel label, ALL CAPS. */
  title: string;
  children: ReactNode;
  onHide?: () => void;
  /** Puts the panel in its one accent state: red outline + blinking marker. */
  signal?: boolean;
  /** Short bracketed status shown next to the title, e.g. `PAUSED`. */
  status?: string;
  settingsContent?: ReactNode;
  className?: string;
}

/**
 * Flat surface, hairline border, no shadow and no glass. Settings replace the
 * body in place rather than floating above it — a mode switch, not an overlay,
 * which also removes the clipping and z-index fights a popover created.
 */
export default function WidgetPanel({
  title,
  children,
  onHide,
  signal = false,
  status,
  settingsContent,
  className = '',
}: WidgetPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const dragHandle = useDragHandle();

  return (
    <section
      className={`flex h-full flex-col rounded-card border bg-surface
        transition-colors duration-200 ease-nd
        ${signal ? 'border-accent' : 'border-line hover:border-line-strong'}
        ${className}`}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div
          {...dragHandle}
          className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 active:cursor-grabbing"
        >
          {signal && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-pill bg-accent animate-nd-signal"
              aria-hidden="true"
            />
          )}
          <h2 className="nd-label truncate">
            {showSettings ? `${title} / CONFIG` : title}
          </h2>
          {status && !showSettings && (
            <span className="nd-label shrink-0 text-ink-disabled">[{status}]</span>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          {settingsContent && (
            <button
              onClick={() => setShowSettings((v) => !v)}
              title={showSettings ? 'Close settings' : 'Settings'}
              aria-label={`${title} settings`}
              aria-expanded={showSettings}
              className={`flex h-8 w-8 items-center justify-center rounded-tech transition-colors duration-200 ease-nd
                ${showSettings ? 'text-ink-display' : 'text-ink-disabled hover:text-ink-display'}`}
            >
              <Icon name={showSettings ? 'close' : 'dots'} size={16} />
            </button>
          )}
          {onHide && !showSettings && (
            <button
              onClick={onHide}
              title="Hide widget"
              aria-label={`Hide ${title}`}
              className="flex h-8 w-8 items-center justify-center rounded-tech text-ink-disabled
                transition-colors duration-200 ease-nd hover:text-ink-display"
            >
              <Icon name="minus" size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 py-5">
        {showSettings ? (
          <div className="flex flex-1 flex-col">
            {/* Capped so opening settings does not stretch the whole grid row. */}
            <div className="max-h-[420px] flex-1 space-y-6 overflow-y-auto pr-1">
              {settingsContent}
            </div>
            <div className="mt-6 border-t border-line pt-4">
              <IconButton label="Close settings" onClick={() => setShowSettings(false)}>
                <Icon name="check" size={18} />
              </IconButton>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
