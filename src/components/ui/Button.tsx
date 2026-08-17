import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ink-display text-canvas border border-ink-display hover:opacity-90',
  secondary:
    'bg-transparent text-ink border border-line-strong hover:border-ink-display hover:text-ink-display',
  ghost:
    'bg-transparent text-ink-muted border border-transparent hover:text-ink-display',
  destructive:
    'bg-transparent text-accent border border-accent hover:bg-accent-subtle',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-6 text-[13px]',
  sm: 'min-h-9 px-4 text-label',
};

/**
 * Nothing button: Space Mono, ALL CAPS, pill. Colour never signals hierarchy —
 * the variant does.
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`
        inline-flex items-center justify-center gap-2 rounded-pill font-mono
        uppercase tracking-[0.08em] transition-colors duration-200 ease-nd
        disabled:cursor-not-allowed disabled:opacity-40
        ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}
      `}
    />
  );
}
