import { getChoiceStats } from '../domain/choices';
import { ChoiceComposer } from '../components/ChoiceComposer';
import { DailyNote } from '../components/DailyNote';
import { RatioBar } from '../components/RatioBar';
import { Timeline } from '../components/Timeline';
import { useOpt } from '../state/OptContext';
import { usePullHold } from '../gestures/usePullHold';

interface TodayPageProps {
  onOpenReview(): void;
  onOpenHistory(): void;
  onOpenSettings(): void;
}

export function TodayPage({
  onOpenReview,
  onOpenHistory,
  onOpenSettings,
}: TodayPageProps) {
  const opt = useOpt();
  const openHistory = () => {
    opt.markHistoryHintSeen();
    onOpenHistory();
  };
  const historyPull = usePullHold({
    distance: 64,
    holdMs: 500,
    enabled: opt.corruptData === null,
    onComplete: openHistory,
  });

  if (opt.corruptData !== null) {
    return (
      <main>
        <p>本地记录无法读取，原始数据尚未更改</p>
        {opt.saveError ? <p role="status">未能保存到此浏览器</p> : null}
        <button type="button" onClick={opt.resetCorruptData}>
          开始新的本地记录
        </button>
      </main>
    );
  }

  const choices = opt.data.choices.filter(
    (choice) => choice.localDate === opt.editableDate,
  );
  const stats = getChoiceStats(choices);
  const note = opt.data.days[opt.editableDate]?.note ?? '';

  return (
    <main>
      <header>
        <span>opt.</span>
        <button
          className="app-settings-trigger"
          type="button"
          onClick={onOpenSettings}
          aria-label="设置"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.62 3.1h4.76l.63 2.16c.49.2.96.47 1.39.8l2.13-.66 2.38 4.12-1.53 1.61c.05.29.08.58.08.87s-.03.58-.08.87l1.53 1.61-2.38 4.12-2.13-.66c-.43.33-.9.6-1.39.8l-.63 2.16H9.62l-.63-2.16a7.42 7.42 0 0 1-1.39-.8l-2.13.66-2.38-4.12 1.53-1.61A5.9 5.9 0 0 1 4.54 12c0-.29.03-.58.08-.87L3.09 9.52 5.47 5.4l2.13.66c.43-.33.9-.6 1.39-.8l.63-2.16ZM12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
          </svg>
        </button>
      </header>
      <div
        data-testid="history-pull-zone"
        style={{ touchAction: 'pan-x' }}
        {...historyPull.bind}
      >
        <div
          aria-hidden="true"
          data-testid="history-pull-progress"
          data-holding={historyPull.holding}
          style={{ '--pull-progress': historyPull.progress } as React.CSSProperties}
        />
        {!opt.data.settings.historyHintSeen ? (
          <p>下拉并停留，查看过往</p>
        ) : null}
        <h1>今天</h1>
        <time dateTime={opt.editableDate}>{formatDate(opt.editableDate)}</time>
      </div>
      {opt.saveError ? <p role="status">未能保存到此浏览器</p> : null}
      <ChoiceComposer onAdd={opt.addChoice} />
      <nav aria-label="页面入口">
        <button type="button" onClick={onOpenReview}>
          开始回顾
        </button>
        <button type="button" onClick={openHistory}>
          过往
        </button>
      </nav>
      <Timeline choices={choices} />
      <RatioBar stats={stats} />
      <DailyNote
        dateKey={opt.editableDate}
        note={note}
        onSave={opt.setDailyNote}
      />
    </main>
  );
}

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(year, month - 1, day));
}
