import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { syncStorage } from './syncStorage';

export type SearchEngine = 'duckduckgo' | 'google';

interface EngineSpec {
  /** Full name, used in the field placeholder. */
  name: string;
  /** Short name for the selector, which sits beside the field. */
  short: string;
  buildUrl: (query: string) => string;
}

const ENGINES: Record<SearchEngine, EngineSpec> = {
  duckduckgo: {
    name: 'DuckDuckGo',
    short: 'DuckDuckGo',
    buildUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  },
  google: {
    name: 'Google',
    short: 'Google',
    buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
};

export const engineSpec = (engine: SearchEngine): EngineSpec => ENGINES[engine];

/** Nothing is submitted to a server here: the query only ever becomes a URL. */
export const searchUrl = (engine: SearchEngine, query: string): string =>
  ENGINES[engine].buildUrl(query);

export const ENGINE_OPTIONS: readonly { value: SearchEngine; label: string }[] = (
  Object.keys(ENGINES) as SearchEngine[]
).map((value) => ({ value, label: ENGINES[value].short }));

interface SearchState {
  engine: SearchEngine;
  setEngine: (engine: SearchEngine) => void;
}

/** DuckDuckGo is the default: it is the one that does not profile the search. */
export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      engine: 'duckduckgo',
      setEngine: (engine) => set({ engine }),
    }),
    {
      name: 'widgethub-search',
      version: 1,
      storage: createJSONStorage(() => syncStorage),
    },
  ),
);
