import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 390, height: 844 } }
});

type ShangbanHook = {
	getState: () => {
		player: { x: number; z: number; floor: number; roleId: string; pay: number };
		notice: string;
		company: { cash: number; morale: number };
		tasks: Array<{ status: string; kind: string; roleId: string }>;
	};
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

async function clickVisible(page: Page, name: string | RegExp) {
	const button = page.getByRole('button', { name });
	await button.first().scrollIntoViewIfNeeded();
	await expect(button.first()).toBeVisible();
	await button.first().click();
}

async function acceptOffer(page: Page) {
	await expect(page.getByRole('button', { name: '接这单' })).toBeVisible({ timeout: 20_000 });
	await clickVisible(page, '接这单');
}

async function switchRole(page: Page, name: RegExp) {
	await clickVisible(page, '换岗');
	const dialog = page.getByRole('dialog', { name: '换岗' });
	await expect(dialog).toBeVisible();
	for (const role of [
		'物流员',
		'销售顾问',
		'维修技师',
		'产品工程师',
		'财务专员',
		'运营经理',
		'总经理'
	]) {
		await expect(dialog.getByRole('button', { name: new RegExp(role) })).toBeVisible();
	}
	await dialog.getByRole('button', { name }).click();
	await expect(dialog).toHaveCount(0);
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
				const raw = await page.locator('[data-shangban="1"]').getAttribute('data-pay');
				return Number(raw ?? '0');
			},
			{ timeout: 15_000 }
		)
		.toBeGreaterThan(was);
}

async function completeSort(page: Page) {
	const pay = Number((await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0');
	await acceptOffer(page);
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
	await clickVisible(page, '提起 / 放下');
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
			test.setTimeout(180_000);
			await page.setViewportSize({ width: 390, height: 844 });
			await guestBoot(page, 'light');
			await openPlay(page);

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
			await expect(page.getByRole('button', { name: '高价' })).toBeVisible();
			await expect(page.getByRole('button', { name: '公道' })).toBeVisible();
			await expect(page.getByRole('button', { name: '让价' })).toBeVisible();
			await page.screenshot({ path: 'screenshots/shangban-sales-390-light.png' });
			await clickVisible(page, '让价');
			await waitPayUp(page, salesPay);

			await switchRole(page, /维修技师/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'tech');
			await acceptOffer(page);
			await clickVisible(page, '检查');
			await expect(page.locator('.notice')).toHaveText(/电源|排线|散热|主板/, { timeout: 8_000 });
			const clue = (await page.locator('.notice').innerText()) ?? '';
			const parts = ['电源', '排线', '散热', '主板'] as const;
			const correct = parts.find((part) => clue.includes(part)) ?? '电源';
			const wrong = parts.find((part) => part !== correct) ?? '排线';
			await clickVisible(page, wrong);
			await expect(page.getByRole('button', { name: '重试' })).toBeVisible({ timeout: 8_000 });
			await clickVisible(page, '重试');
			await acceptOffer(page);
			await clickVisible(page, '检查');
			await expect(page.locator('.notice')).toHaveText(/电源|排线|散热|主板/, { timeout: 8_000 });
			const retryClue = (await page.locator('.notice').innerText()) ?? '';
			const retryPart = parts.find((part) => retryClue.includes(part)) ?? '电源';
			const techPay = Number(
				(await page.locator('[data-shangban="1"]').getAttribute('data-pay')) ?? '0'
			);
			await clickVisible(page, retryPart);
			await waitPayUp(page, techPay);

			await switchRole(page, /产品工程师/);
			await expect(page.locator('[data-shangban="1"]')).toHaveAttribute('data-role', 'engineer');
			await acceptOffer(page);
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
		await expect(page.getByRole('heading', { name: '上班' })).toBeVisible();
		await expect(page.getByRole('link', { name: '去上班' })).toBeVisible();
		await expect(page.getByText('后勤与物流').first()).toBeVisible();
		const nav = page.locator('nav.fixed');
		await expect(nav.getByText('上班')).toBeVisible();
		await expect(nav.getByText('内容')).toHaveCount(0);
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '上班' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '内容创作' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: '秘密' })).toBeVisible();
		await page.goto('/modules/create', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '内容创作' })).toBeVisible();
		await expect(page.getByText('主入口已换成上班')).toBeVisible();
	});
});
