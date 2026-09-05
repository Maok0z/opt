# opt Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, local-first Windows browser MVP for capturing, judging, reviewing, and reading past micro-choices.

**Architecture:** A React/TypeScript single-page app keeps domain rules in pure functions, persistence behind a versioned local-storage adapter, and pointer/keyboard gestures in isolated hooks. A small `OptProvider` owns application state; four focused surfaces—Today, Review, History, and Settings—consume that state without a routing or state-management dependency.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Vitest, Testing Library, Playwright, CSS Modules-free plain CSS with design tokens, browser Local Storage and Notification APIs.

**Spec:** `docs/superpowers/specs/2026-09-04-opt-web-mvp-design.md`

## Global Constraints

- The app is a static, client-only Web application that runs in a Windows browser and requires no account or server.
- A choice records only the behavior that happened; the product never proposes alternatives or judges on the user's behalf.
- Choice status is exactly `unjudged`, `green`, or `red`.
- Today is editable; every earlier local date is permanently read-only, including after the system clock is rolled back.
- Creating a choice requires one line of text and Enter; time is captured automatically.
- Default review time is `21:30`; notifications are requested only after an explicit user action.
- Review is full-screen, neutral before judgment, saturated `#20C873` on right/green and `#F04444` on left/red.
- History is entered by pull-and-hold for 500 ms, with a discreet text fallback, and past days are folded by default.
- The ordinary interface uses `#F4F4F1` background and `#171816` text, system fonts, visible keyboard focus, non-color status labels, and honors `prefers-reduced-motion`.
- Do not add accounts, cloud sync, tags, search, scores, streaks, badges, recommendations, import/export, or a Windows native package.

---

## File Map

- `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`: build, test, and browser entry configuration.
- `src/domain/types.ts`: persisted and in-memory type contracts.
- `src/domain/date.ts`: local-date formatting and monotonic editable-date boundary.
- `src/domain/choices.ts`: creation, judgment, review queue, ordering, and statistics.
- `src/storage/optStorage.ts`: versioned parsing and safe Local Storage reads/writes.
- `src/state/OptContext.tsx`: application state, mutations, persistence status, and date rollover.
- `src/gestures/useHorizontalDecision.ts`: pointer decision threshold and drag progress.
- `src/gestures/usePullHold.ts`: 500 ms pull-and-hold recognition.
- `src/components/ChoiceComposer.tsx`: one-line Enter-to-save input.
- `src/components/ChoiceRow.tsx`: minimal time/content/status presentation and today-only actions.
- `src/components/Timeline.tsx`: ordered choice rows and empty state.
- `src/components/RatioBar.tsx`: visual and textual green/red/unjudged totals.
- `src/components/DailyNote.tsx`: collapsible autosaving free text.
- `src/pages/TodayPage.tsx`: default surface and history/review/settings entry points.
- `src/pages/ReviewPage.tsx`: full-screen one-choice-at-a-time judgment.
- `src/pages/HistoryPage.tsx`: folded historical days and read-only timelines.
- `src/components/SettingsPanel.tsx`: review time and notification controls.
- `src/hooks/useReviewReminder.ts`: in-page reminder and optional Notification dispatch.
- `src/App.tsx`: surface state and browser-history/Escape behavior.
- `src/styles.css`: tokens, layout, transitions, accessibility, and responsive rules.
- `src/**/*.test.ts(x)`: colocated unit and component tests.
- `e2e/opt.spec.ts`: complete browser workflows.
- `README.md`: install, run, build, data-location, notification, and test instructions.

---

### Task 1: Project shell and domain rules

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/vite-env.d.ts`
- Create: `src/domain/types.ts`
- Create: `src/domain/date.ts`
- Create: `src/domain/choices.ts`
- Test: `src/domain/date.test.ts`
- Test: `src/domain/choices.test.ts`

**Interfaces:**
- Produces `ChoiceStatus`, `Choice`, `DayRecord`, `Settings`, `OptData`, `ChoiceStats`.
- Produces `toLocalDateKey(date): string`, `resolveEditableDate(nowKey, latestSeenDate): string`, and `isDateEditable(dateKey, editableDate): boolean`.
- Produces `createChoice(text, now, id): Choice`, `setChoiceStatus(choice, status, now): Choice`, `getReviewQueue(choices, dateKey): Choice[]`, and `getChoiceStats(choices): ChoiceStats`.

- [ ] **Step 1: Create build and test configuration**

Create `package.json` with scripts `dev`, `build`, `test`, `test:run`, `test:e2e`, and `check`; dependencies `react` and `react-dom`; development dependencies `@playwright/test`, `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `jsdom`, `typescript`, `vite`, and `vitest`. Configure Vite with the React plugin and Vitest's `jsdom` environment plus `src/test/setup.ts` as the setup file.

Run: `npm install`

Expected: dependency installation succeeds and creates `package-lock.json`.

- [ ] **Step 2: Write failing domain tests**

