import { useEffect, useRef, useState } from 'react';
import { Icon, Segmented } from './ui';
import {
  ENGINE_OPTIONS,
  engineSpec,
  searchUrl,
  useSearchStore,
  type SearchEngine,
} from '../lib/searchStore';

/**
 * Web search, fixed above the widget grid.
 *
 * Deliberately outside the DndContext: the widgets below are reorderable, this
 * is not. It is the one element of the page whose position can be relied upon,
 * which is what makes the page usable as a browser's new-tab replacement.
 *
 * There is no search backend. The query is turned into the chosen engine's URL
 * and the browser navigates there, so nothing is typed here ever reaches this
 * app's server.
 */
export default function SearchBar() {
  const engine = useSearchStore((s) => s.engine);
  const setEngine = useSearchStore((s) => s.setEngine);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // A new tab should be ready to type into. Only where there is a real pointer,
  // though: on a phone an autofocus throws up the on-screen keyboard and hides
  // the widgets the page exists to show.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  // "/" is the web's conventional focus-the-search key.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (typing) return;

      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (newTab: boolean) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const url = searchUrl(engine, trimmed);
    if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.assign(url);
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      {/* `flex-1` is deliberately sm-only. The row stacks on narrow screens, and
          a flex-1 child of a column takes its height from flex layout rather
          than from `h-12`, which collapses the field to its content. */}
      <div
        className="flex h-12 w-full min-w-0 items-center overflow-hidden rounded-control
          border border-line-strong transition-colors duration-200 ease-nd
          focus-within:border-ink-display sm:flex-1"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
            // Ctrl/⌘+Enter keeps the dashboard where it is and opens the
            // results beside it.
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit(true);
            }
          }}
          placeholder={`SEARCH WITH ${engineSpec(engine).name.toUpperCase()}`}
          aria-label={`Search the web with ${engineSpec(engine).name}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 self-stretch bg-transparent px-4 font-mono text-body-sm
            text-ink outline-none placeholder:tracking-[0.06em]
            placeholder:text-ink-disabled"
        />

        <button
          type="submit"
          aria-label="Search"
          title="Search"
          className="flex h-full w-12 shrink-0 items-center justify-center border-l
            border-line-strong text-ink-muted transition-colors duration-200 ease-nd
            hover:text-ink-display"
        >
          <Icon name="search" />
        </button>
      </div>

      <Segmented<SearchEngine>
        value={engine}
        options={ENGINE_OPTIONS}
        onChange={setEngine}
        label="Search engine"
        className="h-12 shrink-0"
      />
    </form>
  );
}
