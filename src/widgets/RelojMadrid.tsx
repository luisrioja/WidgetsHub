import { useState, useEffect } from 'react';
import styles from '../styles/dotmatrix.module.css';

export const title = 'Madrid';
export const defaultSize = { cols: 1, rows: 1 };

export default function RelojMadrid() {
  const [time, setTime] = useState(() => getMadridTime());
  const [date, setDate] = useState(() => getMadridDate());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getMadridTime());
      setDate(getMadridDate());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [hours, minutes, seconds] = time.split(':');

  return (
    <div className="flex flex-col items-center justify-center py-4">
      {/* Time display */}
      <div className="relative flex items-baseline gap-1">
        <span className={styles.dotmatrixLarge}>{hours}</span>
        <span className={`${styles.dotmatrixLarge} animate-dot-blink`}>:</span>
        <span className={styles.dotmatrixLarge}>{minutes}</span>
        <span
          className={styles.dotmatrixMedium}
          style={{ marginLeft: '4px', opacity: 0.5 }}
        >
          {seconds}
        </span>
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
  );
}

function getMadridTime(): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
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