```ts
// src/domain/date.test.ts
import { describe, expect, it } from 'vitest';
import { isDateEditable, resolveEditableDate, toLocalDateKey } from './date';

describe('local date boundary', () => {
  it('formats a local calendar date without converting through UTC', () => {
    expect(toLocalDateKey(new Date(2026, 8, 4, 23, 59))).toBe('2026-09-04');
  });

  it('never makes an earlier date editable after the clock moves back', () => {
    expect(resolveEditableDate('2026-09-03', '2026-09-04')).toBe('2026-09-04');
    expect(isDateEditable('2026-09-03', '2026-09-04')).toBe(false);
  });
});
```

```ts
// src/domain/choices.test.ts
import { describe, expect, it } from 'vitest';
import { createChoice, getChoiceStats, getReviewQueue, setChoiceStatus } from './choices';

describe('choice domain', () => {
  const morning = new Date('2026-09-04T08:05:00+08:00');

  it('trims and creates an unjudged choice at the supplied time', () => {
    const choice = createChoice('  躺在床上玩手机  ', morning, 'choice-1');
    expect(choice).toMatchObject({ id: 'choice-1', text: '躺在床上玩手机', status: 'unjudged', localDate: '2026-09-04' });
    expect(choice.occurredAt).toBe(morning.toISOString());
  });

  it('records and clears a user judgment without changing occurrence time', () => {
    const choice = createChoice('喝黑咖啡', morning, 'choice-1');
    const green = setChoiceStatus(choice, 'green', new Date('2026-09-04T21:30:00+08:00'));
    expect(green.status).toBe('green');
    expect(green.judgedAt).toBeTruthy();
    expect(setChoiceStatus(green, 'unjudged', morning).judgedAt).toBeNull();
  });

  it('returns only unjudged choices for the requested day in occurrence order', () => {
    const first = createChoice('第一条', morning, '1');
    const second = setChoiceStatus(createChoice('第二条', new Date('2026-09-04T09:00:00+08:00'), '2'), 'red', morning);
    const otherDay = createChoice('昨天', new Date('2026-09-03T09:00:00+08:00'), '3');
    expect(getReviewQueue([second, otherDay, first], '2026-09-04').map(({ id }) => id)).toEqual(['1']);
  });

  it('derives green, red, unjudged, total, and percentages', () => {
    const base = createChoice('一条', morning, '1');
    const choices = [base, setChoiceStatus({ ...base, id: '2' }, 'green', morning), setChoiceStatus({ ...base, id: '3' }, 'red', morning)];
    expect(getChoiceStats(choices)).toEqual({ green: 1, red: 1, unjudged: 1, total: 3, greenPercent: 100 / 3, redPercent: 100 / 3, unjudgedPercent: 100 / 3 });
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npm run test:run -- src/domain/date.test.ts src/domain/choices.test.ts`

Expected: FAIL because `./date` and `./choices` do not exist.

- [ ] **Step 4: Implement types and pure domain functions**

```ts
// src/domain/types.ts
export type ChoiceStatus = 'unjudged' | 'green' | 'red';
export interface Choice { id: string; text: string; occurredAt: string; localDate: string; status: ChoiceStatus; judgedAt: string | null; createdAt: string; updatedAt: string }
export interface DayRecord { localDate: string; note: string }
export interface Settings { reviewTime: string; reminderEnabled: boolean; notificationPreference: 'default' | 'granted' | 'denied' | 'unsupported'; historyHintSeen: boolean; latestSeenDate: string }
export interface OptData { version: 1; choices: Choice[]; days: Record<string, DayRecord>; settings: Settings }
export interface ChoiceStats { green: number; red: number; unjudged: number; total: number; greenPercent: number; redPercent: number; unjudgedPercent: number }
```

Implement `toLocalDateKey` with local `getFullYear/getMonth/getDate`, reject blank text in `createChoice` with `Error('Choice text is required')`, preserve `occurredAt` when changing status, set `judgedAt` to `null` for `unjudged`, sort review choices by `occurredAt` and then `createdAt`, and return zero percentages when the total is zero.

- [ ] **Step 5: Run domain tests and type checking**

Run: `npm run test:run -- src/domain/date.test.ts src/domain/choices.test.ts`

Expected: 6 tests PASS.

Run: `npm run check`

Expected: TypeScript exits with code 0.

- [ ] **Step 6: Commit the shell and domain layer**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html src/vite-env.d.ts src/test/setup.ts src/domain
git commit -m "feat: establish opt domain model"
```

---

### Task 2: Versioned persistence and application state

**Files:**
- Create: `src/storage/optStorage.ts`
- Create: `src/state/OptContext.tsx`
- Test: `src/storage/optStorage.test.ts`
- Test: `src/state/OptContext.test.tsx`

**Interfaces:**
- Consumes all contracts and domain functions from Task 1.
- Produces `createDefaultData(now): OptData`, `loadOptData(storage, now): LoadResult`, and `saveOptData(storage, data): SaveResult`.
- Produces `OptProvider`, `useOpt()`, and `OptActions` methods `addChoice`, `updateChoiceText`, `judgeChoice`, `deleteChoice`, `undoDelete`, `setDailyNote`, `updateSettings`, `markHistoryHintSeen`, and `resetCorruptData`.

- [ ] **Step 1: Write failing storage tests**

```ts
// src/storage/optStorage.test.ts
import { describe, expect, it } from 'vitest';
import { createDefaultData, loadOptData, saveOptData } from './optStorage';

