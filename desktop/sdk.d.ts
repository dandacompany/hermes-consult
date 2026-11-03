declare module "@hermes/plugin-sdk" {
  import type { ComponentType, ReactNode } from "react";
  interface Atom<T> {
    get(): T;
    subscribe(fn: () => void): () => void;
  }
  export interface PluginContext {
    rest<T>(
      path: string,
      options?: { method?: string; body?: unknown; timeoutMs?: number },
    ): Promise<T>;
    registerSettingsPage(page: {
      id: string;
      title: string;
      icon?: string;
      render: () => ReactNode;
    }): () => void;
    onDispose(fn: () => void): void;
    i18n: {
      register(bundles: Record<string, Record<string, string>>): () => void;
      t(key: string, ...args: unknown[]): string;
      onLocaleChange(fn: () => void): () => void;
    };
  }
  export const host: {
    state: { profile: Atom<string>; connectionId: Atom<string | null> };
  };
  export function useI18n(): { locale: string };
  export function usePluginI18n(
    id: string,
  ): (key: string, ...args: unknown[]) => string;
  export const Button: ComponentType<any>,
    Input: ComponentType<any>,
    Textarea: ComponentType<any>,
    ListRow: ComponentType<any>,
    ToggleRow: ComponentType<any>,
    Select: ComponentType<any>,
    SelectTrigger: ComponentType<any>,
    SelectValue: ComponentType<any>,
    SelectContent: ComponentType<any>,
    SelectItem: ComponentType<any>,
    SegmentedControl: ComponentType<any>,
    Badge: ComponentType<any>;
}
