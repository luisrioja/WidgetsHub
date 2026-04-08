import { motion, AnimatePresence } from 'framer-motion';
import { getWidgetById } from '../lib/WidgetRegistry';
import { useWidgetStore } from '../lib/widgetStore';

export default function HiddenWidgets() {
  const hiddenWidgets = useWidgetStore((s) => s.hiddenWidgets);
  const showWidget = useWidgetStore((s) => s.showWidget);

  if (hiddenWidgets.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-8 border-t border-border pt-6"
    >
      <h3
        className="mb-4 text-[11px] font-medium tracking-[0.25em] uppercase text-text-muted"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Hidden Widgets
      </h3>
      <div className="flex flex-wrap gap-3">
        <AnimatePresence mode="popLayout">
          {hiddenWidgets.map((id) => {
            const widget = getWidgetById(id);
            if (!widget) return null;

            return (
              <motion.button
                key={id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => showWidget(id)}
                className="flex items-center gap-2 rounded-[12px] border border-border
                  bg-surface px-4 py-2.5 text-sm text-text-secondary shadow-sm
                  transition-colors duration-200 hover:border-border-hover
                  hover:bg-surface-elevated hover:text-text-primary"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="text-text-muted"
                >
                  <path
                    d="M7 1v12M1 7h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                {widget.title}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