describe('opt storage', () => {
  it('returns defaults when no data exists', () => {
    const storage = new MapStorage();
    expect(loadOptData(storage, new Date(2026, 8, 4)).data.settings.reviewTime).toBe('21:30');
  });

  it('round-trips version one data', () => {
    const storage = new MapStorage();
    const data = createDefaultData(new Date(2026, 8, 4));
    expect(saveOptData(storage, data)).toEqual({ ok: true });
    expect(loadOptData(storage, new Date(2026, 8, 4))).toEqual({ ok: true, data });
  });

  it('preserves malformed source text and reports corruption', () => {
    const storage = new MapStorage([['opt:data', '{bad-json']]);
    const result = loadOptData(storage, new Date(2026, 8, 4));
    expect(result.ok).toBe(false);
    expect(result.raw).toBe('{bad-json');
  });
});
```

Define the small `MapStorage` test double in this test file with `getItem`, `setItem`, and `removeItem` methods matching the `StorageLike` interface.

- [ ] **Step 2: Run the storage test and verify RED**

Run: `npm run test:run -- src/storage/optStorage.test.ts`

Expected: FAIL because `./optStorage` does not exist.

- [ ] **Step 3: Implement the storage adapter**

Use storage key `opt:data`. `createDefaultData` returns version `1`, empty choices/days, review time `21:30`, reminders enabled, the current Notification capability state, `historyHintSeen: false`, and `latestSeenDate` from `toLocalDateKey(now)`. Validate parsed arrays, records, version, and status enum before returning success. Catch both read and write exceptions; return `{ ok: false, reason: 'unavailable' | 'corrupt', raw?: string }` without overwriting malformed input.

- [ ] **Step 4: Write failing provider tests**

```tsx
// src/state/OptContext.test.tsx
it('adds a choice, persists it, and restores it after remount', async () => {
  const storage = new MapStorage();
  const now = () => new Date('2026-09-04T08:05:00+08:00');
  const { unmount } = render(<OptProvider storage={storage} now={now}><Probe /></OptProvider>);
  await userEvent.click(screen.getByRole('button', { name: 'add-test-choice' }));
  expect(screen.getByText('躺在床上玩手机')).toBeInTheDocument();
  unmount();
  render(<OptProvider storage={storage} now={now}><Probe /></OptProvider>);
  expect(screen.getByText('躺在床上玩手机')).toBeInTheDocument();
});

it('refuses mutations for dates earlier than the monotonic editable date', async () => {
  const storage = seededStorageWithYesterdayChoice();
  render(<OptProvider storage={storage} now={() => new Date('2026-09-04T08:00:00+08:00')}><Probe /></OptProvider>);
  await userEvent.click(screen.getByRole('button', { name: 'judge-yesterday' }));
  expect(screen.getByTestId('yesterday-status')).toHaveTextContent('unjudged');
});

