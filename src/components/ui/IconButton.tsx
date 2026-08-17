import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  /** Renders the control in accent red — reserve for the one urgent action. */
  signal?: boolean;
}

/**
 * Square 40px control. Mechanical honesty: a control looks like a control,
 * so it keeps its outline at rest instead of appearing on hover.
 */
export default function IconButton({
  label,
  children,
  signal = false,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={`
        flex h-10 w-10 shrink-0 items-center justify-center rounded-tech border
        transition-colors duration-200 ease-nd
        disabled:cursor-not-allowed disabled:opacity-40
        ${
          signal
            ? 'border-accent text-accent hover:bg-accent-subtle'
            : 'border-line-strong text-ink-muted hover:border-ink-display hover:text-ink-display'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}
