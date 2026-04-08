import { useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';

import { getWidgetById } from '../lib/WidgetRegistry';
import { useWidgetStore } from '../lib/widgetStore';
import SortableItem from './SortableItem';
import HiddenWidgets from './HiddenWidgets';

export default function Dashboard() {
  const widgetOrder = useWidgetStore((s) => s.widgetOrder);
  const initializeOrder = useWidgetStore((s) => s.initializeOrder);
  const reorderWidgets = useWidgetStore((s) => s.reorderWidgets);

  // Initialize on mount
  useEffect(() => {
    initializeOrder();
  }, [initializeOrder]);

  // DnD sensors – pointer for desktop, touch for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = widgetOrder.indexOf(active.id as string);
      const newIndex = widgetOrder.indexOf(over.id as string);
      reorderWidgets(arrayMove(widgetOrder, oldIndex, newIndex));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
      {/* Header */}
      <header className="mb-8">
        <h1
          className="text-2xl tracking-[0.3em] uppercase text-text-primary"
          style={{ fontFamily: 'var(--font-dotmatrix)' }}
        >
          Widget Hub
        </h1>
        <p
          className="mt-1 text-xs tracking-[0.15em] text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Dashboard
        </p>
      </header>

      {/* Widget Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
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
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

      {/* Hidden Widgets Bar */}
      <HiddenWidgets />
    </div>
  );
}
