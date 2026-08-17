import { useThemeStore } from '../lib/themeStore';
import { Icon } from './ui';

/** Two-segment mechanical switch. The active half inverts — no colour used. */
export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Colour mode"
      className="flex overflow-hidden rounded-pill border border-line-strong"
    >
      {(['dark', 'light'] as const).map((mode) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            role="radio"
            aria-checked={active}
            aria-label={`${mode} mode`}
            onClick={() => setTheme(mode)}
            className={`flex h-9 w-10 items-center justify-center transition-colors duration-200 ease-nd
              ${active ? 'bg-ink-display text-canvas' : 'text-ink-disabled hover:text-ink-display'}`}
          >
            <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={16} />
          </button>
        );
      })}
    </div>
  );
}
