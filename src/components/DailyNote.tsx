import { useEffect, useState } from 'react';

interface DailyNoteProps {
  dateKey: string;
  note: string;
  onSave(note: string): void;
}

export function DailyNote({ dateKey, note, onSave }: DailyNoteProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    setDraft(note);
  }, [dateKey, note]);

  return (
    <section className="daily-note" data-expanded={expanded}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        今日随记
      </button>
      <div className="daily-note__content" aria-hidden={!expanded}>
        <div>
          <textarea
            aria-label="今日随记内容"
            tabIndex={expanded ? 0 : -1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => onSave(draft)}
          />
        </div>
      </div>
    </section>
  );
}
