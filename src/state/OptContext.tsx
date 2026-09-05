import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createChoice, setChoiceStatus } from '../domain/choices';
import { resolveEditableDate, toLocalDateKey } from '../domain/date';
import type {
  Choice,
  ChoiceStatus,
  OptData,
  Settings,
} from '../domain/types';
import {
  createDefaultData,
  loadOptData,
  saveOptData,
  type StorageLike,
} from '../storage/optStorage';

export interface OptActions {
  addChoice(text: string): void;
  updateChoiceText(id: string, text: string): void;
  judgeChoice(id: string, status: ChoiceStatus): void;
  deleteChoice(id: string): void;
  undoDelete(): void;
  setDailyNote(note: string): void;
  updateSettings(settings: SettingsUpdate): void;
  markHistoryHintSeen(): void;
  resetCorruptData(): void;
}

export type SettingsUpdate = Partial<
  Pick<
    Settings,
    | 'reviewTime'
    | 'reminderEnabled'
    | 'notificationPreference'
    | 'historyHintSeen'
  >
>;

export interface OptContextValue extends OptActions {
  data: OptData;
  editableDate: string;
  saveError: boolean;
  corruptData: string | null;
  lastDeleted: Choice | null;
}

interface OptProviderProps extends PropsWithChildren {
  storage?: StorageLike;
  now?: () => Date;
}

interface InitialState {
  data: OptData;
  saveError: boolean;
  corruptData: string | null;
}

const OptContext = createContext<OptContextValue | null>(null);
let fallbackId = 0;
const unavailableStorage: StorageLike = {
  getItem() {
    throw new Error('Storage unavailable');
  },
  setItem() {
    throw new Error('Storage unavailable');
  },
  removeItem() {
    throw new Error('Storage unavailable');
  },
};

