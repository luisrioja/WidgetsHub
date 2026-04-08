import type { ComponentType } from 'react';

export interface WidgetDefinition {
  id: string;
  Component: ComponentType;
  title: string;
  defaultSize?: { cols: number; rows: number };
}

const widgetModules = import.meta.glob('../widgets/*.tsx', { eager: true });

export const availableWidgets: WidgetDefinition[] = Object.entries(widgetModules).map(
  ([path, module]) => {
    const mod = module as Record<string, unknown>;
    const name = path.replace('../widgets/', '').replace('.tsx', '');
    return {
      id: name,
      Component: mod.default as ComponentType,
      title: (mod.title as string) || name,
      defaultSize: (mod.defaultSize as { cols: number; rows: number }) || { cols: 1, rows: 1 },
    };
  }
);

export function getWidgetById(id: string): WidgetDefinition | undefined {
  return availableWidgets.find((w) => w.id === id);
}
