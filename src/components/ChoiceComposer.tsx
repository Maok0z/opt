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
    <input
      ref={inputRef}
      aria-label="记录此刻的选择"
      autoComplete="off"
      enterKeyHint="done"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
}
