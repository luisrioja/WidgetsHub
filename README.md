# Widget Hub

A modular dashboard of desk instruments — a glute-activation timer, a Madrid clock and a
reminders list — built as a Nothing-inspired instrument panel.

React 19 · TypeScript · Vite · Tailwind v4 · Zustand · dnd-kit

---

## Design system

Monochrome, typographically driven, no shadows and no gradients. Dark mode is the authored
default (OLED black, white data); light mode is a printed-technical-manual counterpart, built
to the same rigour.

**Fonts** (loaded from Google Fonts in `index.html`):

| Role | Family |
|------|--------|
| Display | `Doto` — variable dot-matrix, 36px and up only |
| Body / UI | `Space Grotesk` |
| Data / labels | `Space Mono`, ALL CAPS, `0.08em` tracking |

**Tokens** live in `src/index.css` under `@theme`, so every value is a Tailwind utility:
`bg-canvas`, `bg-surface`, `border-line`, `text-ink-muted`, `text-ink-display`, `text-accent`.
Light mode redefines the same custom properties under `:root:not(.dark)`.

Red `#D71921` is an interrupt, never decoration — at most one accent moment per screen.
Status colours (`success`, `warning`, `accent`) are applied to the **value**, never to a
label or a row background.

> **Cascade rule:** the base reset in `src/index.css` must stay inside `@layer base`.
> Unlayered CSS outranks every layered rule, so a top-level `* { margin: 0; padding: 0 }`
> silently kills every Tailwind spacing utility on the page.

Shared primitives are in `src/components/ui/`: `Button`, `IconButton`, `Icon`, `Toggle`,
`Segmented`, `SegmentedBar`, `Slider`.

---

## Architecture

```
src/
  App.tsx              starts the glute engine, arms audio + notification unlocks
  components/
    Dashboard.tsx      page shell, drag-and-drop grid
    WidgetPanel.tsx    card chrome; settings replace the body in place
    SortableItem.tsx   dnd-kit wrapper, passes drag listeners down via context
    ui/                design-system primitives
  lib/
    gluteStore.ts      glute timer state (pure) + selectors + stats
    gluteEngine.ts     the tick loop, sound, notifications, cross-tab sync
    audio.ts           single unlocked AudioContext, alarm patterns
    notifications.ts   Web Notifications, permission on gesture
    useNow.ts          render-only clock
    widgetStore.ts     widget order + hidden widgets
    themeStore.ts      dark/light
    WidgetRegistry.ts  auto-discovers src/widgets/*.tsx
  widgets/             one file per widget
```

### Adding a widget

Drop a file in `src/widgets/`. `WidgetRegistry` globs the directory, so nothing needs
registering:

```tsx
export const title = 'My Widget';
export const defaultSize = { cols: 1, rows: 1 };

export default function MyWidget() {
  return <WidgetPanel title="My Widget" onHide={...}>…</WidgetPanel>;
}
```

The `title` / `defaultSize` exports are part of that contract, which is why
`react-refresh/only-export-components` is relaxed for `src/widgets/*.tsx`.

---

## Glute activation timer

The timer is anchored to an absolute `deadline` timestamp rather than a decrementing
counter. A countdown that subtracts "one second" per tick loses whatever fraction of a
second the timer actually slept for, so it runs progressively slow; deriving the remaining
time from `deadline - now` cannot drift however irregularly the loop runs.

It runs from `startGluteEngine()` at App level, so it keeps counting while its widget is
hidden or scrolled out of view.

**Phases**

| Phase | Behaviour |
|-------|-----------|
| `REST` | Counting down to the next activation. Pause / restart / activate now. |
| `DUE` | Rest elapsed. **Waits indefinitely** — never auto-advances, never auto-skips. Alarms on entry, then repeats a reminder on the configured cadence until you act. Start / snooze / skip. |
| `ACTIVE` | Activation running, with an audible countdown over the final three seconds. Completing it logs a session; ending early logs it as cut short. |

Sessions are logged to `history` (capped at 200), which drives the today / streak / 7-day
readouts.

**Cross-tab:** every tab runs the engine. Transitions are idempotent and guarded by
`lastResolvedDeadline`, so reaching the same deadline in two tabs logs one session, not two.
A `storage` listener rehydrates siblings, and a localStorage claim stops the alarm stacking.

**Audio:** browsers refuse to start an `AudioContext` outside a user gesture. `initAudio()`
arms one-shot listeners that create and resume a single context on the first interaction,
reused for every later alarm. Notification permission is requested the same way — on the
first gesture, or when you switch the notifications toggle on.

---

## Development

```bash
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run lint
```

Docker: `docker compose up --build` — multi-stage build served by Nginx.
