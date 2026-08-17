type Tone = 'neutral' | 'accent' | 'success' | 'warning';

interface SegmentedBarProps {
  /** 0–1. Values above 1 overflow in the given tone. */
  progress: number;
  segments?: number;
  tone?: Tone;
  /** Hero 18px, standard 10px, compact 5px. */
  height?: number;
  label?: string;
}

const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-ink-display',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
};

/**
 * The signature Nothing readout: discrete blocks, square ends, 2px gaps.
 * Proportion only — always pair it with a numeric value nearby.
 */
export default function SegmentedBar({
  progress,
  segments = 24,
  tone = 'neutral',
  height = 10,
  label,
}: SegmentedBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clamped * segments);

  return (
    <div
      className="flex w-full gap-[2px]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      style={{ height }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`flex-1 transition-colors duration-200 ease-nd ${
            i < filled ? TONE_FILL[tone] : 'bg-line'
          }`}
        />
      ))}
    </div>
  );
}
