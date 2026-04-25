import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import WidgetPanel from '../components/WidgetPanel';
import { useWidgetStore } from '../lib/widgetStore';

export const title = 'Reminders';
export const defaultSize = { cols: 1, rows: 1 };

/* ============================================
   Types & Constants
   ============================================ */

interface Reminder {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  priority: 'none' | 'low' | 'medium' | 'high';
  flagged: boolean;
}

interface RemindersState {
  reminders: Reminder[];
  showCompleted: boolean;
  sortBy: 'manual' | 'date' | 'priority';
}

const STORAGE_KEY = 'widgethub-reminders';

const PRIORITY_COLORS: Record<string, string> = {
  none: 'var(--color-text-muted)',
  low: '#34C759',
  medium: '#FF9500',
  high: '#FF3B30',
};

/* ============================================
   Persistence
   ============================================ */

function loadReminders(): RemindersState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('no saved state');
    return JSON.parse(raw);
  } catch {
    return { reminders: [], showCompleted: true, sortBy: 'manual' };
  }
}

function saveReminders(state: RemindersState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ============================================
   Component
   ============================================ */

export default function Reminders() {
  const [state, setState] = useState<RemindersState>(loadReminders);
  const [newText, setNewText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const hideWidget = useWidgetStore((s) => s.hideWidget);

  // Persist on change
  useEffect(() => {
    saveReminders(state);
  }, [state]);

  // Focus input when adding mode activates
  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  // Focus edit input
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const addReminder = useCallback(() => {
    const text = newText.trim();
    if (!text) return;
    const reminder: Reminder = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      createdAt: Date.now(),
      priority: 'none',
      flagged: false,
    };
    setState((prev) => ({
      ...prev,
      reminders: [reminder, ...prev.reminders],
    }));
    setNewText('');
  }, [newText]);

  const toggleComplete = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === id
          ? { ...r, completed: !r.completed, completedAt: !r.completed ? Date.now() : undefined }
          : r
      ),
    }));
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => r.id !== id),
    }));
  }, []);

  const toggleFlag = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === id ? { ...r, flagged: !r.flagged } : r
      ),
    }));
  }, []);

  const setPriority = useCallback((id: string, priority: Reminder['priority']) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === id ? { ...r, priority } : r
      ),
    }));
  }, []);

  const startEditing = useCallback((r: Reminder) => {
    setEditingId(r.id);
    setEditText(r.text);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const text = editText.trim();
    if (text) {
      setState((prev) => ({
        ...prev,
        reminders: prev.reminders.map((r) =>
          r.id === editingId ? { ...r, text } : r
        ),
      }));
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText]);

  const clearCompleted = useCallback(() => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => !r.completed),
    }));
  }, []);

  // Sort reminders
  const sortedReminders = [...state.reminders].sort((a, b) => {
    if (state.sortBy === 'date') return b.createdAt - a.createdAt;
    if (state.sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      return order[a.priority] - order[b.priority];
    }
    return 0; // manual = insertion order
  });

  const activeReminders = sortedReminders.filter((r) => !r.completed);
  const completedReminders = sortedReminders.filter((r) => r.completed);
  const completedCount = completedReminders.length;

  return (
    <WidgetPanel
      title="Reminders"
      onHide={() => hideWidget('Recordatorios')}
      settingsContent={
        <RemindersSettings
          showCompleted={state.showCompleted}
          sortBy={state.sortBy}
          completedCount={completedCount}
          onToggleShowCompleted={() =>
            setState((prev) => ({ ...prev, showCompleted: !prev.showCompleted }))
          }
          onChangeSortBy={(sortBy) => setState((prev) => ({ ...prev, sortBy }))}
          onClearCompleted={clearCompleted}
        />
      }
    >
      <div className="flex flex-col gap-1" style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {/* Active reminders list */}
        <AnimatePresence initial={false}>
          {activeReminders.map((reminder) => (
            <ReminderItem
              key={reminder.id}
              reminder={reminder}
              isEditing={editingId === reminder.id}
              editText={editText}
              editInputRef={editInputRef}
              onToggleComplete={() => toggleComplete(reminder.id)}
              onDelete={() => deleteReminder(reminder.id)}
              onToggleFlag={() => toggleFlag(reminder.id)}
              onSetPriority={(p) => setPriority(reminder.id, p)}
              onStartEditing={() => startEditing(reminder)}
              onEditTextChange={setEditText}
              onSaveEdit={saveEdit}
            />
          ))}
        </AnimatePresence>

        {/* Add new reminder */}
        <AnimatePresence>
          {isAdding ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2.5 py-2"
            >
              {/* Empty circle */}
              <div
                className="shrink-0 h-[18px] w-[18px] rounded-full border-[1.5px]"
                style={{ borderColor: 'var(--color-text-muted)' }}
              />
              <input
                ref={inputRef}
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addReminder();
                    // Keep adding mode open for rapid entry
                  }
                  if (e.key === 'Escape') {
                    setIsAdding(false);
                    setNewText('');
                  }
                }}
                onBlur={() => {
                  if (newText.trim()) addReminder();
                  setIsAdding(false);
                }}
                placeholder="New Reminder"
                className="flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted/50"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </motion.div>
          ) : (
            <motion.button
              key="add-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2.5 py-2.5 text-text-muted hover:text-text-secondary
                transition-colors duration-150 group"
            >
              <div className="shrink-0 flex items-center justify-center h-[18px] w-[18px] rounded-full
                border-[1.5px] border-dashed border-text-muted/40 group-hover:border-text-secondary/60
                transition-colors duration-150">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M4 0.5v7M0.5 4h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <span
                className="text-[12px] tracking-[0.1em] uppercase"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                New Reminder
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Completed section */}
        {completedCount > 0 && state.showCompleted && (
          <div className="mt-2">
            <div className="flex items-center gap-2 py-1.5 border-t border-border/50">
              <span
                className="text-[10px] tracking-[0.15em] uppercase text-text-muted"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Completed ({completedCount})
              </span>
            </div>
            <AnimatePresence initial={false}>
              {completedReminders.map((reminder) => (
                <ReminderItem
                  key={reminder.id}
                  reminder={reminder}
                  isEditing={editingId === reminder.id}
                  editText={editText}
                  editInputRef={editInputRef}
                  onToggleComplete={() => toggleComplete(reminder.id)}
                  onDelete={() => deleteReminder(reminder.id)}
                  onToggleFlag={() => toggleFlag(reminder.id)}
                  onSetPriority={(p) => setPriority(reminder.id, p)}
                  onStartEditing={() => startEditing(reminder)}
                  onEditTextChange={setEditText}
                  onSaveEdit={saveEdit}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {state.reminders.length === 0 && !isAdding && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-text-muted/30">
              <rect x="4" y="4" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 16l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[11px] text-text-muted/50" style={{ fontFamily: 'var(--font-mono)' }}>
              No reminders yet
            </p>
          </div>
        )}
      </div>
    </WidgetPanel>
  );
}

/* ============================================
   Reminder Item
   ============================================ */

function ReminderItem({
  reminder,
  isEditing,
  editText,
  editInputRef,
  onToggleComplete,
  onDelete,
  onToggleFlag,
  onSetPriority,
  onStartEditing,
  onEditTextChange,
  onSaveEdit,
}: {
  reminder: Reminder;
  isEditing: boolean;
  editText: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleComplete: () => void;
  onDelete: () => void;
  onToggleFlag: () => void;
  onSetPriority: (p: Reminder['priority']) => void;
  onStartEditing: () => void;
  onEditTextChange: (text: string) => void;
  onSaveEdit: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Close actions on outside click
  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [showActions]);

  const borderColor = PRIORITY_COLORS[reminder.priority];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative flex items-start gap-2.5 py-2 border-b border-border/20 last:border-b-0"
    >
      {/* Checkbox circle */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={onToggleComplete}
        className="shrink-0 mt-[1px] flex items-center justify-center h-[18px] w-[18px] rounded-full
          border-[1.5px] transition-all duration-200"
        style={{
          borderColor: reminder.completed ? borderColor : borderColor,
          backgroundColor: reminder.completed ? borderColor : 'transparent',
        }}
      >
        {/* Checkmark */}
        <AnimatePresence>
          {reminder.completed && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              width="10" height="8" viewBox="0 0 10 8" fill="none"
            >
              <path d="M1 3.5L3.5 6L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onSaveEdit();
            }}
            onBlur={onSaveEdit}
            className="w-full bg-transparent text-[13px] text-text-primary outline-none border-b border-text-muted/30 pb-0.5"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        ) : (
          <p
            className={`text-[13px] leading-snug cursor-pointer transition-all duration-300 ${
              reminder.completed
                ? 'line-through text-text-muted/50'
                : 'text-text-primary'
            }`}
            style={{ fontFamily: 'var(--font-body)' }}
            onClick={onStartEditing}
          >
            {reminder.text}
          </p>
        )}

        {/* Meta line: priority badge + flag */}
        {(reminder.priority !== 'none' || reminder.flagged) && !isEditing && (
          <div className="flex items-center gap-1.5 mt-1">
            {reminder.priority !== 'none' && (
              <span
                className="text-[9px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded"
                style={{
                  color: PRIORITY_COLORS[reminder.priority],
                  backgroundColor: `${PRIORITY_COLORS[reminder.priority]}15`,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {reminder.priority === 'high' ? '!!!' : reminder.priority === 'medium' ? '!!' : '!'}
              </span>
            )}
            {reminder.flagged && (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="#FF9500">
                <path d="M1 1v10M1 1h7l-2 2.5L8 6H1" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (on hover or touch) */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {/* Context menu button */}
        <button
          ref={menuButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!showActions && menuButtonRef.current) {
              const rect = menuButtonRef.current.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, left: rect.right - 160 });
            }
            setShowActions(!showActions);
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-overlay-hover"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-overlay-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-muted">
            <circle cx="2" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="10" cy="6" r="1" fill="currentColor" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded-full transition-colors"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,59,48,0.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
          title="Delete"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-accent-alarm/60 hover:text-accent-alarm">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Context menu dropdown — rendered via portal to avoid clipping */}
      {showActions && menuPos && createPortal(
        <AnimatePresence>
          <motion.div
            ref={actionsRef}
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ duration: 0.12 }}
            className="fixed z-[9999] min-w-[160px] rounded-[12px] border border-border
              bg-surface py-1.5 shadow-xl"
            style={{ top: menuPos.top, left: Math.max(8, menuPos.left) }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Priority options */}
            <ContextMenuLabel>Priority</ContextMenuLabel>
            {(['none', 'low', 'medium', 'high'] as const).map((p) => (
              <ContextMenuItem
                key={p}
                label={p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}
                active={reminder.priority === p}
                color={PRIORITY_COLORS[p]}
                onClick={() => { onSetPriority(p); setShowActions(false); }}
              />
            ))}

            <div className="my-1.5 border-t border-border/50" />

            {/* Flag */}
            <ContextMenuItem
              label={reminder.flagged ? 'Unflag' : 'Flag'}
              icon="flag"
              onClick={() => { onToggleFlag(); setShowActions(false); }}
            />

            {/* Delete */}
            <ContextMenuItem
              label="Delete"
              icon="delete"
              destructive
              onClick={() => { onDelete(); setShowActions(false); }}
            />
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

/* ============================================
   Context Menu Components
   ============================================ */

function ContextMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-1 text-[9px] tracking-[0.15em] uppercase text-text-muted"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {children}
    </div>
  );
}

function ContextMenuItem({
  label,
  active,
  color,
  icon,
  destructive,
  onClick,
}: {
  label: string;
  active?: boolean;
  color?: string;
  icon?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors
        ${destructive ? 'text-accent-alarm hover:bg-accent-alarm/10' : 'text-text-primary hover:bg-overlay-hover'}`}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = destructive
          ? 'rgba(255,59,48,0.1)'
          : 'var(--color-overlay-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {color && (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {icon === 'flag' && (
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="text-[#FF9500]">
          <path d="M1 1v10M1 1h7l-2 2.5L8 6H1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
      {icon === 'delete' && (
        <svg width="10" height="11" viewBox="0 0 10 11" fill="none" className="text-accent-alarm">
          <path d="M1 3h8M3.5 3V2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M2 3l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L8 3"
            stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )}
      <span className="flex-1">{label}</span>
      {active && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 3.5L3.5 6L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ============================================
   Settings Panel
   ============================================ */

function RemindersSettings({
  showCompleted,
  sortBy,
  completedCount,
  onToggleShowCompleted,
  onChangeSortBy,
  onClearCompleted,
}: {
  showCompleted: boolean;
  sortBy: string;
  completedCount: number;
  onToggleShowCompleted: () => void;
  onChangeSortBy: (sortBy: RemindersState['sortBy']) => void;
  onClearCompleted: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Show Completed toggle */}
      <div className="flex items-center justify-between">
        <label
          className="text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Show Completed
        </label>
        <button
          onClick={onToggleShowCompleted}
          className={`relative h-6 w-11 rounded-full transition-colors duration-200
            ${showCompleted ? 'bg-text-primary' : ''}`}
          style={{ backgroundColor: showCompleted ? undefined : 'var(--color-slider-track)' }}
        >
          <motion.div
            className="absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm"
            animate={{ left: showCompleted ? '22px' : '2px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Sort by */}
      <div>
        <label
          className="mb-3 block text-[10px] tracking-[0.15em] uppercase text-text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Sort By
        </label>
        <div className="flex gap-2">
          {([
            { key: 'manual', label: 'Manual' },
            { key: 'date', label: 'Date' },
            { key: 'priority', label: 'Priority' },
          ] as const).map((opt) => (
            <motion.button
              key={opt.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChangeSortBy(opt.key)}
              className={`rounded-[10px] border px-3.5 py-2 text-[11px] tracking-wider transition-colors
                ${sortBy === opt.key
                  ? 'border-text-primary bg-text-primary text-surface'
                  : 'border-border text-text-muted hover:border-border-hover hover:text-text-secondary'
                }`}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Clear completed */}
      {completedCount > 0 && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onClearCompleted}
          className="w-full rounded-[10px] border border-accent-alarm/30 bg-accent-alarm/10
            px-4 py-2.5 text-[11px] tracking-[0.1em] uppercase text-accent-alarm
            transition-colors hover:bg-accent-alarm/20"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Clear {completedCount} Completed
        </motion.button>
      )}
    </div>
  );
}
