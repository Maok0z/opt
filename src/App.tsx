import { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { useReviewReminder } from './hooks/useReviewReminder';
import { HistoryPage } from './pages/HistoryPage';
import { ReviewPage } from './pages/ReviewPage';
import { TodayPage } from './pages/TodayPage';
import { useOpt } from './state/OptContext';
import './styles.css';

type Surface = 'today' | 'review' | 'history';

const REVIEW_HISTORY_KEY = 'optReviewEntry';

export function App() {
  const { data, editableDate, updateSettings } = useOpt();
  const [surface, setSurface] = useState<Surface>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const unjudgedCount = useMemo(
    () =>
      data.choices.filter(
        (choice) =>
          choice.localDate === editableDate && choice.status === 'unjudged',
      ).length,
    [data.choices, editableDate],
  );
  const reminder = useReviewReminder({
    settings: data.settings,
    unjudgedCount,
  });

  const openReview = useCallback(() => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    window.history.pushState({ ...state, [REVIEW_HISTORY_KEY]: true }, '');
    setSurface('review');
  }, []);

  const exitReview = useCallback(() => {
    setSurface('today');
    if (window.history.state?.[REVIEW_HISTORY_KEY] === true) {
      window.history.back();
    }
  }, []);

  const openHistory = useCallback(() => setSurface('history'), []);
  const exitHistory = useCallback(() => setSurface('today'), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useEffect(() => {
    const returnToToday = () => setSurface('today');
    window.addEventListener('popstate', returnToToday);
    return () => window.removeEventListener('popstate', returnToToday);
  }, []);

  useEffect(() => {
    const synchronizeNotificationPermission = () => {
      const actualPermission =
        typeof Notification === 'undefined'
          ? 'unsupported'
          : Notification.permission;
      if (actualPermission !== data.settings.notificationPreference) {
        updateSettings({ notificationPreference: actualPermission });
      }
    };

    synchronizeNotificationPermission();
    document.addEventListener(
      'visibilitychange',
      synchronizeNotificationPermission,
    );
    return () =>
      document.removeEventListener(
        'visibilitychange',
        synchronizeNotificationPermission,
      );
  }, [data.settings.notificationPreference, updateSettings]);

  return (
    <div className="opt-app" data-surface={surface}>
      {surface === 'today' && reminder.due ? (
        <aside className="review-reminder" role="status">
          <p>该回顾今天的选择了</p>
          <button type="button" onClick={openReview}>
            开始回顾
          </button>
          <button type="button" onClick={reminder.dismissForToday}>
            今天稍后再说
          </button>
        </aside>
      ) : null}

      {surface === 'today' ? (
        <TodayPage
          onOpenReview={openReview}
          onOpenHistory={openHistory}
          onOpenSettings={openSettings}
        />
      ) : surface === 'review' ? (
        <ReviewPage onExit={exitReview} />
      ) : (
        <HistoryPage onExit={exitHistory} />
      )}

      {settingsOpen ? <SettingsPanel onClose={closeSettings} /> : null}
    </div>
  );
}
