import { expect, test, type Page } from '@playwright/test';

/**
 * Natural 1x workday. Does not call closeNow, tick, advanceJob, or teleport.
 * Observation of getState() is read-only primitives.
 */
test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

type DaySnapshot = {
	day: number;
	dayClosed: boolean;
	paused: boolean;
	tick: number;
	speed: number;
	pay: number;
	roleId: string;
	status: string;
	stage: string;
	progress: number;
	ticksSpent: number;
	logs: Array<{
		day: number;
		payEarned: number;
		closedClock: string;
		tasks: Array<{ title: string; status: string; pay: number }>;
		unfinished: Array<{ title: string; stage: string; progress: number }>;
	}>;
};

async function guestBoot(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', 'light');
		(window as Window & { __qingxinE2E?: boolean }).__qingxinE2E = true;
	});
}

async function snapshot(page: Page): Promise<DaySnapshot | null> {
	return page.evaluate(() => {
		const hook = (
			window as Window & {
				__qingxinShangban?: {
					getState: () => {
						day: number;
						dayClosed: boolean;
						paused: boolean;
						tick: number;
						speed: number;
						player: { pay: number; roleId: string };
						tasks: Array<{
							status: string;
							stage?: string;
							progress?: number;
							ticksSpent?: number;
							roleId: string;
						}>;
						logs: Array<{
							day: number;
							payEarned: number;
							closedClock: string;
							tasks: Array<{ title: string; status: string; pay: number }>;
							unfinished: Array<{ title: string; stage: string; progress: number }>;
						}>;
					};
					closeNow?: () => void;
					tick?: (n: number) => void;
					advanceJob?: (n: number) => void;
				};
			}
		).__qingxinShangban;
		const world = hook?.getState();
		if (!world) return null;
		const active = world.tasks.find(
			(task) => task.status === 'active' && task.roleId === world.player.roleId
		);
		return {
			day: world.day,
			dayClosed: world.dayClosed,
			paused: world.paused,
			tick: world.tick,
			speed: world.speed,
			pay: world.player.pay,
			roleId: world.player.roleId,
			status: active?.status ?? '',
			stage: active?.stage ?? '',
			progress: active?.progress ?? 0,
			ticksSpent: active?.ticksSpent ?? 0,
			logs: world.logs.map((entry) => ({
				day: entry.day,
				payEarned: entry.payEarned,
				closedClock: entry.closedClock,
				tasks: entry.tasks.map((row) => ({
					title: row.title,
					status: row.status,
					pay: row.pay
				})),
				unfinished: entry.unfinished.map((row) => ({
					title: row.title,
					stage: row.stage,
					progress: row.progress
				}))
			}))
		};
	});
}

async function clickVisible(page: Page, name: string | RegExp) {
	const button = page.getByRole('button', { name });
	await expect(button.first()).toBeVisible({ timeout: 20_000 });
	await button.first().click({ timeout: 15_000 });
}

async function clickExact(page: Page, name: string) {
	const button = page.getByRole('button', { name, exact: true });
	await expect(button).toBeVisible({ timeout: 20_000 });
	await button.click({ timeout: 15_000 });
}

async function waitPathClear(page: Page) {
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-path', '0', {
		timeout: 20_000
	});
}

