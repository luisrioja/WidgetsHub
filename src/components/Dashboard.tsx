import { useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';

import { getWidgetById } from '../lib/WidgetRegistry';
import { useWidgetStore } from '../lib/widgetStore';
import { useNow } from '../lib/useNow';
import SortableItem from './SortableItem';
import HiddenWidgets from './HiddenWidgets';
import ThemeToggle from './ThemeToggle';
import SearchBar from './SearchBar';
import AccountMenu from './AccountMenu';

export default function Dashboard({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const widgetOrder = useWidgetStore((s) => s.widgetOrder);
  const hiddenWidgets = useWidgetStore((s) => s.hiddenWidgets);
  const initializeOrder = useWidgetStore((s) => s.initializeOrder);
  const reorderWidgets = useWidgetStore((s) => s.reorderWidgets);
  const now = useNow(1000);

  useEffect(() => {
    initializeOrder();
  }, [initializeOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = widgetOrder.indexOf(active.id as string);
    const to = widgetOrder.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    reorderWidgets(arrayMove(widgetOrder, from, to));
  };

  return (
    <div className="dot-grid-subtle min-h-dvh">
      <div className="mx-auto max-w-[1440px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        {/* Layer 1 — the one dot-matrix moment on the page. */}
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="nd-display text-display-md sm:text-display-lg">
              WIDGET HUB
            </h1>
            <p className="nd-label mt-3">Modular instrument panel</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <span className="nd-data hidden text-body-sm text-ink-muted lg:inline">
              {new Intl.DateTimeFormat('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }).format(now)}
            </span>
            <ThemeToggle />
            <AccountMenu onOpenAdmin={onOpenAdmin} />
          </div>
        </header>

        {/* Fixed above the grid, and never part of it: the widgets below can be
            dragged into any order, this stays where it is. */}
        <SearchBar />

        {/* Layer 3 — system metadata, pushed to a hairline rule. */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3">
          <span className="nd-label">
            {String(widgetOrder.length).padStart(2, '0')} Active
          </span>
          <span className="nd-label text-ink-disabled">
            {String(hiddenWidgets.length).padStart(2, '0')} Hidden
          </span>
          <span className="nd-label ml-auto text-ink-disabled">
            Drag a header to reorder
          </span>
        </div>

        {/* Layer 2 — the content itself. */}
        <main className="mt-8">
          {widgetOrder.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border border-line py-24 text-center">
              <p className="text-subheading text-ink-muted">Panel empty</p>
              <p className="nd-caption text-ink-disabled">
                Restore a module from below
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {widgetOrder.map((id) => {
                    const widget = getWidgetById(id);
                    if (!widget) return null;
                    const { Component } = widget;
                    return (
                      <SortableItem key={id} id={id}>
                        <Component />
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </main>

        <HiddenWidgets />
      </div>
    </div>
  );
}
