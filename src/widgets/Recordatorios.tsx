import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import WidgetPanel from '../components/WidgetPanel';
import { Button, Icon, Segmented } from '../components/ui';
import { useWidgetStore } from '../lib/widgetStore';
import { readState, writeState } from '../lib/syncStorage';

export const title = 'Reminders';
export const defaultSize = { cols: 1, rows: 1 };

/* ============================================================
   Model
   ============================================================ */

type Priority = 'none' | 'low' | 'medium' | 'high';
type Filter = 'open' | 'all' | 'done';
type SortBy = 'manual' | 'date' | 'priority';

interface Reminder {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  priority: Priority;
  flagged: boolean;
}

interface RemindersState {
  reminders: Reminder[];
  filter: Filter;
  sortBy: SortBy;
}

const STORAGE_KEY = 'widgethub-reminders';

/** Priority is data status, so it earns colour — on the tag only, never a row. */
const PRIORITY_STYLE: Record<Priority, { tag: string; className: string }> = {
  none: { tag: '', className: 'text-ink-disabled' },
  low: { tag: 'LOW', className: 'text-success' },
  medium: { tag: 'MED', className: 'text-warning' },
  high: { tag: 'HIGH', className: 'text-accent' },
};

const PRIORITY_CYCLE: Priority[] = ['none', 'low', 'medium', 'high'];
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

const DEFAULTS: RemindersState = { reminders: [], filter: 'open', sortBy: 'manual' };

function loadState(): RemindersState {
  const saved = readState<
    (Partial<RemindersState> & { showCompleted?: boolean }) | null
  >(STORAGE_KEY, null);
  if (!saved) return DEFAULTS;
  return {
      reminders: saved.reminders ?? [],
      // The old shape stored a boolean toggle rather than a filter.
      filter: saved.filter ?? (saved.showCompleted === false ? 'open' : 'all'),
    sortBy: saved.sortBy ?? 'manual',
  };
}

/* ============================================================
   Component
   ============================================================ */

export default function Reminders() {
  const [state, setState] = useState<RemindersState>(loadState);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const hideWidget = useWidgetStore((s) => s.hideWidget);

  useEffect(() => {
    writeState(STORAGE_KEY, state);
  }, [state]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const patch = useCallback(
    (id: string, changes: Partial<Reminder>) =>
      setState((prev) => ({
        ...prev,
        reminders: prev.reminders.map((r) => (r.id === id ? { ...r, ...changes } : r)),
      })),
    [],
  );

  const add = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setState((prev) => ({
      ...prev,
      reminders: [
        {
          id: crypto.randomUUID(),
          text,
          completed: false,
          createdAt: Date.now(),
          priority: 'none',
          flagged: false,
        },
        ...prev.reminders,
      ],
    }));
    setDraft('');
  }, [draft]);

  const remove = useCallback(
    (id: string) =>
      setState((prev) => ({
        ...prev,
        reminders: prev.reminders.filter((r) => r.id !== id),
      })),
    [],
  );

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const text = editText.trim();
    if (text) patch(editingId, { text });
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, patch]);

  const openCount = state.reminders.filter((r) => !r.completed).length;
  const doneCount = state.reminders.length - openCount;

  const visible = useMemo(() => {
    const rows = state.reminders.filter((r) =>
      state.filter === 'open' ? !r.completed : state.filter === 'done' ? r.completed : true,
    );
    if (state.sortBy === 'date') return [...rows].sort((a, b) => b.createdAt - a.createdAt);
    if (state.sortBy === 'priority')
      return [...rows].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    return rows;
  }, [state.reminders, state.filter, state.sortBy]);

  return (
    <WidgetPanel
      title="Reminders"
      onHide={() => hideWidget('Recordatorios')}
      settingsContent={
        <RemindersSettings
          sortBy={state.sortBy}
          doneCount={doneCount}
          onChangeSortBy={(sortBy) => setState((prev) => ({ ...prev, sortBy }))}
          onClearCompleted={() =>
            setState((prev) => ({
              ...prev,
              reminders: prev.reminders.filter((r) => !r.completed),
            }))
          }
        />
      }
    >
      <div className="flex flex-1 flex-col">
        <p className="nd-label">Open</p>

        {/* Layer 1 — the count, not the list. */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="nd-display text-display-lg">
            {String(openCount).padStart(2, '0')}
          </span>
          <span className="nd-label">of {state.reminders.length}</span>
        </div>

        <div className="mt-6">
          <Segmented
            label="Filter"
            value={state.filter}
            options={[
              { value: 'open' as Filter, label: 'Open' },
              { value: 'all' as Filter, label: 'All' },
              { value: 'done' as Filter, label: 'Done' },
            ]}
            onChange={(filter) => setState((prev) => ({ ...prev, filter }))}
          />
        </div>

        <div className="mt-4 max-h-[280px] flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-body-sm text-ink-muted">
                {state.filter === 'done' ? 'Nothing completed yet' : 'Nothing pending'}
              </p>
              <p className="nd-caption text-ink-disabled">Add one below</p>
            </div>
          ) : (
            <ul>
              {visible.map((reminder) => (
                <ReminderRow
                  key={reminder.id}
                  reminder={reminder}
                  isEditing={editingId === reminder.id}
                  editText={editText}
                  editRef={editRef}
                  onToggle={() =>
                    patch(reminder.id, {
                      completed: !reminder.completed,
                      completedAt: reminder.completed ? undefined : Date.now(),
                    })
                  }
                  onCyclePriority={() =>
                    patch(reminder.id, {
                      priority:
                        PRIORITY_CYCLE[
                          (PRIORITY_CYCLE.indexOf(reminder.priority) + 1) %
                            PRIORITY_CYCLE.length
                        ],
                    })
                  }
                  onToggleFlag={() => patch(reminder.id, { flagged: !reminder.flagged })}
                  onDelete={() => remove(reminder.id)}
                  onStartEdit={() => {
                    setEditingId(reminder.id);
                    setEditText(reminder.text);
                  }}
                  onEditTextChange={setEditText}
                  onSaveEdit={saveEdit}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Composer — underline input, the lightest container that works. */}
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
              if (e.key === 'Escape') setDraft('');
            }}
            placeholder="NEW REMINDER"
            aria-label="New reminder"
            className="min-w-0 flex-1 border-b border-line-strong bg-transparent pb-1
              font-mono text-caption uppercase tracking-[0.06em] text-ink outline-none
              transition-colors duration-200 ease-nd
              placeholder:text-ink-disabled focus:border-ink-display"
          />
          <Button size="sm" onClick={add} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      </div>
    </WidgetPanel>
  );
}

