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
    <section>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        今日随记
      </button>
      {expanded ? (
        <textarea
          aria-label="今日随记内容"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => onSave(draft)}
        />
      ) : null}
    </section>
  );
}
