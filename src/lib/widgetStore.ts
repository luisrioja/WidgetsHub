import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { availableWidgets } from './WidgetRegistry';

interface WidgetStoreState {
  /** Ordered array of visible widget IDs */
  widgetOrder: string[];
  /** Set of hidden widget IDs */
  hiddenWidgets: string[];
  /** Initialize order from available widgets (only on first run) */
  initializeOrder: () => void;
  /** Reorder visible widgets after drag-and-drop */
  reorderWidgets: (newOrder: string[]) => void;
  /** Hide a widget */
  hideWidget: (id: string) => void;
  /** Show a hidden widget (append to end) */
  showWidget: (id: string) => void;
  /** Check if a widget is hidden */
  isHidden: (id: string) => boolean;
}

export const useWidgetStore = create<WidgetStoreState>()(
  persist(
    (set, get) => ({
      widgetOrder: [],
      hiddenWidgets: [],

      initializeOrder: () => {
        const { widgetOrder } = get();
        if (widgetOrder.length === 0) {
          set({ widgetOrder: availableWidgets.map((w) => w.id) });
        } else {
          // Add any new widgets that aren't already tracked
          const allIds = availableWidgets.map((w) => w.id);
          const { hiddenWidgets } = get();
          const known = new Set([...widgetOrder, ...hiddenWidgets]);
          const newWidgets = allIds.filter((id) => !known.has(id));
          if (newWidgets.length > 0) {
            set({ widgetOrder: [...widgetOrder, ...newWidgets] });
          }
        }
      },

      reorderWidgets: (newOrder) => {
        set({ widgetOrder: newOrder });
      },

      hideWidget: (id) => {
        set((state) => ({
          widgetOrder: state.widgetOrder.filter((wid) => wid !== id),
          hiddenWidgets: [...state.hiddenWidgets, id],
        }));
      },

      showWidget: (id) => {
        set((state) => ({
          widgetOrder: [...state.widgetOrder, id],
          hiddenWidgets: state.hiddenWidgets.filter((wid) => wid !== id),
        }));
      },

      isHidden: (id) => {
        return get().hiddenWidgets.includes(id);
      },
    }),
    {
      name: 'antigravity-widgets',
      version: 1,
    }
  )
);
