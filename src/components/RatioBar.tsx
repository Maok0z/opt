import type { ChoiceStats } from '../domain/types';

interface RatioBarProps {
  stats: ChoiceStats;
}

export function RatioBar({ stats }: RatioBarProps) {
  return (
    <section className="ratio" aria-label="今日判断比例">
      <div className="ratio__bar" aria-hidden="true">
        <span className="ratio__green" data-testid="ratio-green" style={{ width: `${stats.greenPercent}%` }} />
        <span className="ratio__red" data-testid="ratio-red" style={{ width: `${stats.redPercent}%` }} />
        <span
          className="ratio__unjudged"
          data-testid="ratio-unjudged"
          style={{ width: `${stats.unjudgedPercent}%` }}
        />
      </div>
      <p className="ratio__labels">
        {stats.green} 绿 · {stats.red} 红 · {stats.unjudged} 未判断
      </p>
    </section>
  );
}
