import { expect, test, type Page, type TestInfo } from '@playwright/test';

const STORAGE_KEY = 'opt:data';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('records, judges, clears, reloads, and restores a choice', async ({ page }, testInfo) => {
  const composer = page.getByRole('textbox', { name: '记录此刻的选择' });
  await expect(composer).toBeFocused();
  await recordChoice(page, '躺在床上玩手机');

  const row = page.locator('article').filter({ hasText: '躺在床上玩手机' });
  await dragHorizontally(page, row, -36, testInfo);
  await expect(row.getByRole('button', { name: '状态：未判断' })).toBeVisible();
  await dragHorizontally(page, row, -90, testInfo);
  await expect(row.getByRole('button', { name: '状态：红色' })).toBeVisible();
  await row.getByRole('button', { name: '状态：红色' }).click();
  await expect(row.getByRole('button', { name: '状态：未判断' })).toBeVisible();

  await row.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(row.getByRole('button', { name: '状态：红色' })).toBeVisible();

  await page.getByRole('button', { name: '今日随记' }).click();
  await page.getByRole('textbox', { name: '今日随记内容' }).fill('记住当时的感受');
  await page.getByRole('heading', { name: '今天' }).click();

  await page.reload();
  const restoredRow = page
    .locator('article')
    .filter({ hasText: '躺在床上玩手机' });
  await expect(restoredRow).toBeVisible();
  await expect(
    restoredRow.getByRole('button', { name: '状态：红色' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '今日随记' }).click();
  await expect(page.getByRole('textbox', { name: '今日随记内容' })).toHaveValue(
    '记住当时的感受',
  );
});

test('reviews unjudged choices full-screen and exits', async ({ page }) => {
  await recordChoice(page, '第一条');
  await recordChoice(page, '第二条');

  await page.getByRole('button', { name: '开始回顾' }).click();
  const review = page.getByTestId('review-screen');
  await expect(review).toHaveAttribute('data-decision', 'neutral');
  await expect(review).toHaveCSS('background-color', 'rgb(16, 17, 15)');
  const viewport = page.viewportSize();
  const reviewBox = await review.boundingBox();
  expect(reviewBox).not.toBeNull();
  expect(reviewBox?.x).toBe(0);
  expect(reviewBox?.y).toBe(0);
  expect(reviewBox?.width).toBe(viewport?.width);
  expect(reviewBox?.height).toBeGreaterThanOrEqual(viewport?.height ?? 0);
  await expect(page.getByRole('button', { name: '退出回顾' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '第一条' })).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(review).toHaveAttribute('data-decision', 'green');
  await expect(review).toHaveCSS('background-color', 'rgb(32, 200, 115)');
  await expect(page.getByRole('heading', { name: '第二条' })).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(review).toHaveAttribute('data-decision', 'red');
  await expect(review).toHaveCSS('background-color', 'rgb(240, 68, 68)');

  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('textbox', { name: '记录此刻的选择' }),
  ).toBeVisible();
});

test('exits after the final review choice has been judged', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordChoice(page, '最后一条选择');

  await page.getByRole('button', { name: '开始回顾' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: '今天已回顾完' })).toBeVisible();

  await page.getByRole('button', { name: '退出回顾' }).click();
  await expect(
    page.getByRole('textbox', { name: '记录此刻的选择' }),
  ).toBeVisible();
});

test('review honors reduced motion and exits with a downward gesture', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordChoice(page, '减弱动画第一条');
  await recordChoice(page, '减弱动画第二条');
  await page.getByRole('button', { name: '开始回顾' }).click();

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: '减弱动画第二条' })).toBeVisible();
  await expect(page.getByTestId('review-screen')).toHaveAttribute(
    'data-decision',
    'neutral',
  );

  await dragVertically(page, page.getByTestId('review-screen'), 130, testInfo);
  await expect(
    page.getByRole('textbox', { name: '记录此刻的选择' }),
  ).toBeVisible();
});

test('opens seeded history by pull-and-hold and keeps it immutable', async ({ page }, testInfo) => {
  const pastDate = await page.evaluate(() => {
    const now = new Date();
    const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const dateKey = [
      past.getFullYear(),
      String(past.getMonth() + 1).padStart(2, '0'),
      String(past.getDate()).padStart(2, '0'),
    ].join('-');
    const todayKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const occurredAt = new Date(
      past.getFullYear(),
      past.getMonth(),
      past.getDate(),
      8,
      30,
    ).toISOString();
    localStorage.setItem(
      'opt:data',
      JSON.stringify({
        version: 1,
        choices: [
          {
            id: 'seeded-past-choice',
            text: '昨天的选择',
            occurredAt,
            localDate: dateKey,
            status: 'unjudged',
            judgedAt: null,
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
        ],
        days: {
          [dateKey]: { localDate: dateKey, note: '昨天的随记' },
        },
        settings: {
          reviewTime: '21:30',
          reminderEnabled: true,
          notificationPreference: 'default',
          historyHintSeen: true,
          latestSeenDate: todayKey,
        },
      }),
    );
    return dateKey;
  });
  await page.reload();

  await pullAndHold(page, page.getByTestId('history-pull-zone'), testInfo);
  await expect(page.getByRole('heading', { name: '过往' })).toBeVisible();
  const dayButton = page.getByRole('button', {
    name: new RegExp(`${Number(pastDate.slice(5, 7))}月${Number(pastDate.slice(8))}日`),
  });
  await expect(dayButton).toHaveAttribute('aria-expanded', 'false');
  await dayButton.click();

  const historicalRow = page.locator('article').filter({ hasText: '昨天的选择' });
  await expect(historicalRow).toBeVisible();
  await expect(
    historicalRow.getByRole('button', { name: '状态：未判断' }),
  ).toBeDisabled();
  await expect(historicalRow).not.toHaveAttribute('tabindex');
  await expect(page.getByText('昨天的随记')).toBeVisible();
  const storageBefore = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await historicalRow.click({ button: 'right' });
  await dragHorizontally(page, historicalRow, -100, testInfo);
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await expect(
    historicalRow.getByRole('button', { name: '状态：未判断' }),
  ).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
    storageBefore,
  );

  await dragHorizontally(page, page.getByTestId('history-page'), 130, testInfo);
  await expect(page.getByRole('heading', { name: '今天' })).toBeVisible();

  await page.getByRole('button', { name: '过往', exact: true }).click();
  await expect(page.getByRole('heading', { name: '过往' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '今天' })).toBeVisible();
});