test('natural 1x day closes once from the animation loop and carries unfinished work', async ({
	page
}) => {
	test.setTimeout(240_000);
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => {
		pageErrors.push(error.message);
	});
	page.on('console', (msg) => {
		if (msg.type() === 'error') pageErrors.push(msg.text());
	});
	await page.setViewportSize({ width: 1280, height: 800 });
	await guestBoot(page);
	const wallStart = Date.now();
	await page.goto('/modules/shangban', { waitUntil: 'networkidle' });
	await expect(page.locator('[data-shangban="1"]')).toBeVisible();
	await expect(page.locator('canvas[aria-label="轻心大厦"]')).toHaveAttribute('data-ready', '1', {
		timeout: 20_000
	});
	await expect(page.getByRole('button', { name: '接这单' })).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-closed', '0');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-day', '1');

	await expect(page.getByRole('button', { name: '1x' })).toBeVisible();
	await expect(page.getByRole('button', { name: '2x' })).toBeVisible();
	await expect(page.getByRole('button', { name: '3x' })).toBeVisible();
	await clickVisible(page, '2x');
	await expect(page.getByRole('button', { name: '2x' })).toHaveClass(/on/);
	await clickVisible(page, '1x');
	await expect(page.getByRole('button', { name: '1x' })).toHaveClass(/on/);
	await expect.poll(async () => (await snapshot(page))?.speed ?? 0).toBe(1);
	await clickVisible(page, '暂停');
	await expect(page.locator('.overlay').getByRole('button', { name: '继续' })).toBeVisible();
	await page.locator('.overlay').getByRole('button', { name: '继续' }).click();
	await expect(page.locator('.overlay').getByRole('button', { name: '继续' })).toHaveCount(0);

	const payBefore = Number(
		(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
	);
	await clickVisible(page, '接这单');
	await clickExact(page, '到货口');
	await waitPathClear(page);
	const begin = page.getByRole('button', { name: '开始干活' });
	if (await begin.isVisible().catch(() => false)) {
		await begin.click();
	}
	await expect
		.poll(
			async () =>
				Number((await page.locator('[data-shangban="1"]').getAttribute('data-progress')) ?? '0'),
			{ timeout: 20_000 }
		)
		.toBeGreaterThanOrEqual(100);
	const root = page.locator('[data-shangban="1"]');
	await clickExact(page, '提起 / 放下');
	await expect(root).toHaveAttribute('data-carry', /.+/, { timeout: 12_000 });
	await expect(root).toHaveAttribute('data-dest', /[ABC]/, { timeout: 12_000 });
	const dest = await root.getAttribute('data-dest');
	if (!dest) throw new Error('missing dest');
	await clickExact(page, `${dest}口`);
	await waitPathClear(page);
	const stillCarrying = Boolean(await root.getAttribute('data-carry'));
	if (stillCarrying) {
		await clickExact(page, '提起 / 放下');
	}
	await expect(page.locator('.notice')).toContainText(/分拣完成/, { timeout: 20_000 });
	await expect
		.poll(
			async () =>
				Number((await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'),
			{
				timeout: 15_000
			}
		)
		.toBeGreaterThan(payBefore);
	const earnedPay = Number(
		(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
	);
	await page.screenshot({ path: 'screenshots/shangban-natural-job-done-1280.png' });

	await clickVisible(page, '换岗');
	const roster = page.getByRole('dialog', { name: '换岗' });
	await expect(roster).toBeVisible();
	await roster.getByRole('button', { name: /产品工程师/ }).click();
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'engineer');
	await clickVisible(page, '电梯');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-elevator', '1', {
		timeout: 15_000
	});
	await clickVisible(page, /3F 产品与技术/);
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-floor', '3', {
		timeout: 15_000
	});
	await expect(page.getByRole('button', { name: '接这单' })).toBeVisible({ timeout: 20_000 });
	await clickVisible(page, '接这单');
	await clickExact(page, '测试台');
	await waitPathClear(page);
	if (
		await page
			.getByRole('button', { name: '开始干活' })
			.isVisible()
			.catch(() => false)
	) {
		await clickVisible(page, '开始干活');
	}
	await clickVisible(page, '写测试');
	await expect
		.poll(
			async () =>
				Number((await page.locator('[data-shangban="1"]').getAttribute('data-progress')) ?? '0'),
			{ timeout: 20_000 }
		)
		.toBeGreaterThanOrEqual(20);
	const mid = await snapshot(page);
	expect(mid?.roleId).toBe('engineer');
	expect(mid?.ticksSpent).toBeGreaterThan(0);
	expect(mid?.ticksSpent).toBeLessThan(180);
	await page.screenshot({ path: 'screenshots/shangban-natural-long-job-1280.png' });

	await clickVisible(page, '换岗');
	await page
		.getByRole('dialog', { name: '换岗' })
		.getByRole('button', { name: /销售顾问/ })
		.click();
	const drop = page.getByRole('dialog', { name: '放下这单' });
	await expect(drop).toBeVisible();
	await drop.getByRole('button', { name: '先做完' }).click();
	await expect(drop).toHaveCount(0);
	await page.getByRole('dialog', { name: '换岗' }).getByRole('button', { name: '关上' }).click();
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'engineer');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-status', 'active');
	const afterRefuse = await snapshot(page);
	expect(afterRefuse?.ticksSpent).toBeGreaterThanOrEqual(mid?.ticksSpent ?? 0);
	await page.screenshot({ path: 'screenshots/shangban-natural-role-keep-1280.png' });

	await clickExact(page, '休息椅');
	await waitPathClear(page);
	const pausedProgress = Number(
		(await page.locator('[data-shangban="1"]').getAttribute('data-progress')) ?? '0'
	);
	await page.waitForTimeout(2500);
	const stillPaused = Number(
		(await page.locator('[data-shangban="1"]').getAttribute('data-progress')) ?? '0'
	);
	expect(stillPaused).toBe(pausedProgress);

	const beforeClose = await snapshot(page);
	console.log('[natural-day] waiting for 18:00', {
		elapsedMs: Date.now() - wallStart,
		tick: beforeClose?.tick,
		progress: stillPaused
	});
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-closed', '1', {
		timeout: 110_000
	});
	const closeElapsed = Date.now() - wallStart;
	console.log('[natural-day] closed after', closeElapsed, 'ms');
	expect(closeElapsed).toBeGreaterThan(50_000);
	await expect(page.getByRole('dialog', { name: '收工' })).toBeVisible();
	await expect(page.locator('[data-shangban-close]')).toContainText(/第1天收工/);
	const closed = await snapshot(page);
	expect(closed?.dayClosed).toBe(true);
	expect(closed?.day).toBe(1);
	expect(closed?.logs).toHaveLength(1);
	expect(closed?.logs[0]?.payEarned).toBe(earnedPay);
	expect(closed?.logs[0]?.closedClock).toBe('18:00');
	expect(closed?.logs[0]?.tasks.some((row) => row.status === 'done' && row.pay === earnedPay)).toBe(
		true
	);
	expect(closed?.logs[0]?.unfinished.length).toBeGreaterThan(0);
	expect(closed?.logs[0]?.unfinished[0]?.progress).toBeGreaterThan(0);
	expect(pageErrors.filter((text) => /each_key_duplicate|Internal Error/i.test(text))).toEqual([]);
	await page.screenshot({ path: 'screenshots/shangban-natural-close-1280.png' });

	await page.waitForTimeout(8000);
	const waited = await snapshot(page);
	expect(waited?.dayClosed).toBe(true);
	expect(waited?.day).toBe(1);
	expect(waited?.logs).toHaveLength(1);
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-day', '1');
	await expect(page.locator('[data-shangban-log]')).toContainText(/第1天/);
	await expect(page.locator('[data-shangban-log]')).toContainText(new RegExp(`¥${earnedPay}`));
	await page.screenshot({ path: 'screenshots/shangban-natural-log-wait-1280.png' });

	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.locator('[data-shangban="1"]')).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('canvas[aria-label="轻心大厦"]')).toHaveAttribute('data-ready', '1', {
		timeout: 20_000
	});
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-closed', '1');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-day', '1');
	await expect(page.getByRole('dialog', { name: '收工' })).toBeVisible();
	const reloaded = await snapshot(page);
	expect(reloaded?.dayClosed).toBe(true);
	expect(reloaded?.paused).toBe(true);
	expect(reloaded?.logs).toHaveLength(1);
	expect(reloaded?.logs[0]?.payEarned).toBe(earnedPay);
	expect(reloaded?.status).toBe('active');
	await page.screenshot({ path: 'screenshots/shangban-natural-reload-close-1280.png' });

	await clickVisible(page, '下一天');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-day', '2');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-closed', '0');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'engineer');
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-status', 'active');
	const next = await snapshot(page);
	expect(next?.day).toBe(2);
	expect(next?.dayClosed).toBe(false);
	expect(next?.pay).toBe(earnedPay);
	expect(next?.ticksSpent).toBeGreaterThan(0);
	expect(next?.progress).toBeGreaterThan(0);
	expect(next?.logs).toHaveLength(1);
	await clickVisible(page, '测试台');
	await waitPathClear(page);
	if (
		await page
			.getByRole('button', { name: '开始干活' })
			.isVisible()
			.catch(() => false)
	) {
		await clickVisible(page, '开始干活');
	}
	await expect
		.poll(
			async () =>
				Number((await page.locator('[data-shangban="1"]').getAttribute('data-progress')) ?? '0'),
			{ timeout: 25_000 }
		)
		.toBeGreaterThan(stillPaused);
	await page.screenshot({ path: 'screenshots/shangban-natural-nextday-carry-1280.png' });
	console.log('[natural-day] durations', {
		courierTicks: 48,
		engineerTicks: 180,
		dayTicks: 720,
		courierRealSec: 4.8,
		engineerRealSec: 18,
		dayRealSec: 72,
		wallMs: Date.now() - wallStart,
		carriedTicks: next?.ticksSpent
	});
});
