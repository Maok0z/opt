import type { ChoiceStats } from '../domain/types';

interface RatioBarProps {
  stats: ChoiceStats;
}

export function RatioBar({ stats }: RatioBarProps) {
  return (
    <section aria-label="今日判断比例">
      <div aria-hidden="true">
        <span data-testid="ratio-green" style={{ width: `${stats.greenPercent}%` }} />
        <span data-testid="ratio-red" style={{ width: `${stats.redPercent}%` }} />
        <span
          data-testid="ratio-unjudged"
          style={{ width: `${stats.unjudgedPercent}%` }}
        />
      </div>
      <p>
        {stats.green} 绿 · {stats.red} 红 · {stats.unjudged} 未判断
      </p>
    </section>
  );
}