test('updates settings and restores them after reload', async ({ page }) => {
  await page.getByRole('button', { name: '设置' }).click();
  const dialog = page.getByRole('dialog', { name: '设置' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('每日回顾时间').fill('20:45');
  const reminder = dialog.getByRole('switch', { name: /回顾提醒/ });
  await expect(reminder).toHaveAttribute('aria-checked', 'true');
  await reminder.click();
  await expect(reminder).toHaveAttribute('aria-checked', 'false');
  await expect(
    dialog.getByRole('button', { name: '开启浏览器通知' }),
  ).toBeVisible();

  await dialog.getByRole('button', { name: '关闭设置' }).click();
  await page.reload();
  await page.getByRole('button', { name: '设置' }).click();
  const restoredDialog = page.getByRole('dialog', { name: '设置' });
  await expect(restoredDialog.getByLabel('每日回顾时间')).toHaveValue('20:45');
  await expect(
    restoredDialog.getByRole('switch', { name: /回顾提醒/ }),
  ).toHaveAttribute('aria-checked', 'false');

  const storedSettings = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).settings : null;
  }, STORAGE_KEY);
  expect(storedSettings).toMatchObject({
    reviewTime: '20:45',
    reminderEnabled: false,
  });
});

test('requests notifications only after explicit action and persists granted state', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__notificationRequests', {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: class FakeNotification {
        static permission = 'default';
        static async requestPermission() {
          (window as typeof window & { __notificationRequests: number })
            .__notificationRequests += 1;
          FakeNotification.permission = 'granted';
          return 'granted';
        }
      },
    });
  });
  await page.reload();
  await expect.poll(() => notificationRequestCount(page)).toBe(0);

  await page.getByRole('button', { name: '设置' }).click();
  await expect.poll(() => notificationRequestCount(page)).toBe(0);
  await page.getByRole('button', { name: '开启浏览器通知' }).click();
  await expect.poll(() => notificationRequestCount(page)).toBe(1);
  await expect(page.getByText('浏览器通知已开启')).toBeVisible();
  const preference = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).settings.notificationPreference : null;
  }, STORAGE_KEY);
  expect(preference).toBe('granted');
});

test('shows denied and unsupported notification states without requesting', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: class DeniedNotification {
        static permission = 'denied';
        static async requestPermission() {
          throw new Error('requestPermission must not be called');
        }
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByText('通知已被浏览器阻止')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '开启浏览器通知' }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: '关闭设置' }).click();
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'Notification');
  });
  await page.reload();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByText('此浏览器不支持通知')).toBeVisible();
});

async function recordChoice(page: Page, text: string) {
  const composer = page.getByRole('textbox', { name: '记录此刻的选择' });
  await composer.fill(text);
  await composer.press('Enter');
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

async function notificationRequestCount(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __notificationRequests?: number })
        .__notificationRequests ?? 0,
  );
}

async function dragHorizontally(
  page: Page,
  target: ReturnType<Page['locator']>,
  distance: number,
  testInfo: TestInfo,
) {
  await drag(page, target, distance, 0, testInfo);
}

async function dragVertically(
  page: Page,
  target: ReturnType<Page['locator']>,
  distance: number,
  testInfo: TestInfo,
) {
  await drag(page, target, 0, distance, testInfo);
}

async function drag(
  page: Page,
  target: ReturnType<Page['locator']>,
  deltaX: number,
  deltaY: number,
  testInfo: TestInfo,
) {
  const box = await target.boundingBox();
  if (!box) throw new Error('Drag target has no bounding box');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const endX = startX + deltaX;
  const endY = startY + deltaY;
  if (testInfo.project.name.startsWith('mobile')) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: endX, y: endY }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
    return;
  }
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 4 });
  await page.mouse.up();
}

async function pullAndHold(
  page: Page,
  target: ReturnType<Page['locator']>,
  testInfo: TestInfo,
) {
  const box = await target.boundingBox();
  if (!box) throw new Error('Pull target has no bounding box');
  const startX = box.x + box.width / 2;
  const startY = box.y + Math.min(box.height / 2, 30);
  const endY = startY + 72;
  if (testInfo.project.name.startsWith('mobile')) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: endY }],
    });
    await page.waitForTimeout(550);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
    return;
  }
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, endY, { steps: 4 });
  await page.waitForTimeout(550);
  await page.mouse.up();
}
