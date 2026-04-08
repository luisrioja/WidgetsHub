import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';

interface SortableItemProps {
  id: string;
  children: ReactNode;
}

export default function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    position: 'relative' as const,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`touch-none ${isDragging ? 'opacity-80 scale-[1.03]' : ''}`}
      layoutId={id}
    >
      {/* Drag handle — left side only, leaves right buttons clickable */}
      <div
        className="absolute top-0 left-0 h-12 z-20 cursor-grab active:cursor-grabbing"
        style={{ width: 'calc(100% - 100px)' }}
        {...attributes}
        {...listeners}
      />
      {children}
    </motion.div>
  );
}
