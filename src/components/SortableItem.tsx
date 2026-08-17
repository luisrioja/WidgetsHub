import { useMemo, type HTMLAttributes, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragHandleContext } from './DragHandleContext';

interface SortableItemProps {
  id: string;
  children: ReactNode;
}

export default function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const handleProps = useMemo(
    () => ({ ...attributes, ...(listeners ?? {}) }) as HTMLAttributes<HTMLElement>,
    [attributes, listeners],
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
      }}
      className={`relative ${isDragging ? 'opacity-60' : ''}`}
    >
      <DragHandleContext.Provider value={handleProps}>
        {children}
      </DragHandleContext.Provider>
    </div>
  );
}
