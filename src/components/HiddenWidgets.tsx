import { getWidgetById } from '../lib/WidgetRegistry';
import { useWidgetStore } from '../lib/widgetStore';
import { Icon } from './ui';

/** Hidden modules as outline chips — no fill, restore on click. */
export default function HiddenWidgets() {
  const hiddenWidgets = useWidgetStore((s) => s.hiddenWidgets);
  const showWidget = useWidgetStore((s) => s.showWidget);

  if (hiddenWidgets.length === 0) return null;

  return (
    <section className="mt-12 border-t border-line pt-4">
      <h3 className="nd-label">Hidden modules</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {hiddenWidgets.map((id) => {
          const widget = getWidgetById(id);
          if (!widget) return null;
          return (
            <button
              key={id}
              onClick={() => showWidget(id)}
              className="flex items-center gap-2 rounded-pill border border-line-strong px-4 py-2
                font-mono text-caption uppercase tracking-[0.06em] text-ink-muted
                transition-colors duration-200 ease-nd
                hover:border-ink-display hover:text-ink-display"
            >
              <Icon name="plus" size={12} />
              {widget.title}
            </button>
          );
        })}
      </div>
    </section>
  );
}
