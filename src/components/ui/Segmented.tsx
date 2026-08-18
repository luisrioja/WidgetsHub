interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}

/** 2–4 segments. Active inverts to ink-on-canvas — no colour involved. */
export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex overflow-hidden rounded-control border border-line-strong ${className}`}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-3 py-2 font-mono text-label uppercase tracking-[0.08em]
              transition-colors duration-200 ease-nd
              ${i > 0 ? 'border-l border-line-strong' : ''}
              ${
                active
                  ? 'bg-ink-display text-canvas'
                  : 'bg-transparent text-ink-muted hover:text-ink-display'
              }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
