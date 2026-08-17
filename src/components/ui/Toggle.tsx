interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

/** Physical switch: pill track, square thumb, no easing overshoot. */
export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-pill border transition-colors duration-200 ease-nd
        ${checked ? 'border-ink-display bg-ink-display' : 'border-line-strong bg-transparent'}`}
    >
      <span
        className={`absolute top-[3px] h-4 w-4 rounded-pill transition-[left] duration-200 ease-nd
          ${checked ? 'left-[25px] bg-canvas' : 'left-[3px] bg-ink-disabled'}`}
      />
    </button>
  );
}
