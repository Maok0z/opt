import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { Choice } from '../domain/types';
import { useOpt } from '../state/OptContext';

interface ChoiceRowProps {
  choice: Choice;
  readOnly?: boolean;
}

const statusNames = {
  unjudged: '未判断',
  green: '绿色',
  red: '红色',
} as const;

interface HoldStart {
  pointerId: number;
  x: number;
  y: number;
}

export function ChoiceRow({ choice, readOnly = false }: ChoiceRowProps) {
  const { updateChoiceText, judgeChoice, deleteChoice } = useOpt();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(choice.text);
  const rowRef = useRef<HTMLElement>(null);
  const editMenuItemRef = useRef<HTMLButtonElement>(null);
  const deleteMenuItemRef = useRef<HTMLButtonElement>(null);
  const restoreRowFocus = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef<HoldStart | null>(null);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdStart.current = null;
  };

  useEffect(() => clearHold, []);

  useEffect(() => {
    if (!editing && restoreRowFocus.current) {
      restoreRowFocus.current = false;
      rowRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    editMenuItemRef.current?.focus();

    const closeFromOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeFromOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutsidePointer);
    };
  }, [menuOpen]);

  const openMenu = () => {
    if (!readOnly) setMenuOpen(true);
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (readOnly) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, [role="menuitem"]')) return;
    clearHold();
    holdStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      holdStart.current = null;
      openMenu();
    }, 600);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = holdStart.current;
    if (!start || event.pointerId !== start.pointerId) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      clearHold();
    }
  };

  const handleContextKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      openMenu();
    }
  };

  const saveEdit = (shouldRestoreFocus = false) => {
    if (editDraft.trim()) {
      updateChoiceText(choice.id, editDraft);
    } else {
      setEditDraft(choice.text);
    }
    restoreRowFocus.current = shouldRestoreFocus;
    setEditing(false);
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveEdit(true);
    }
    if (event.key === 'Escape') {
      setEditDraft(choice.text);
      restoreRowFocus.current = true;
      setEditing(false);
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false);
      rowRef.current?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [editMenuItemRef.current, deleteMenuItemRef.current];
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <article
      ref={rowRef}
      tabIndex={readOnly ? undefined : 0}
      data-decision={choice.status}
      onContextMenu={(event) => {
        if (readOnly) return;
        event.preventDefault();
        openMenu();
      }}
      onKeyDown={handleContextKey}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={clearHold}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onBlur={(event) => {
        if (menuOpen && !event.currentTarget.contains(event.relatedTarget)) {
          setMenuOpen(false);
        }
      }}
    >
      <time dateTime={choice.occurredAt}>{formatChoiceTime(choice.occurredAt)}</time>
      {editing ? (
        <input
          aria-label="编辑选择"
          autoFocus
          value={editDraft}
          onChange={(event) => setEditDraft(event.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={() => saveEdit(false)}
        />
      ) : (
        <span>{choice.text}</span>
      )}
      <button
        type="button"
        aria-label={`状态：${statusNames[choice.status]}`}
        disabled={readOnly}
        onClick={() => {
          if (choice.status !== 'unjudged') {
            judgeChoice(choice.id, 'unjudged');
          }
        }}
      />
      {menuOpen ? (
        <div role="menu" onKeyDown={handleMenuKeyDown}>
          <button
            ref={editMenuItemRef}
            type="button"
            role="menuitem"
            onClick={() => {
              setEditDraft(choice.text);
              setMenuOpen(false);
              setEditing(true);
            }}
          >
            编辑
          </button>
          <button
            ref={deleteMenuItemRef}
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              deleteChoice(choice.id);
            }}
          >
            删除
          </button>
        </div>
      ) : null}
    </article>
  );
}

function formatChoiceTime(timestamp: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}
