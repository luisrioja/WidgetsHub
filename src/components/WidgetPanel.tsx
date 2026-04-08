import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface WidgetPanelProps {
  title: string;
  children: ReactNode;
  onHide?: () => void;
  isAlarm?: boolean;
  className?: string;
}

export default function WidgetPanel({
  title,
  children,
  onHide,
  isAlarm = false,
  className = '',
}: WidgetPanelProps) {
  return (
    <motion.div
      layout
      className={`
        relative overflow-hidden rounded-[20px] border
        ${
          isAlarm
            ? 'border-accent-alarm/50 animate-pulse-red'
            : 'border-border hover:border-border-hover'
        }
        bg-surface transition-colors duration-300
        ${className}
      `}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Glassmorphism overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
        <h2
          className="font-mono text-[11px] font-medium tracking-[0.2em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {title}
        </h2>
        {onHide && (
          <button
            onClick={onHide}
            className="group flex h-6 w-6 items-center justify-center rounded-full
              transition-all duration-200 hover:bg-white/10"
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

      {/* Content */}
      <div className="relative z-10 px-5 pb-5">{children}</div>
    </motion.div>
  );
}
