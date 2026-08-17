import { createContext, useContext, type HTMLAttributes } from 'react';

/**
 * Lets `SortableItem` hand its drag listeners to the panel header instead of
 * covering the card with an invisible overlay sized by a magic number.
 */
export const DragHandleContext =
  createContext<HTMLAttributes<HTMLElement> | null>(null);

export function useDragHandle(): HTMLAttributes<HTMLElement> {
  return useContext(DragHandleContext) ?? {};
}