it('does not overwrite corrupt source data until the user explicitly resets it', async () => {
  const storage = new MapStorage([['opt:data', '{bad-json']]);
  render(<OptProvider storage={storage} now={() => new Date('2026-09-04T08:00:00+08:00')}><Probe /></OptProvider>);
  expect(screen.getByTestId('corrupt-data')).toHaveTextContent('{bad-json');
  expect(storage.getItem('opt:data')).toBe('{bad-json');
  await userEvent.click(screen.getByRole('button', { name: 'reset-corrupt-data' }));
  expect(JSON.parse(storage.getItem('opt:data') ?? '')).toMatchObject({ version: 1, choices: [] });
});
```

Define `Probe`, `MapStorage`, and `seededStorageWithYesterdayChoice` inside the test file; `Probe` renders current choice text/status and buttons that invoke exact context methods.

- [ ] **Step 5: Run provider tests and verify RED**

Run: `npm run test:run -- src/state/OptContext.test.tsx`

Expected: FAIL because `OptContext.tsx` does not exist.

- [ ] **Step 6: Implement `OptProvider`**

Load once from the injected `StorageLike`; expose `data`, `editableDate`, `saveError`, `corruptData`, `lastDeleted`, and the exact mutation methods. Every mutation checks `choice.localDate === editableDate` before changing data. Persist after each successful mutation; keep the in-memory update and set `saveError` when persistence fails. Store the most recently deleted choice until another mutation or `undoDelete`. When corrupt source text exists, keep it untouched and block mutations until `resetCorruptData` is called; that explicit action replaces it with `createDefaultData(now())`. Check local date every 30 seconds and on `visibilitychange`; update `latestSeenDate` monotonically and never unlock an older date.

- [ ] **Step 7: Run state and storage tests**

Run: `npm run test:run -- src/storage/optStorage.test.ts src/state/OptContext.test.tsx`

Expected: all persistence and provider tests PASS with no warnings.

- [ ] **Step 8: Commit persistence and state**

```bash
git add src/storage src/state
git commit -m "feat: persist local opt data"
```

---

### Task 3: Today timeline, editing, undo, ratio, and daily note

**Files:**
- Create: `src/components/ChoiceComposer.tsx`
- Create: `src/components/ChoiceRow.tsx`
- Create: `src/components/Timeline.tsx`
- Create: `src/components/RatioBar.tsx`
- Create: `src/components/DailyNote.tsx`
- Create: `src/pages/TodayPage.tsx`
- Test: `src/pages/TodayPage.test.tsx`

**Interfaces:**
- Consumes `useOpt`, `Choice`, `ChoiceStats`, and context mutation methods from Tasks 1–2.
- Produces `TodayPage({ onOpenReview, onOpenHistory, onOpenSettings }): JSX.Element`.
- Produces reusable read-only mode through `Timeline({ choices, readOnly })` and `ChoiceRow({ choice, readOnly })`.

- [ ] **Step 1: Write failing today-page interaction tests**

```tsx
// src/pages/TodayPage.test.tsx
it('focuses the one-line composer and adds trimmed text with Enter', async () => {
  renderToday();
  const input = screen.getByRole('textbox', { name: '记录此刻的选择' });
  expect(input).toHaveFocus();
  await userEvent.type(input, '  躺在床上玩手机  {enter}');
  expect(screen.getByText('躺在床上玩手机')).toBeInTheDocument();
  expect(input).toHaveValue('');
});

it('keeps blank input and does not create a row', async () => {
  renderToday();
  const input = screen.getByRole('textbox', { name: '记录此刻的选择' });
  await userEvent.type(input, '   {enter}');
  expect(input).toHaveValue('   ');
  expect(screen.queryAllByRole('article')).toHaveLength(0);
});

it('edits from the context menu and undoes deletion', async () => {
  renderTodayWithChoice('喝生椰拿铁');
  fireEvent.contextMenu(screen.getByText('喝生椰拿铁'));
  await userEvent.click(screen.getByRole('menuitem', { name: '编辑' }));
  await userEvent.clear(screen.getByRole('textbox', { name: '编辑选择' }));
  await userEvent.type(screen.getByRole('textbox', { name: '编辑选择' }), '喝黑咖啡{enter}');
  expect(screen.getByText('喝黑咖啡')).toBeInTheDocument();
  fireEvent.contextMenu(screen.getByText('喝黑咖啡'));
  await userEvent.click(screen.getByRole('menuitem', { name: '删除' }));
  await userEvent.click(screen.getByRole('button', { name: '撤销删除' }));
  expect(screen.getByText('喝黑咖啡')).toBeInTheDocument();
});

it('opens the same edit menu after a 600ms pointer hold', () => {
  vi.useFakeTimers();
  renderTodayWithChoice('喝生椰拿铁');
  const row = screen.getByRole('article');
  fireEvent.pointerDown(row, { pointerId: 1, clientX: 20, clientY: 20 });
  vi.advanceTimersByTime(600);
  expect(screen.getByRole('menuitem', { name: '编辑' })).toBeInTheDocument();
  vi.useRealTimers();
});

