import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface ChoiceComposerProps {
  onAdd(text: string): void;
}

export function ChoiceComposer({ onAdd }: ChoiceComposerProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="choice-composer">
      <input
        ref={inputRef}
        aria-label="记录此刻的选择"
        name="choice"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="此刻，我选择了…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span aria-hidden="true">Enter</span>
    </div>
  );
}
