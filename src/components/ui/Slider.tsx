interface SliderProps {
  label: string;
  /** Formatted readout shown right-aligned against the label. */
  readout: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

/** Label left, value right, instrument track below. */
export default function Slider({
  label,
  readout,
  value,
  min,
  max,
  step = 1,
  onChange,
}: SliderProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="nd-label">{label}</span>
        <span className="nd-data text-body-sm text-ink-display">{readout}</span>
      </div>
      <input
        type="range"
        className="nd-range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] tracking-[0.08em] text-ink-disabled">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