export function OptProvider({
  children,
  storage,
  now = systemNow,
}: OptProviderProps) {
  const resolvedStorage = storage ?? getBrowserStorage();
  const initialRef = useRef<InitialState | null>(null);
  if (initialRef.current === null) {
    initialRef.current = initialize(resolvedStorage, now());
  }

  const [data, setData] = useState(initialRef.current.data);
  const [saveError, setSaveError] = useState(initialRef.current.saveError);
  const [corruptData, setCorruptData] = useState<string | null>(
    initialRef.current.corruptData,
  );
  const [lastDeleted, setLastDeleted] = useState<Choice | null>(null);
  const dataRef = useRef(data);
  const corruptDataRef = useRef(corruptData);
  dataRef.current = data;
  corruptDataRef.current = corruptData;

  const editableDate = resolveEditableDate(
    toLocalDateKey(now()),
    data.settings.latestSeenDate,
  );

  const replaceAndPersist = useCallback(
    (next: OptData) => {
      dataRef.current = next;
      setData(next);
      setSaveError(!saveOptData(resolvedStorage, next).ok);
    },
    [resolvedStorage],
  );

  const mutate = useCallback(
    (
      transform: (current: OptData, editable: string) => OptData | null,
      deleted: Choice | null = null,
    ) => {
      if (corruptDataRef.current !== null) return;
      const current = dataRef.current;
      const editable = resolveEditableDate(
        toLocalDateKey(now()),
        current.settings.latestSeenDate,
      );
      const next = transform(current, editable);
      if (next === null) return;
      setLastDeleted(deleted);
      replaceAndPersist({
        ...next,
        settings: { ...next.settings, latestSeenDate: editable },
      });
    },
    [now, replaceAndPersist],
  );

  const addChoice = useCallback(
    (text: string) => {
      let choice: Choice;
      try {
        choice = createChoice(text, now(), createId());
      } catch {
        return;
      }
      mutate((current, editable) => {
        if (choice.localDate !== editable) return null;
        return { ...current, choices: [...current.choices, choice] };
      });
    },
    [mutate, now],
  );

  const updateChoiceText = useCallback(
    (id: string, text: string) => {
      const normalized = text.trim();
      if (!normalized) return;
      mutate((current, editable) => {
        const choiceIndex = current.choices.findIndex((item) => item.id === id);
        const choice = current.choices[choiceIndex];
        if (choiceIndex < 0 || choice.localDate !== editable) return null;
        const timestamp = now().toISOString();
        return {
          ...current,
          choices: current.choices.map((item, index) =>
            index === choiceIndex
              ? { ...item, text: normalized, updatedAt: timestamp }
              : item,
          ),
        };
      });
    },
    [mutate, now],
  );

  const judgeChoice = useCallback(
    (id: string, status: ChoiceStatus) => {
      mutate((current, editable) => {
        const choiceIndex = current.choices.findIndex((item) => item.id === id);
        const choice = current.choices[choiceIndex];
        if (choiceIndex < 0 || choice.localDate !== editable) return null;
        return {
          ...current,
          choices: current.choices.map((item, index) =>
            index === choiceIndex ? setChoiceStatus(item, status, now()) : item,
          ),
        };
      });
    },
    [mutate, now],
  );

  const deleteChoice = useCallback(
    (id: string) => {
      const current = dataRef.current;
      const editable = resolveEditableDate(
        toLocalDateKey(now()),
        current.settings.latestSeenDate,
      );
      const choice = current.choices.find((item) => item.id === id);
      if (!choice || choice.localDate !== editable) return;
      mutate(
        (latest) => {
          const choiceIndex = latest.choices.findIndex((item) => item.id === id);
          if (choiceIndex < 0) return null;
          return {
            ...latest,
            choices: latest.choices.filter((_, index) => index !== choiceIndex),
          };
        },
        choice,
      );
    },
    [mutate, now],
  );

  const undoDelete = useCallback(() => {
    if (corruptDataRef.current !== null || lastDeleted === null) return;
    const deleted = lastDeleted;
    const current = dataRef.current;
    const editable = resolveEditableDate(
      toLocalDateKey(now()),
      current.settings.latestSeenDate,
    );
    if (deleted.localDate !== editable) {
      setLastDeleted(null);
      return;
    }
    const next = {
      ...current,
      choices: [...current.choices, deleted],
    };
    setLastDeleted(null);
    replaceAndPersist(next);
  }, [lastDeleted, now, replaceAndPersist]);

  const setDailyNote = useCallback(
    (note: string) => {
      mutate((current, editable) => ({
        ...current,
        days: {
          ...current.days,
          [editable]: { localDate: editable, note },
        },
      }));
    },
    [mutate],
  );

  const updateSettings = useCallback(
    (settings: SettingsUpdate) => {
      mutate((current) => ({
        ...current,
        settings: {
          ...current.settings,
          ...settings,
          latestSeenDate: current.settings.latestSeenDate,
        },
      }));
    },
    [mutate],
  );

  const markHistoryHintSeen = useCallback(() => {
    updateSettings({ historyHintSeen: true });
  }, [updateSettings]);

  const resetCorruptData = useCallback(() => {
    if (corruptDataRef.current === null) return;
    const next = createDefaultData(now());
    const result = saveOptData(resolvedStorage, next);
    if (!result.ok) {
      setSaveError(true);
      return;
    }
    dataRef.current = next;
    corruptDataRef.current = null;
    setData(next);
    setCorruptData(null);
    setLastDeleted(null);
    setSaveError(false);
  }, [now, resolvedStorage]);

  useEffect(() => {
    const checkDate = () => {
      if (corruptDataRef.current !== null) return;
      const current = dataRef.current;
      const latestSeenDate = resolveEditableDate(
        toLocalDateKey(now()),
        current.settings.latestSeenDate,
      );
      if (latestSeenDate === current.settings.latestSeenDate) return;
      replaceAndPersist({
        ...current,
        settings: { ...current.settings, latestSeenDate },
      });
      setLastDeleted(null);
    };

    checkDate();
    const interval = window.setInterval(checkDate, 30_000);
    document.addEventListener('visibilitychange', checkDate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkDate);
    };
  }, [now, replaceAndPersist]);

  const value = useMemo<OptContextValue>(
    () => ({
      data,
      editableDate,
      saveError,
      corruptData,
      lastDeleted,
      addChoice,
      updateChoiceText,
      judgeChoice,
      deleteChoice,
      undoDelete,
      setDailyNote,
      updateSettings,
      markHistoryHintSeen,
      resetCorruptData,
    }),
    [
      data,
      editableDate,
      saveError,
      corruptData,
      lastDeleted,
      addChoice,
      updateChoiceText,
      judgeChoice,
      deleteChoice,
      undoDelete,
      setDailyNote,
      updateSettings,
      markHistoryHintSeen,
      resetCorruptData,
    ],
  );

  return <OptContext.Provider value={value}>{children}</OptContext.Provider>;
}

export function useOpt(): OptContextValue {
  const context = useContext(OptContext);
  if (context === null) {
    throw new Error('useOpt must be used within OptProvider');
  }
  return context;
}

function initialize(storage: StorageLike, now: Date): InitialState {
  const result = loadOptData(storage, now);
  if (result.ok) {
    return { data: result.data, saveError: false, corruptData: null };
  }
  return {
    data: createDefaultData(now),
    saveError: result.reason === 'unavailable',
    corruptData: result.reason === 'corrupt' ? (result.raw ?? '') : null,
  };
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  fallbackId += 1;
  return `choice-${Date.now()}-${fallbackId}`;
}

function systemNow(): Date {
  return new Date();
}

function getBrowserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
}
