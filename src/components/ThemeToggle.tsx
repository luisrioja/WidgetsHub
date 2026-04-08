import { motion } from 'framer-motion';
import { useThemeStore } from '../lib/themeStore';

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className="flex h-9 items-center gap-2 rounded-full border border-border px-3
        transition-colors duration-200 hover:border-border-hover"
      style={{
        backgroundColor: 'var(--color-surface)',
        fontFamily: 'var(--font-mono)',
      }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {/* Sun / Moon icon */}
      <div className="relative h-4 w-4">
        {/* Sun */}
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: isDark ? 0 : 1, rotate: isDark ? -90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </motion.svg>
        {/* Moon */}
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: isDark ? 1 : 0, rotate: isDark ? 0 : 90 }}
          transition={{ duration: 0.2 }}
        >
          <path
            d="M13.5 8.5a5.5 5.5 0 0 1-6-6C4.5 3.5 2 6.5 2 9.5A5.5 5.5 0 0 0 8 14c2.5 0 4.5-1.5 5.5-5.5z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
          />
        </motion.svg>
      </div>
      <span className="text-[10px] tracking-[0.15em] uppercase text-text-muted">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </motion.button>
  );
}
