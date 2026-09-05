import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface ChoiceComposerProps {
  onAdd(text: string): void;
}

export function ChoiceComposer({ onAdd }: ChoiceComposerProps) {
  const [draft, setDraft] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedTimer = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (submittedTimer.current !== null) {
        window.clearTimeout(submittedTimer.current);
      }
    };
  }, []);

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft('');
    setIsSubmitted(true);
    if (submittedTimer.current !== null) {
      window.clearTimeout(submittedTimer.current);
    }
    submittedTimer.current = window.setTimeout(() => {
      submittedTimer.current = null;
      setIsSubmitted(false);
    }, 520);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  };

  return (
    <div
      className="choice-composer"
      data-active={isActive}
      data-submitted={isSubmitted}
    >
      <input
        ref={inputRef}
        aria-label="记录此刻的选择"
        name="choice"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="此刻，我选择了…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        onKeyDown={handleKeyDown}
      />
      <span className="choice-composer__submit-cue" aria-hidden="true">
        <span className="choice-composer__submit-key">Enter</span>
        <span className="choice-composer__submit-confirm">已记录</span>
      </span>
      {isSubmitted ? (
        <span aria-live="polite" className="visually-hidden">记录已完成</span>
      ) : null}
    </div>
  );
}
