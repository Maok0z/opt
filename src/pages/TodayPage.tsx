import { getChoiceStats } from '../domain/choices';
import { ChoiceComposer } from '../components/ChoiceComposer';
import { DailyNote } from '../components/DailyNote';
import { RatioBar } from '../components/RatioBar';
import { Timeline } from '../components/Timeline';
import { useOpt } from '../state/OptContext';

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
        <button type="button" onClick={onOpenSettings}>
          设置
        </button>
      </header>
      <h1>今天</h1>
      <time dateTime={opt.editableDate}>{formatDate(opt.editableDate)}</time>
      {opt.saveError ? <p role="status">未能保存到此浏览器</p> : null}
      <ChoiceComposer onAdd={opt.addChoice} />
      <nav aria-label="页面入口">
        <button type="button" onClick={onOpenReview}>
          开始回顾
        </button>
        <button type="button" onClick={onOpenHistory}>
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
      {opt.lastDeleted ? (
        <button type="button" onClick={opt.undoDelete}>
          撤销删除
        </button>
      ) : null}
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