/* ============================================================
   Row
   ============================================================ */

function ReminderRow({
  reminder,
  isEditing,
  editText,
  editRef,
  onToggle,
  onCyclePriority,
  onToggleFlag,
  onDelete,
  onStartEdit,
  onEditTextChange,
  onSaveEdit,
}: {
  reminder: Reminder;
  isEditing: boolean;
  editText: string;
  editRef: RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onCyclePriority: () => void;
  onToggleFlag: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onEditTextChange: (text: string) => void;
  onSaveEdit: () => void;
}) {
  const priority = PRIORITY_STYLE[reminder.priority];

  return (
    <li className="group flex items-start gap-3 border-b border-line py-3 last:border-b-0">
      <button
        onClick={onToggle}
        aria-pressed={reminder.completed}
        aria-label={reminder.completed ? 'Mark as open' : 'Mark as done'}
        className={`mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-tech
          border transition-colors duration-200 ease-nd
          ${
            reminder.completed
              ? 'border-ink-display bg-ink-display text-canvas'
              : 'border-line-strong text-transparent hover:border-ink-display'
          }`}
      >
        <Icon name="check" size={12} />
      </button>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            ref={editRef}
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') onSaveEdit();
            }}
            onBlur={onSaveEdit}
            aria-label="Edit reminder"
            className="w-full border-b border-ink-display bg-transparent pb-0.5
              text-body-sm text-ink outline-none"
          />
        ) : (
          <button
            onClick={onStartEdit}
            className={`block w-full text-left text-body-sm leading-snug transition-colors duration-200 ease-nd
              ${reminder.completed ? 'text-ink-disabled line-through' : 'text-ink'}`}
          >
            {reminder.text}
          </button>
        )}

        {(reminder.priority !== 'none' || reminder.flagged) && !isEditing && (
          <div className="mt-1.5 flex items-center gap-2">
            {reminder.priority !== 'none' && (
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.08em] ${priority.className}`}
              >
                {priority.tag}
              </span>
            )}
            {reminder.flagged && (
              <Icon name="flag" size={11} className="text-warning" />
            )}
          </div>
        )}
      </div>

      {/* Row actions: always reachable by keyboard, revealed on hover by mouse. */}
      <div
        className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-200 ease-nd
          group-hover:opacity-100 focus-within:opacity-100"
      >
        <RowAction
          label={`Priority: ${reminder.priority}`}
          onClick={onCyclePriority}
          className={priority.className}
        >
          <Icon name="alert" size={14} />
        </RowAction>
        <RowAction
          label={reminder.flagged ? 'Unflag' : 'Flag'}
          onClick={onToggleFlag}
          className={reminder.flagged ? 'text-warning' : 'text-ink-disabled'}
        >
          <Icon name="flag" size={14} />
        </RowAction>
        <RowAction label="Delete" onClick={onDelete} className="text-ink-disabled hover:text-accent">
          <Icon name="trash" size={14} />
        </RowAction>
      </div>
    </li>
  );
}

function RowAction({
  label,
  onClick,
  className = '',
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-tech
        transition-colors duration-200 ease-nd hover:text-ink-display ${className}`}
    >
      {children}
    </button>
  );
}

/* ============================================================
   Settings
   ============================================================ */

function RemindersSettings({
  sortBy,
  doneCount,
  onChangeSortBy,
  onClearCompleted,
}: {
  sortBy: SortBy;
  doneCount: number;
  onChangeSortBy: (sortBy: SortBy) => void;
  onClearCompleted: () => void;
}) {
  return (
    <>
      <div>
        <p className="nd-label mb-2">Sort by</p>
        <Segmented
          label="Sort by"
          value={sortBy}
          options={[
            { value: 'manual' as SortBy, label: 'Manual' },
            { value: 'date' as SortBy, label: 'Date' },
            { value: 'priority' as SortBy, label: 'Prio' },
          ]}
          onChange={onChangeSortBy}
        />
      </div>

      <div className="border-t border-line pt-5">
        <p className="nd-label mb-3">Row actions</p>
        <p className="text-body-sm leading-relaxed text-ink-muted">
          Hover a row to cycle priority, flag it or delete it. Click its text to edit.
        </p>
      </div>

      {doneCount > 0 && (
        <div className="border-t border-line pt-5">
          <Button block size="sm" variant="destructive" onClick={onClearCompleted}>
            Clear {doneCount} completed
          </Button>
        </div>
      )}
    </>
  );
}
