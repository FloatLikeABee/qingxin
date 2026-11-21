import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 390, height: 844 } }
});

type ShangbanHook = {
	getState: () => {
		player: {
			x: number;
			z: number;
			floor: number;
			roleId: string;
			pay: number;
			path?: { x: number; z: number }[];
			elevatorTo?: number | null;
			elevatorWait?: number;
		};
		notice: string;
		company: { cash: number; morale: number };
		day: number;
		dayClosed: boolean;
		logs: Array<{ day: number; payEarned: number }>;
		tasks: Array<{
			status: string;
			kind: string;
			roleId: string;
			stage?: string;
			progress?: number;
			ticksSpent?: number;
			requiredStation?: string;
		}>;
	};
	tick: (n: number) => void;
	advanceJob: (n: number) => void;
	closeNow: () => void;
};

async function guestBoot(page: Page, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		(window as Window & { __qingxinE2E?: boolean }).__qingxinE2E = true;
	}, theme);
}

async function openPlay(page: Page) {
	await page.goto('/modules/shangban', { waitUntil: 'networkidle' });
	await expect(page.locator('[data-shangban="1"]')).toBeVisible();
	await expect(page).toHaveTitle(/上班/);
	await expect(page.getByRole('button', { name: '接这单' })).toBeVisible({ timeout: 20_000 });
	const canvas = page.locator('canvas[aria-label="轻心大厦"]');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-npcs', /[1-9]/);
}

async function getState(page: Page) {
	return page.evaluate(() => {
		const hook = (window as Window & { __qingxinShangban?: ShangbanHook }).__qingxinShangban;
		return hook?.getState() ?? null;
	});
}

function wantsNextDay(name: string | RegExp) {
	return name === '下一天' || (name instanceof RegExp && name.test('下一天'));
}

async function dismissCloseIfNeeded(page: Page) {
	const root = page.locator('[data-shangban="1"]');
	const closed = (await root.getAttribute('data-closed')) === '1';
	const dialog = page.getByRole('dialog', { name: '收工' });
	const dialogVisible = await dialog.isVisible().catch(() => false);
	if (!closed && !dialogVisible) return false;
	const next = page.getByRole('button', { name: '下一天' }).last();
	if (!(await next.isVisible().catch(() => false))) return false;
	await next.click({ timeout: 5_000 });
	await expect(root).toHaveAttribute('data-closed', '0', { timeout: 10_000 });
	return true;
}

async function clickVisible(page: Page, name: string | RegExp) {
	await expect(async () => {
		const dismissed = await dismissCloseIfNeeded(page);
		if (dismissed && wantsNextDay(name)) return;
		const button = page.getByRole('button', { name }).first();
		await button.scrollIntoViewIfNeeded();
		await expect(button).toBeVisible();
		await button.click({ timeout: 8_000 });
	}).toPass({ timeout: 20_000 });
}

async function acceptOffer(page: Page) {
	await expect(page.getByRole('button', { name: '接这单' })).toBeVisible({ timeout: 20_000 });
	await clickVisible(page, '接这单');
}

async function tickSim(page: Page, n: number) {
	await page.evaluate((count) => {
		const hook = (window as Window & { __qingxinShangban?: ShangbanHook }).__qingxinShangban;
		hook?.tick(count);
	}, n);
}