it('shows textual totals and autosaves the daily note on blur', async () => {
  renderTodayWithStatuses(['green', 'red', 'unjudged']);
  expect(screen.getByText('1 绿 · 1 红 · 1 未判断')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '今日随记' }));
  await userEvent.type(screen.getByRole('textbox', { name: '今日随记内容' }), '今天更留意起床后的选择');
  fireEvent.blur(screen.getByRole('textbox', { name: '今日随记内容' }));
  expect(readSavedNote()).toBe('今天更留意起床后的选择');
});
```

- [ ] **Step 2: Run today-page tests and verify RED**

Run: `npm run test:run -- src/pages/TodayPage.test.tsx`

Expected: FAIL because `TodayPage.tsx` does not exist.

- [ ] **Step 3: Implement the minimal today surface**

`ChoiceComposer` owns draft text, submits only when `draft.trim()` is non-empty, and restores focus after submission. `ChoiceRow` renders `<time>`, choice text, and a button whose accessible name is `状态：未判断|绿色|红色`; clicking a judged status clears it. A context menu offers only 编辑 and 删除 and opens from `contextmenu` (mouse right-click or keyboard context key) or a stationary 600 ms pointer hold; pointer movement over 8 px cancels the hold. `Timeline` sorts choices chronologically. `RatioBar` uses three spans with widths from `ChoiceStats` plus the exact text summary. `DailyNote` is collapsed initially and writes through on blur. `TodayPage` selects only `editableDate` choices, always renders `开始回顾`, and shows save failure as `role="status"` with text `未能保存到此浏览器`. If `corruptData` exists, replace normal content with the preserved-data message `本地记录无法读取，原始数据尚未更改` and an explicit `开始新的本地记录` button wired to `resetCorruptData`.

- [ ] **Step 4: Run today-page tests**

Run: `npm run test:run -- src/pages/TodayPage.test.tsx`

Expected: all Today tests PASS and no React act warnings appear.

- [ ] **Step 5: Commit the complete Today flow**

```bash
git add src/components src/pages/TodayPage.tsx src/pages/TodayPage.test.tsx
git commit -m "feat: add frictionless today timeline"
```

---

### Task 4: Pointer and keyboard judgment plus immersive review

**Files:**
- Create: `src/gestures/useHorizontalDecision.ts`
- Create: `src/pages/ReviewPage.tsx`
- Modify: `src/components/ChoiceRow.tsx`
- Modify: `src/pages/TodayPage.tsx`
- Test: `src/gestures/useHorizontalDecision.test.tsx`
- Test: `src/pages/ReviewPage.test.tsx`
- Test: `src/components/ChoiceRow.test.tsx`

**Interfaces:**
- Produces `useHorizontalDecision({ threshold, onDecision })` returning `bind`, `offsetX`, `progress`, and `direction`.
- Produces `ReviewPage({ onExit }): JSX.Element`.
- Extends `ChoiceRow` to call `judgeChoice(id, 'green' | 'red')` from drag or focused ArrowRight/ArrowLeft.

- [ ] **Step 1: Write failing gesture tests**

```tsx
it('commits right only after crossing the configured threshold', () => {
  const onDecision = vi.fn();
  render(<GestureProbe threshold={120} onDecision={onDecision} />);
  const target = screen.getByTestId('gesture');
  fireEvent.pointerDown(target, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: 210, clientY: 100 });
  fireEvent.pointerUp(target, { pointerId: 1, clientX: 210, clientY: 100 });
  expect(onDecision).not.toHaveBeenCalled();
  fireEvent.pointerDown(target, { pointerId: 2, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(target, { pointerId: 2, clientX: 230, clientY: 100 });
  fireEvent.pointerUp(target, { pointerId: 2, clientX: 230, clientY: 100 });
  expect(onDecision).toHaveBeenCalledWith('right');
});
```

- [ ] **Step 2: Run gesture tests and verify RED**

Run: `npm run test:run -- src/gestures/useHorizontalDecision.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the pointer hook and row judgment**

Track the active `pointerId`, start coordinates, horizontal offset, and vertical cancellation. Cancel judgment if vertical movement exceeds horizontal movement before lock. Clamp progress to `[-1, 1]`, commit only when `Math.abs(offsetX) >= threshold`, and reset on cancel/up. In `ChoiceRow`, use a 72 px threshold and keyboard handlers only when the row itself has focus.

- [ ] **Step 4: Write failing review tests**

```tsx
it('shows only the earliest unjudged choice and advances after green', async () => {
  renderReviewWithChoices(['第一条', '第二条']);
  expect(screen.getByRole('heading', { name: '第一条' })).toBeInTheDocument();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByTestId('review-screen')).toHaveAttribute('data-decision', 'green');
  await waitFor(() => expect(screen.getByRole('heading', { name: '第二条' })).toBeInTheDocument());
});

it('uses red for left, exits with Escape, and preserves completed judgments', async () => {
  const onExit = vi.fn();
  renderReviewWithChoices(['第一条'], { onExit });
  await userEvent.keyboard('{ArrowLeft}');
  expect(screen.getByTestId('review-screen')).toHaveAttribute('data-decision', 'red');
  await userEvent.keyboard('{Escape}');
  expect(onExit).toHaveBeenCalledOnce();
  expect(readChoiceStatus('第一条')).toBe('red');
});
```

- [ ] **Step 5: Run review tests and verify RED**

Run: `npm run test:run -- src/pages/ReviewPage.test.tsx`

Expected: FAIL because `ReviewPage.tsx` does not exist.

- [ ] **Step 6: Implement full-screen review**

Use `getReviewQueue` on every render so completed or deleted choices cannot repeat. The screen begins with `data-decision="neutral"`; bind drag progress to a CSS custom property `--decision-progress`, green for positive and red for negative. Keyboard decisions commit immediately. After commit, keep the full color for 420 ms, or 0 ms under reduced motion, then show the next queue item. Render a top-left `退出回顾` button and support Escape plus a downward pointer gesture of 100 px. When the queue is empty, show `今天已回顾完` and current textual totals without a score.

- [ ] **Step 7: Run judgment and review tests**

Run: `npm run test:run -- src/gestures/useHorizontalDecision.test.tsx src/components/ChoiceRow.test.tsx src/pages/ReviewPage.test.tsx`

Expected: all pointer, keyboard, color-state, queue, and exit tests PASS.

- [ ] **Step 8: Commit judgment interactions**

```bash
git add src/gestures/useHorizontalDecision.ts src/gestures/useHorizontalDecision.test.tsx src/components/ChoiceRow.tsx src/components/ChoiceRow.test.tsx src/pages/ReviewPage.tsx src/pages/ReviewPage.test.tsx src/pages/TodayPage.tsx
git commit -m "feat: add immersive choice review"
```

---

### Task 5: Pull-and-hold history with permanently read-only days

**Files:**
- Create: `src/gestures/usePullHold.ts`
- Create: `src/pages/HistoryPage.tsx`
- Modify: `src/pages/TodayPage.tsx`
- Test: `src/gestures/usePullHold.test.tsx`
- Test: `src/pages/HistoryPage.test.tsx`

**Interfaces:**
- Produces `usePullHold({ distance: 64, holdMs: 500, enabled, onComplete })` returning `bind`, `pullDistance`, `holding`, and `progress`.
- Produces `HistoryPage({ onExit }): JSX.Element` consuming `Timeline` in `readOnly` mode.

- [ ] **Step 1: Write failing pull-and-hold tests with fake timers**

```tsx
it('opens only after a 64px pull is held for 500ms', () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<PullProbe onComplete={onComplete} />);
  const target = screen.getByTestId('pull-zone');
  fireEvent.pointerDown(target, { pointerId: 1, clientY: 0 });
  fireEvent.pointerMove(target, { pointerId: 1, clientY: 70 });
  vi.advanceTimersByTime(499);
  expect(onComplete).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onComplete).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it('cancels when released before the hold completes', () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<PullProbe onComplete={onComplete} />);
  const target = screen.getByTestId('pull-zone');
  fireEvent.pointerDown(target, { pointerId: 1, clientY: 0 });
  fireEvent.pointerMove(target, { pointerId: 1, clientY: 70 });
  fireEvent.pointerUp(target, { pointerId: 1, clientY: 70 });
  vi.advanceTimersByTime(500);
  expect(onComplete).not.toHaveBeenCalled();
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run pull tests and verify RED**

Run: `npm run test:run -- src/gestures/usePullHold.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement pull recognition and wire Today**

Enable recognition only when `window.scrollY === 0`. Start the hold timer after 64 px downward movement, cancel on upward retreat below 64 px, pointer cancel, pointer up, or loss of top position. `TodayPage` renders pull progress above the date, a one-time sentence `下拉并停留，查看过往`, and an always-available text button `过往`; completing the gesture calls `markHistoryHintSeen()` and `onOpenHistory()`.

- [ ] **Step 4: Write failing read-only history tests**

```tsx
it('folds past days and expands a read-only timeline', async () => {
  renderHistoryWithPastChoices();
  expect(screen.getByRole('button', { name: /2026年9月3日/ })).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(screen.getByRole('button', { name: /2026年9月3日/ }));
  expect(screen.getByText('昨天的选择')).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '编辑' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '状态：未判断' })).toBeDisabled();
});

it('exits through the button and Escape', async () => {
  const onExit = vi.fn();
  renderHistoryWithPastChoices({ onExit });
  await userEvent.click(screen.getByRole('button', { name: '返回今天' }));
  expect(onExit).toHaveBeenCalledOnce();
});
```

- [ ] **Step 5: Run history tests and verify RED**

Run: `npm run test:run -- src/pages/HistoryPage.test.tsx`

Expected: FAIL because `HistoryPage.tsx` does not exist.

- [ ] **Step 6: Implement History**

Group only dates earlier than `editableDate`, newest first. Each collapsed date button displays localized date plus exact counts in the form `2 绿 · 1 红 · 3 未判断`. Expanded content uses `Timeline readOnly`, renders the saved note only when non-empty, and exposes no edit/delete/judgment callbacks. Add `返回今天`, Escape handling, right-swipe exit at 100 px, and one browser-history entry so the browser Back button exits History.

- [ ] **Step 7: Run history tests**

Run: `npm run test:run -- src/gestures/usePullHold.test.tsx src/pages/HistoryPage.test.tsx`

Expected: all pull threshold, cancellation, folding, read-only, and exit tests PASS.

- [ ] **Step 8: Commit History**

```bash
git add src/gestures/usePullHold.ts src/gestures/usePullHold.test.tsx src/pages/HistoryPage.tsx src/pages/HistoryPage.test.tsx src/pages/TodayPage.tsx
git commit -m "feat: add immutable choice history"
```

---

### Task 6: Settings, reminder behavior, and application navigation

**Files:**
- Create: `src/components/SettingsPanel.tsx`
- Create: `src/hooks/useReviewReminder.ts`
- Create: `src/hooks/useReviewReminder.test.tsx`
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Test: `src/components/SettingsPanel.test.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces `SettingsPanel({ onClose }): JSX.Element`.
- Produces `useReviewReminder({ settings, unjudgedCount, now, notify })` returning `{ due, dismissForToday }`.
- Produces `App` surface state `'today' | 'review' | 'history'` with Settings as a dismissible overlay.

- [ ] **Step 1: Write failing reminder tests**

```tsx
it('becomes due at the configured local time when unjudged choices exist', () => {
  const { result } = renderHook(() => useReviewReminder({ settings: enabledAt('21:30'), unjudgedCount: 2, now: () => new Date('2026-09-04T21:30:00+08:00'), notify: vi.fn() }));
  expect(result.current.due).toBe(true);
});

it('stays quiet when disabled, already dismissed, or no choices remain', () => {
  const { result } = renderHook(() => useReviewReminder({ settings: disabledAt('21:30'), unjudgedCount: 0, now: () => new Date('2026-09-04T22:00:00+08:00'), notify: vi.fn() }));
  expect(result.current.due).toBe(false);
});
```

- [ ] **Step 2: Run reminder tests and verify RED**

Run: `npm run test:run -- src/hooks/useReviewReminder.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement reminder calculation**

Compare local `HH:mm` with `settings.reviewTime` every 30 seconds and on visibility changes. Keep the dismissed local date in session state so dismissal lasts until the next day. Call `notify('该回顾今天的选择了')` once per date only when permission is granted. The hook never calls `Notification.requestPermission()`.

- [ ] **Step 4: Write failing settings tests**

```tsx
it('changes review time and disables reminders', async () => {
  renderSettings();
  await userEvent.clear(screen.getByLabelText('每日回顾时间'));
  await userEvent.type(screen.getByLabelText('每日回顾时间'), '20:45');
  fireEvent.change(screen.getByLabelText('每日回顾时间'));
  await userEvent.click(screen.getByRole('switch', { name: '回顾提醒' }));
  expect(readSettings()).toMatchObject({ reviewTime: '20:45', reminderEnabled: false });
});

it('requests notification permission only after the user enables browser notification', async () => {
  const requestPermission = vi.fn().mockResolvedValue('granted');
  renderSettings({ requestPermission });
  expect(requestPermission).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '开启浏览器通知' }));
  expect(requestPermission).toHaveBeenCalledOnce();
});
```

- [ ] **Step 5: Run settings tests and verify RED**

Run: `npm run test:run -- src/components/SettingsPanel.test.tsx`

Expected: FAIL because `SettingsPanel.tsx` does not exist.

- [ ] **Step 6: Implement settings and notification states**

Show only review time, reminder switch, and browser notification control. If Notification is unavailable, show `此浏览器不支持通知`; if denied, show `通知已被浏览器阻止`; do not request again. Close via `关闭设置`, Escape, or clicking the overlay outside the panel. Update context immediately on valid time changes.

- [ ] **Step 7: Write and implement App navigation tests**

Test that App starts on Today, opens Review and History from their buttons, returns with Escape, displays Settings as an overlay without losing Today state, and shows the due reminder with actions `开始回顾` and `今天稍后再说`. Then implement `App.tsx` using local surface state and stable callbacks; mount it through `main.tsx` inside `OptProvider`.

Run: `npm run test:run -- src/hooks/useReviewReminder.test.tsx src/components/SettingsPanel.test.tsx src/App.test.tsx`

Expected: all reminder, permission, and navigation tests PASS.

- [ ] **Step 8: Commit reminders and navigation**

```bash
git add src/hooks src/components/SettingsPanel.tsx src/components/SettingsPanel.test.tsx src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "feat: add review reminders and settings"
```

---

### Task 7: Distinctive visual system, responsiveness, and accessibility

**Files:**
- Create: `src/styles.css`
- Modify: `src/App.tsx`
- Modify: `src/components/ChoiceComposer.tsx`
- Modify: `src/components/ChoiceRow.tsx`
- Modify: `src/components/RatioBar.tsx`
- Modify: `src/pages/ReviewPage.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes existing semantic markup and `data-decision`, drag-progress, and surface attributes.
- Produces no new public TypeScript API; visual behavior is expressed with tokens and existing state attributes.

- [ ] **Step 1: Add failing accessibility assertions**

Extend `src/App.test.tsx` to assert that the app has one level-one heading, each status includes readable text, the review screen has an `aria-live="polite"` choice region, disabled historical statuses remain named, and all icon-only buttons have accessible names.

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL on the newly required semantics before styling work begins.

- [ ] **Step 2: Implement the design token layer and page composition**

Define tokens `--paper: #F4F4F1`, `--ink: #171816`, `--muted`, `--line`, `--green: #20C873`, `--red: #F04444`, `--review-neutral: #10110F`, spacing on a 4/8 px scale, and system font stack `"Segoe UI Variable", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`. Keep the Today content width at 760 px, place time/content/status in a disciplined grid, remove card shadows and decorative containers, and render `opt.` as the only brand mark.

- [ ] **Step 3: Implement interaction and review visuals**

Use `touch-action: pan-y` for horizontal decision rows and `touch-action: none` only on the full review surface. Blend Review background from neutral toward green/red based on `--decision-progress`; after commit set the exact solid color. Keep choice text centered with a maximum width of 18 Chinese characters per visual line and show time beneath. The exit control remains high-contrast at top left.

- [ ] **Step 4: Implement responsive, focus, and reduced-motion rules**

At widths under 640 px, move time above content while keeping the status target at least 44×44 px. Use `:focus-visible` outlines with a 3 px ink/white contrast ring. Under `@media (prefers-reduced-motion: reduce)`, set transition and animation durations to `0.01ms`, remove transforms after decisions, and preserve color changes. Ensure the ratio bar includes hidden text labels and is never the sole status representation.

- [ ] **Step 5: Run component tests and production build**

Run: `npm run test:run`

Expected: all unit/component tests PASS without warnings.

Run: `npm run build`

Expected: Vite creates `dist/` and TypeScript reports no errors.

- [ ] **Step 6: Commit the visual system**

```bash
git add src/styles.css src/App.tsx src/components src/pages/ReviewPage.tsx src/App.test.tsx
git commit -m "feat: apply opt visual system"
```

---

### Task 8: Browser-level verification and user documentation

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/opt.spec.ts`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes the built app and public user interactions only.
- Produces repeatable cross-viewport browser acceptance tests and exact local run instructions.

- [ ] **Step 1: Write failing end-to-end workflows**

```ts
// e2e/opt.spec.ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('records, judges, reloads, and restores a choice', async ({ page }) => {
  await page.getByRole('textbox', { name: '记录此刻的选择' }).fill('躺在床上玩手机');
  await page.getByRole('textbox', { name: '记录此刻的选择' }).press('Enter');
  await page.getByText('躺在床上玩手机').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: '状态：红色' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('躺在床上玩手机')).toBeVisible();
});

