import { type ReactNode, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WidgetPanelProps {
  title: string;
  children: ReactNode;
  onHide?: () => void;
  isAlarm?: boolean;
  className?: string;
  settingsContent?: ReactNode;
}

export default function WidgetPanel({
  title,
  children,
  onHide,
  isAlarm = false,
  className = '',
  settingsContent,
}: WidgetPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close settings when clicking outside the popup
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    // Small delay so the opening click doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [showSettings]);

  return (
    <div
      className={`
        relative rounded-[20px] border
        ${
          isAlarm
            ? 'border-accent-alarm/50 animate-pulse-red'
            : 'border-border hover:border-border-hover'
        }
        bg-surface transition-colors duration-300 shadow-sm
        ${className}
      `}
    >
      {/* Glassmorphism overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br to-transparent"
        style={{ '--tw-gradient-from': 'var(--color-glass-gradient-from)' } as React.CSSProperties}
      />

      {/* Header */}
      <div className="relative z-30 flex items-center justify-between px-5 pt-4 pb-2">
        <h2
          className="font-mono text-[11px] font-medium tracking-[0.2em] uppercase text-text-muted truncate mr-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {/* Settings (three dots) */}
          {settingsContent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
              className="group flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200"
              style={{ backgroundColor: showSettings ? 'var(--color-overlay-hover)' : 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-overlay-hover)';
              }}
              onMouseLeave={(e) => {
                if (!showSettings) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
              title="Settings"
              aria-label={`${title} settings`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-text-muted transition-colors group-hover:text-text-primary"
              >
                <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
                <circle cx="7" cy="7" r="1.2" fill="currentColor" />
                <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
              </svg>
            </button>
          )}
          {/* Hide button */}
          {onHide && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              className="group flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-overlay-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              title="Hide widget"
              aria-label={`Hide ${title} widget`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="text-text-muted transition-colors group-hover:text-text-primary"
              >
                <path
                  d="M1 6h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 pb-5">{children}</div>

      {/* Settings popup */}
      <AnimatePresence>
        {showSettings && settingsContent && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-14 right-4 z-[100] min-w-[280px] rounded-[16px]
              border border-border bg-surface px-6 py-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h4
                className="text-[11px] font-medium tracking-[0.2em] uppercase text-text-muted"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Settings
              </h4>
              <button
                onClick={() => setShowSettings(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-overlay-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1 1l8 8M9 1l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {settingsContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