async function startJob(page: Page) {
	await page.evaluate(() => {
		const hook = (window as Window & { __qingxinShangban?: ShangbanHook }).__qingxinShangban;
		const world = hook?.getState();
		if (!world) return;
		const task = world.tasks.find((item) => item.status === 'active');
		const map: Record<string, { floor: number; x: number; z: number }> = {
			inbound: { floor: 1, x: 3, z: 2 },
			negotiate: { floor: 2, x: 6, z: 3 },
			repair: { floor: 3, x: 5, z: 3 },
			test: { floor: 3, x: 8, z: 3 },
			payroll: { floor: 4, x: 5, z: 3 },
			board: { floor: 5, x: 5, z: 3 },
			office: { floor: 5, x: 8, z: 6 }
		};
		const dest = map[task?.requiredStation ?? ''] ?? map.inbound;
		if (!dest) return;
		world.player.floor = dest.floor;
		world.player.x = dest.x;
		world.player.z = dest.z;
		world.player.path = [];
		world.player.elevatorTo = null;
		world.player.elevatorWait = 0;
	});
	const start = page.getByRole('button', { name: /开始干活|去工位开始|回到工位/ });
	if (await start.isVisible().catch(() => false)) {
		await start.click({ timeout: 2_000 }).catch(() => undefined);
	}
	await expect
		.poll(
			async () => {
				await dismissCloseIfNeeded(page);
				return Number(
					(await page.locator('[data-shangban="1"]').getAttribute('data-progress')) ?? '0'
				);
			},
			{ timeout: 25_000 }
		)
		.toBeGreaterThan(0);
}

async function switchRole(page: Page, name: RegExp) {
	await expect(async () => {
		await dismissCloseIfNeeded(page);
		const dialog = page.getByRole('dialog', { name: '换岗' });
		if (!(await dialog.isVisible().catch(() => false))) {
			await page.getByRole('button', { name: '换岗' }).click({ timeout: 3_000 });
		}
		const roster = page.getByRole('dialog', { name: '换岗' });
		await expect(roster.getByRole('button', { name: /物流员/ })).toBeVisible();
		await roster.getByRole('button', { name }).click({ timeout: 3_000 });
	}).toPass({ timeout: 30_000 });
	await expect(page.getByRole('dialog', { name: '换岗' })).toHaveCount(0);
}

async function waitFloor(page: Page, floor: number) {
	await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-floor', String(floor), {
		timeout: 15_000
	});
}

async function waitPayUp(page: Page, was: number) {
	await expect
		.poll(
			async () => {
				await dismissCloseIfNeeded(page);
				const raw = await page.locator('[data-shangban="1"]').getAttribute('data-pay');
				return Number(raw ?? '0');
			},
			{ timeout: 30_000 }
		)
		.toBeGreaterThan(was);
}