test('reviews unjudged choices full-screen and exits', async ({ page }) => {
  for (const text of ['第一条', '第二条']) {
    await page.getByRole('textbox', { name: '记录此刻的选择' }).fill(text);
    await page.getByRole('textbox', { name: '记录此刻的选择' }).press('Enter');
  }
  await page.getByRole('button', { name: '开始回顾' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('review-screen')).toHaveAttribute('data-decision', 'green');
  await expect(page.getByRole('heading', { name: '第二条' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: '记录此刻的选择' })).toBeVisible();
});
```

Add a seeded historical-data test that inserts a prior-day `OptData` JSON value, enters via the `过往` fallback button, expands the date, and proves edit/judgment controls are disabled. Add desktop 1280×800 and mobile 390×844 projects in `playwright.config.ts`.

- [ ] **Step 2: Run end-to-end tests and verify RED**

Run: `npm run test:e2e`

Expected: at least one workflow fails until selectors, timing, or integration behavior is aligned with the browser.

- [ ] **Step 3: Make only integration corrections required by the failing workflows**

Correct production selectors, focus ownership, gesture timing, and browser-history behavior revealed by the failures. Do not weaken assertions or add features outside the design spec.

- [ ] **Step 4: Document exact use and limitations**

`README.md` must include commands `npm install`, `npm run dev`, `npm run build`, `npm run test:run`, and `npm run test:e2e`; explain that data lives only in the current browser's Local Storage, clearing site data removes it, ordinary browser notifications may not fire when the page is closed, past dates cannot be changed, and the first release is a Web MVP rather than a Windows installer.

- [ ] **Step 5: Run the full verification matrix**

Run: `npm run check`

Expected: exit code 0.

Run: `npm run test:run`

Expected: every Vitest test PASS with no warnings.

Run: `npm run build`

Expected: production bundle succeeds and `dist/index.html` exists.

Run: `npm run test:e2e`

Expected: desktop and mobile Playwright projects PASS.

- [ ] **Step 6: Commit verification and documentation**

```bash
git add playwright.config.ts e2e/opt.spec.ts README.md package.json package-lock.json src
git commit -m "test: verify opt MVP workflows"
```

---

## Final Manual Acceptance

- Open the app in a Windows browser and confirm the composer receives focus immediately.
- Add choices rapidly and confirm each appears once with local time and no extra fields.
- Judge a row in both directions with mouse and keyboard; clear a status by clicking its marker.
- Enter Review and confirm neutral → saturated red/green → next-choice behavior fills the viewport.
- Exit Review with the visible button, downward gesture, and Escape.
- Pull from the top, hold for 500 ms, and confirm History opens; verify the fallback text button also opens it.
- Expand a past day and verify text, note, and status are visible but immutable.
- Change review time, disable reminders, and verify notification permission is requested only by the explicit notification button.
- Reload the browser and confirm choices, judgments, note, and settings persist.
- Enable reduced motion in Windows/browser settings and confirm no required meaning is lost.