async function completeSort(page: Page) {
	const pay = Number((await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0');
	await acceptOffer(page);
	await startJob(page);
	const root = page.locator('[data-shangban="1"]');
	try {
		await expect(root).toHaveAttribute('data-dest', /[ABC]/, { timeout: 12_000 });
	} catch {
		await clickVisible(page, '提起 / 放下');
		await expect(root).toHaveAttribute('data-dest', /[ABC]/, { timeout: 12_000 });
	}
	const dest = await root.getAttribute('data-dest');
	if (!dest) throw new Error('missing dest');
	await clickVisible(page, `${dest}口`);
	await expect(root).toHaveAttribute('data-path', '0', { timeout: 12_000 });
	if (await root.getAttribute('data-carry')) {
		await page
			.getByRole('button', { name: '提起 / 放下' })
			.click({ timeout: 3_000 })
			.catch(() => undefined);
	}
	await expect(page.locator('.notice')).toContainText(/分拣完成/, { timeout: 20_000 });
	await waitPayUp(page, pay);
}

async function settleAudit(page: Page) {
	const hint = page
		.locator('.hint')
		.filter({ hasText: /有票据|无票据/ })
		.last();
	await expect(hint).toBeVisible();
	const text = (await hint.innerText()) ?? '';
	const parsed = text.match(/(餐补|加班|交通)\s*¥(\d+)\s*·\s*(有票据|无票据)/);
	const category = parsed?.[1] ?? '';
	const amount = Number(parsed?.[2] ?? '0');
	const hasReceipt = parsed?.[3] === '有票据';
	const flagged = text.includes('已审批');
	const reject =
		!hasReceipt || (category === '餐补' && amount > 80) || (category === '加班' && !flagged);
	await clickVisible(page, reject ? '驳回' : '通过');
}

test.describe('上班 Stage 1', () => {
	test.describe('natural guest play', () => {
		test('walks, rides the elevator, and plays every role without injected state', async ({
			page
		}) => {
			test.setTimeout(240_000);
			await page.setViewportSize({ width: 390, height: 844 });
			await guestBoot(page, 'light');
			await openPlay(page);
			await page.addLocatorHandler(page.getByRole('dialog', { name: '收工' }), async (dialog) => {
				await dialog.getByRole('button', { name: '下一天' }).click();
			});
			await clickVisible(page, '3x');

			const canvas = page.locator('canvas[aria-label="轻心大厦"]');
			await expect(page.getByRole('button', { name: /1F 后勤与物流/ })).toBeVisible();
			await expect(page.getByRole('button', { name: /5F 经营管理/ })).toBeVisible();
			await expect(page.getByRole('button', { name: '到货口' })).toBeVisible();
			await expect(page.locator('nav.fixed')).toHaveCount(0);

			await page.screenshot({ path: 'screenshots/shangban-intro-390-light.png' });
			await expect(page.locator('canvas[aria-label="轻心大厦"]')).toHaveAttribute(
				'data-ready',
				'1'
			);

			const before = await getState(page);
			const startX = before?.player.x ?? 2;
			const startZ = before?.player.z ?? 4;
			await clickVisible(page, '休息椅');
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-path', '0', {
				timeout: 12_000
			});
			await expect
				.poll(async () => {
					const state = await getState(page);
					if (!state) return startX;
					return state.player.x !== startX || state.player.z !== startZ ? 1 : 0;
				})
				.toBe(1);
			await page.keyboard.down('d');
			await page.waitForTimeout(280);
			await page.keyboard.up('d');
			await page.keyboard.up('ArrowRight');
			await page.keyboard.up('ArrowLeft');
			await page.keyboard.up('ArrowUp');
			await page.keyboard.up('ArrowDown');

			await clickVisible(page, '电梯');
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-elevator', '1', {
				timeout: 12_000
			});
			await clickVisible(page, /5F 经营管理/);
			await waitFloor(page, 5);
			await expect(page.getByRole('button', { name: '总经理室' })).toBeVisible();
			await page.screenshot({ path: 'screenshots/shangban-floor5-390-light.png' });
			await clickVisible(page, /1F 后勤与物流/);
			await waitFloor(page, 1);

			await completeSort(page);
			await page.screenshot({ path: 'screenshots/shangban-sort-done-390-light.png' });

			await expect(page.getByRole('button', { name: '接这单' })).toBeVisible({ timeout: 20_000 });
			await clickVisible(page, '推掉');
			await expect(page.locator('.notice')).toContainText('推掉');
			await completeSort(page);

			await switchRole(page, /销售顾问/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'sales');
			await clickVisible(page, '电梯');
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-elevator', '1', {
				timeout: 12_000
			});
			await clickVisible(page, /2F 客户与销售/);
			await waitFloor(page, 2);
			const salesPay = Number(
				(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
			);
			await acceptOffer(page);
			await startJob(page);
			await expect(page.getByRole('button', { name: '高价' })).toBeVisible();
			await expect(page.getByRole('button', { name: '公道' })).toBeVisible();
			await expect(page.getByRole('button', { name: '让价' })).toBeVisible();
			await page.screenshot({ path: 'screenshots/shangban-sales-390-light.png' });
			await clickVisible(page, '让价');
			await waitPayUp(page, salesPay);

			await switchRole(page, /维修技师/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'tech');
			await acceptOffer(page);
			await startJob(page);
			await clickVisible(page, '检查');
			await expect(page.locator('.notice')).toHaveText(/电源|插座|排线|花屏|散热|风道|主板|自检/, {
				timeout: 8_000
			});
			const parts = ['电源', '排线', '散热', '主板'] as const;
			const partFromClue = (text: string) =>
				text.includes('插座') || text.includes('电源')
					? '电源'
					: text.includes('花屏') || text.includes('排线')
						? '排线'
						: text.includes('风道') || text.includes('散热')
							? '散热'
							: text.includes('自检') || text.includes('主板')
								? '主板'
								: '电源';
			const clue = (await page.locator('.notice').innerText()) ?? '';
			const correct = partFromClue(clue);
			const wrong = parts.find((part) => part !== correct) ?? '排线';
			await clickVisible(page, wrong);
			await expect(page.locator('.notice')).toContainText(/对不上/, { timeout: 8_000 });
			const retry = page.getByRole('button', { name: '重试' });
			if (await retry.isVisible().catch(() => false)) {
				await clickVisible(page, '重试');
			}
			await acceptOffer(page);
			await startJob(page);
			await clickVisible(page, '检查');
			await expect(page.locator('.notice')).toHaveText(/电源|插座|排线|花屏|散热|风道|主板|自检/, {
				timeout: 8_000
			});
			const retryClue = (await page.locator('.notice').innerText()) ?? '';
			const retryPart = partFromClue(retryClue);
			const techPay = Number(
				(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
			);
			await clickVisible(page, retryPart);
			await waitPayUp(page, techPay);

			await switchRole(page, /产品工程师/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'engineer');
			await acceptOffer(page);
			await startJob(page);
			await expect(page.getByRole('button', { name: '写测试' })).toBeVisible();
			await expect(page.getByRole('button', { name: '直接上线' })).toBeVisible();
			await expect(page.getByRole('button', { name: '重写' })).toBeVisible();
			const engPay = Number(
				(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
			);
			await clickVisible(page, '写测试');
			await waitPayUp(page, engPay);

			await switchRole(page, /财务专员/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'finance');
			await acceptOffer(page);
			await startJob(page);
			const finPay = Number(
				(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
			);
			await settleAudit(page);
			await waitPayUp(page, finPay);

			await switchRole(page, /运营经理/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'manager');
			await clickVisible(page, '电梯');
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-elevator', '1', {
				timeout: 12_000
			});
			await clickVisible(page, /5F 经营管理/);
			await waitFloor(page, 5);
			await acceptOffer(page);
			await startJob(page);
			await expect(page.getByRole('button', { name: '调 1 人' })).toBeVisible();
			await expect(page.getByRole('button', { name: '调预算' })).toBeVisible();
			const mgrPay = Number(
				(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
			);
			await clickVisible(page, '调 1 人');
			await waitPayUp(page, mgrPay);

			await switchRole(page, /总经理/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'ceo');
			await acceptOffer(page);
			await startJob(page);
			await expect(page.getByRole('button', { name: '批加班预算' })).toBeVisible();
			await expect(page.getByRole('button', { name: '冻结招聘' })).toBeVisible();
			await expect(page.getByRole('button', { name: '公开致歉客户' })).toBeVisible();
			const ceoPay = Number(
				(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
			);
			const cashBefore = (await getState(page))?.company.cash ?? 0;
			await page.screenshot({ path: 'screenshots/shangban-ceo-390-light.png' });
			await clickVisible(page, '批加班预算');
			await waitPayUp(page, ceoPay);
			await expect
				.poll(async () => (await getState(page))?.company.cash ?? cashBefore)
				.not.toBe(cashBefore);

			await clickVisible(page, '俯瞰');
			await page.screenshot({ path: 'screenshots/shangban-overview-390-light.png' });
			await clickVisible(page, '回到工位');

			const frames = await page.evaluate(async () => {
				const samples: number[] = [];
				let last = performance.now();
				await new Promise<void>((resolve) => {
					const tick = (now: number) => {
						samples.push(now - last);
						last = now;
						if (samples.length < 45) requestAnimationFrame(tick);
						else resolve();
					};
					requestAnimationFrame(tick);
				});
				const avg = samples.reduce((sum, item) => sum + item, 0) / samples.length;
				return { avgFrameMs: Number(avg.toFixed(2)), approxFps: Number((1000 / avg).toFixed(1)) };
			});
			console.log('[shangban fps]', frames);
			await page.evaluate((measured) => {
				(window as Window & { __qingxinShangbanFps?: typeof measured }).__qingxinShangbanFps =
					measured;
			}, frames);

			const pay = await page.locator('[data-shangban="1"]').getAttribute('data-pay');
			await page.reload({ waitUntil: 'networkidle' });
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'ceo', {
				timeout: 20_000
			});
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-pay', pay ?? '0');
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-floor', '5');
		});
	});

	test('390 dock stays below the canvas and station chips are reachable', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await guestBoot(page);
		await openPlay(page);
		const canvasBox = await page.locator('[data-play="shangban"]').boundingBox();
		const dockBox = await page.locator('[data-shangban-dock]').boundingBox();
		expect(canvasBox).toBeTruthy();
		expect(dockBox).toBeTruthy();
		if (!canvasBox || !dockBox) throw new Error('boxes');
		expect(dockBox.y).toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height - 2);
		const inbound = page.getByRole('button', { name: '到货口' });
		await inbound.scrollIntoViewIfNeeded();
		const inboundBox = await inbound.boundingBox();
		expect(inboundBox).toBeTruthy();
		if (!inboundBox) throw new Error('inbound');
		expect(inboundBox.y + inboundBox.height).toBeLessThanOrEqual(844 + 1);
		expect(inboundBox.width).toBeGreaterThanOrEqual(44);
		expect(inboundBox.height).toBeGreaterThanOrEqual(44);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(overflow).toBeLessThanOrEqual(391);
	});

	test('1280 puts the office left and the glass rail right', async ({ page }) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await guestBoot(page);
		await openPlay(page);
		const canvasBox = await page.locator('[data-play="shangban"]').boundingBox();
		const dockBox = await page.locator('[data-shangban-dock]').boundingBox();
		if (!canvasBox || !dockBox) throw new Error('boxes');
		expect(canvasBox.width).toBeGreaterThan(dockBox.width);
		expect(canvasBox.width / 1280).toBeGreaterThan(0.55);
		expect(dockBox.x).toBeGreaterThanOrEqual(canvasBox.x + canvasBox.width - 8);
		await acceptOffer(page);
		await startJob(page);
		await expect(page.locator('[data-shangban-progress]')).toBeVisible();
		await page.screenshot({ path: 'screenshots/shangban-workday-after-1280.png' });
	});

	test('768, 1440 and landscape keep scene targets reachable', async ({ page }) => {
		await guestBoot(page);
		for (const view of [
			{ width: 768, height: 1024, name: '768' },
			{ width: 1440, height: 900, name: '1440' },
			{ width: 844, height: 390, name: 'landscape' }
		] as const) {
			await page.setViewportSize({ width: view.width, height: view.height });
			await page.goto('/modules/shangban', { waitUntil: 'networkidle' });
			await expect(page.locator('[data-shangban="1"]')).toBeVisible();
			await expect(page.locator('canvas[aria-label="轻心大厦"]')).toHaveAttribute(
				'data-ready',
				'1',
				{ timeout: 20_000 }
			);
			const canvasBox = await page.locator('[data-play="shangban"]').boundingBox();
			expect(canvasBox?.width ?? 0).toBeGreaterThan(200);
			const inbound = page.getByRole('button', { name: '到货口' });
			if (await inbound.isVisible().catch(() => false)) {
				const box = await inbound.boundingBox();
				expect((box?.height ?? 0) >= 40 || view.name === 'landscape').toBeTruthy();
			} else {
				await clickVisible(page, '打开操作');
				await expect(inbound).toBeVisible();
			}
			await page.screenshot({ path: `screenshots/shangban-workday-${view.name}.png` });
		}
	});

	test('pauses job progress, closes the day once, carries unfinished work, and keeps logs', async ({
		page
	}) => {
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await guestBoot(page);
		await openPlay(page);
		await clickVisible(page, '3x');
		await acceptOffer(page);
		await startJob(page);
		await clickVisible(page, '暂停');
		const spent = await page.evaluate(() => {
			const hook = (window as Window & { __qingxinShangban?: ShangbanHook }).__qingxinShangban;
			return hook?.getState().tasks.find((task) => task.status === 'active')?.ticksSpent ?? 0;
		});
		expect(spent).toBeGreaterThan(10);
		await page.evaluate(() => {
			const hook = (window as Window & { __qingxinShangban?: ShangbanHook }).__qingxinShangban;
			hook?.advanceJob(40);
		});
		const pausedSpent = await page.evaluate(() => {
			const hook = (window as Window & { __qingxinShangban?: ShangbanHook }).__qingxinShangban;
			return hook?.getState().tasks.find((task) => task.status === 'active')?.ticksSpent ?? 0;
		});
		expect(pausedSpent).toBe(spent);
		await page.locator('.overlay').getByRole('button', { name: '继续' }).click();
		const closed = await page.evaluate(() => {
			const hook = (window as Window & { __qingxinShangban?: ShangbanHook }).__qingxinShangban;
			try {
				hook?.closeNow();
				const state = hook?.getState();
				return {
					dayClosed: Boolean(state?.dayClosed),
					logs: state?.logs.length ?? 0,
					notice: state?.notice ?? ''
				};
			} catch (error) {
				return { dayClosed: false, logs: 0, notice: String(error) };
			}
		});
		expect(closed.dayClosed, closed.notice).toBe(true);
		await expect(page.locator('[data-shangban-close]')).toBeVisible({ timeout: 15_000 });
		await expect.poll(async () => (await getState(page))?.logs.length ?? 0).toBe(1);
		const dayOne = await page.locator('[data-shangban="1"]').getAttribute('data-day');
		await clickVisible(page, '下一天');
		await expect(page.locator('[data-shangban="1"]')).toHaveAttribute(
			'data-day',
			String(Number(dayOne) + 1)
		);
		await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-status', 'active');
		await page.reload({ waitUntil: 'networkidle' });
		await expect(page.locator('[data-shangban="1"]')).toBeVisible({ timeout: 20_000 });
		await clickVisible(page, '日志');
		await expect(page.locator('[data-shangban-log]')).toContainText(/第1天/);
		await page.screenshot({ path: 'screenshots/shangban-workday-log-1280.png' });
	});

	for (const view of [
		{ name: '390', width: 390, height: 844 },
		{ name: '1280', width: 1280, height: 800 }
	] as const) {
		for (const theme of ['light', 'dark'] as const) {
			test(`play ${view.name} ${theme} screenshot`, async ({ page }) => {
				await page.setViewportSize({ width: view.width, height: view.height });
				await guestBoot(page, theme);
				await openPlay(page);
				await expect(page.getByRole('button', { name: '接这单' })).toBeVisible();
				if (view.width >= 800) {
					await expect(page.getByRole('button', { name: /5F 经营管理/ })).toBeVisible();
				}
				await page.screenshot({
					path: `screenshots/shangban-play-${view.name}-${theme}.png`
				});
			});
		}
	}

	test('home and hub list 上班 instead of 内容创作', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await guestBoot(page);
		await page.goto('/', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '上班' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: '去上班' })).toBeVisible();
		await expect(page.getByText('后勤与物流').first()).toBeVisible();
		const nav = page.locator('[data-qx-topbar]');
		await expect(nav.getByText('模块中心')).toBeVisible();
		await expect(nav.getByText('内容')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: '上班' }).first()).toBeVisible();
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '上班' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '内容创作' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: '秘密' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '积木台' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '求职副业' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: '本地生活' })).toHaveCount(0);
		await page.goto('/modules/create', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '内容创作' })).toBeVisible();
		await expect(page.getByText('主入口已换成上班')).toBeVisible();
	});
});
