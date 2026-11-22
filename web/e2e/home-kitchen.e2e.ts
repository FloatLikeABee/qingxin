import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		if (!sessionStorage.getItem('qingxin.keepKitchen')) {
			localStorage.removeItem('qingxin.games.home-kitchen');
		}
	}, theme);
}

async function waitKitchen(page: Page) {
	const stove = page.locator('canvas[aria-label="家庭厨房灶台"]');
	await expect(stove).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await expect
		.poll(async () => stove.getAttribute('data-panx'), { timeout: 15_000 })
		.not.toBeNull();
	await expect
		.poll(async () => stove.getAttribute('data-bx-veg'), { timeout: 15_000 })
		.not.toBeNull();
	return stove;
}

const FOODS = ['veg', 'meat', 'egg', 'dough', 'tofu', 'shrimp'] as const;

async function dualShot(page: Page, stove: Locator, name: string) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect.poll(async () => (await stove.boundingBox())?.width ?? 0).toBeGreaterThan(400);
	await expect.poll(async () => stove.getAttribute('data-inbox'), { timeout: 8_000 }).toBe('1');
	await page.screenshot({ path: `screenshots/${name}-1280.png` });
	await page.setViewportSize({ width: 390, height: 844 });
	await expect.poll(async () => (await stove.boundingBox())?.width ?? 0).toBeLessThan(500);
	await expect.poll(async () => stove.getAttribute('data-inbox'), { timeout: 8_000 }).toBe('1');
	await page.screenshot({ path: `screenshots/${name}-390.png` });
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect.poll(async () => (await stove.boundingBox())?.width ?? 0).toBeGreaterThan(400);
	await expect.poll(async () => stove.getAttribute('data-inbox'), { timeout: 8_000 }).toBe('1');
}

async function canvasPoint(stove: Locator, xKey: string, yKey: string) {
	const box = await stove.boundingBox();
	if (!box) throw new Error('canvas box');
	const x = Number(await stove.getAttribute(`data-${xKey}`));
	const y = Number(await stove.getAttribute(`data-${yKey}`));
	if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`bad ${xKey}/${yKey}`);
	return { x: box.x + x, y: box.y + y };
}

async function dragKindToPan(page: Page, stove: Locator, kind = 'veg') {
	const start = await canvasPoint(stove, `bx-${kind}`, `by-${kind}`);
	const dest = await canvasPoint(stove, 'panx', 'pany');
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(dest.x, dest.y, { steps: 16 });
	await page.mouse.up();
}

async function dragPanToPlate(page: Page, stove: Locator, slot: number) {
	const start = await canvasPoint(stove, 'panx', 'pany');
	const dest = await canvasPoint(stove, `plx${slot}`, `ply${slot}`);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await expect
		.poll(async () => stove.getAttribute('data-held'), { timeout: 4_000 })
		.toMatch(/pan:/);
	await page.mouse.move(dest.x, dest.y, { steps: 16 });
	await page.mouse.up();
}

async function assertReachable(page: Page, stove: Locator) {
	const box = await stove.boundingBox();
	expect(box).toBeTruthy();
	const pad = 16;
	await expect(stove).toHaveAttribute('data-inbox', '1');
	for (const kind of FOODS) {
		const pt = await canvasPoint(stove, `bx-${kind}`, `by-${kind}`);
		expect(pt.x - box!.x, `${kind} x`).toBeGreaterThan(pad);
		expect(pt.x - box!.x, `${kind} x`).toBeLessThan(box!.width - pad);
		expect(pt.y - box!.y, `${kind} y`).toBeGreaterThan(pad);
		expect(pt.y - box!.y, `${kind} y`).toBeLessThan(box!.height - pad);
		const tag = page.locator(`[data-bowl-label="${kind}"]`);
		await expect(tag).toBeVisible();
		const tbox = await tag.boundingBox();
		expect(tbox).toBeTruthy();
		expect(tbox!.x).toBeGreaterThanOrEqual(box!.x - 6);
		expect(tbox!.x + tbox!.width).toBeLessThanOrEqual(box!.x + box!.width + 6);
		expect(tbox!.y).toBeGreaterThanOrEqual(box!.y - 6);
		expect(tbox!.y + tbox!.height).toBeLessThanOrEqual(box!.y + box!.height + 6);
	}
	for (let i = 0; i < 8; i++) {
		const pt = await canvasPoint(stove, `plx${i}`, `ply${i}`);
		expect(pt.x - box!.x, `plate${i} x`).toBeGreaterThan(pad);
		expect(pt.x - box!.x, `plate${i} x`).toBeLessThan(box!.width - pad);
		expect(pt.y - box!.y, `plate${i} y`).toBeGreaterThan(pad);
		expect(pt.y - box!.y, `plate${i} y`).toBeLessThan(box!.height - pad);
		const tag = page.locator(`[data-plate-label="${i}"]`);
		await expect(tag).toBeVisible();
		const tbox = await tag.boundingBox();
		expect(tbox).toBeTruthy();
		expect(tbox!.x).toBeGreaterThanOrEqual(box!.x - 6);
		expect(tbox!.x + tbox!.width).toBeLessThanOrEqual(box!.x + box!.width + 6);
		expect(tbox!.y).toBeGreaterThanOrEqual(box!.y - 6);
		expect(tbox!.y + tbox!.height).toBeLessThanOrEqual(box!.y + box!.height + 6);
	}
}

function alongScreenRight(
	from: { x: number; lookx: number; lookz: number; z: number },
	to: { x: number; z: number }
) {
	return (to.x - from.x) * -from.lookz + (to.z - from.z) * from.lookx;
}

test.describe('烹饪', () => {
	test('catalog 烹饪 opens a kitchen, cooks, plates, and keeps siblings', async ({ page }) => {
		test.setTimeout(180_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page);
		await page.goto('/modules/games', { waitUntil: 'networkidle' });
		await page.getByLabel('找一款想玩的').fill('烹饪');
		await expect(page.getByRole('heading', { name: '烹饪' }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: '灶台' })).toHaveCount(0);
		await page.getByRole('heading', { name: '烹饪' }).first().click();
		await expect(page).toHaveURL(/\/modules\/games\/home-kitchen$/);
		await expect(page.getByRole('heading', { name: '烹饪', level: 1 })).toBeVisible();
		await expect(page.getByText('Cooking')).toBeVisible();
		await expect(page.getByText(/没有客人/)).toBeVisible();
		await expect(page.getByRole('link', { name: '开始做饭' })).toBeVisible();
		await page.getByRole('link', { name: '开始做饭' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/home-kitchen\/play/);
		const stove = await waitKitchen(page);
		await expect(stove).toHaveAttribute('data-pan', '0');
		await expect(stove).toHaveAttribute('data-heat', 'off');
		await expect(page.getByRole('timer')).toHaveCount(0);
		await expect(page.getByText('客人还在店门口等着。')).toHaveCount(0);
		await assertReachable(page, stove);
		await expect(page.locator('[data-bowl-label="veg"]')).toHaveText('菜叶');
		await expect(page.locator('[data-bowl-label="shrimp"]')).toHaveText('虾');
		await dualShot(page, stove, 'home-kitchen-raw');

		await dragKindToPan(page, stove, 'veg');
		await expect.poll(async () => stove.getAttribute('data-pan'), { timeout: 8_000 }).toBe('1');
		await expect(stove).toHaveAttribute('data-doneness', '0');
		await page.getByRole('button', { name: '武火' }).click();
		await expect(stove).toHaveAttribute('data-heat', 'high');
		await expect
			.poll(async () => Number(await stove.getAttribute('data-doneness')), { timeout: 12_000 })
			.toBeGreaterThan(0.04);
		await expect.poll(async () => stove.getAttribute('data-steam'), { timeout: 12_000 }).toBe('1');
		await expect(page.getByRole('timer')).toHaveCount(0);
		const beforeStir = await canvasPoint(stove, 'px0', 'py0');
		const pan = await canvasPoint(stove, 'panx', 'pany');
		await page.mouse.move(beforeStir.x, beforeStir.y);
		await page.mouse.down();
		await page.mouse.move(pan.x + 28, pan.y - 20, { steps: 12 });
		await page.mouse.up();
		await expect
			.poll(async () => stove.getAttribute('data-notice'))
			.toMatch(/搅了一下|下锅了|盛起/);
		await dualShot(page, stove, 'home-kitchen-cooking');

		const beforePlate = await stove.getAttribute('data-pan');
		const piece = await canvasPoint(stove, 'px0', 'py0');
		const plate = await canvasPoint(stove, 'plx0', 'ply0');
		await page.mouse.move(piece.x, piece.y);
		await page.mouse.down();
		await expect
			.poll(async () => stove.getAttribute('data-held'), { timeout: 4_000 })
			.toMatch(/pan:/);
		await page.mouse.move(plate.x, plate.y, { steps: 16 });
		await page.mouse.up();
		await expect.poll(async () => stove.getAttribute('data-plated'), { timeout: 8_000 }).toBe('1');
		expect(Number(await stove.getAttribute('data-pan'))).toBeLessThan(Number(beforePlate));
		await dualShot(page, stove, 'home-kitchen-plated');

		await dragKindToPan(page, stove, 'egg');
		await expect.poll(async () => stove.getAttribute('data-pan')).toBe('1');
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(stove).toHaveAttribute('data-anim', '0');
		const cooked = Number(await stove.getAttribute('data-doneness'));
		await page.waitForTimeout(800);
		expect(Number(await stove.getAttribute('data-doneness'))).toBeCloseTo(cooked, 3);
		await page.getByRole('button', { name: '继续' }).click();

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepKitchen', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		const again = await waitKitchen(page);
		await expect(again).toHaveAttribute('data-plated', '1');
		await expect.poll(async () => Number(await again.getAttribute('data-pan'))).toBeGreaterThan(0);

		for (let i = Number(await again.getAttribute('data-pan')); i < 12; i++) {
			await dragKindToPan(page, again, 'veg');
			await expect.poll(async () => Number(await again.getAttribute('data-pan'))).toBe(i + 1);
		}
		await expect(again).toHaveAttribute('data-pan', '12');
		await dragKindToPan(page, again, 'meat');
		await expect.poll(async () => again.getAttribute('data-notice')).toMatch(/锅满了/);
		await expect(again).toHaveAttribute('data-pan', '12');
		await expect(page.locator('.notice')).toHaveText(/锅满了/);
	});

	test('390 drags into the pan with 44px heat chips', async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await boot(page);
		await page.goto('/modules/games/home-kitchen/play', { waitUntil: 'networkidle' });
		const stove = await waitKitchen(page);
		await expect(stove).toHaveAttribute('data-narrow', '1');
		await assertReachable(page, stove);
		for (let slot = 0; slot < 8; slot++) {
			await dragKindToPan(page, stove, FOODS[slot % FOODS.length]);
			await expect.poll(async () => stove.getAttribute('data-pan'), { timeout: 8_000 }).toBe('1');
			await dragPanToPlate(page, stove, slot);
			await expect
				.poll(async () => stove.getAttribute('data-plated'), { timeout: 8_000 })
				.toBe(String(slot + 1));
			await expect.poll(async () => stove.getAttribute('data-pan'), { timeout: 8_000 }).toBe('0');
		}
		await expect(page.locator('[data-plate-label="0"]')).toHaveText(
			/炒青菜|煎肉|煎蛋|烙饼|煎豆腐|炒虾/
		);
		const high = page.getByRole('button', { name: '武火' });
		const box = await high.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.width).toBeGreaterThanOrEqual(44);
		await high.click();
		await expect(stove).toHaveAttribute('data-heat', 'high');
		await page.screenshot({ path: 'screenshots/home-kitchen-touch-390.png' });
	});

	test('cargo cloud operation shelf and other siblings still boot', async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');

		await page.goto('/modules/games/cargo-haul/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="重卡公路"]')).toHaveAttribute('data-ready', '1', {
			timeout: 20_000
		});

		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
		await expect
			.poll(async () => sky.getAttribute('data-lookx'), { timeout: 8_000 })
			.not.toBeNull();
		const idle = await sky.evaluate((el) => ({
			x: Number(el.getAttribute('data-x')),
			z: Number(el.getAttribute('data-z')),
			lookx: Number(el.getAttribute('data-lookx')),
			lookz: Number(el.getAttribute('data-lookz'))
		}));
		await page.locator('[data-play="cloud"]').evaluate((el) => (el as HTMLElement).focus());
		await page.keyboard.down('ArrowRight');
		await expect
			.poll(
				async () => {
					const next = await sky.evaluate((el) => ({
						x: Number(el.getAttribute('data-x')),
						z: Number(el.getAttribute('data-z'))
					}));
					return alongScreenRight(idle, next);
				},
				{ timeout: 6_000 }
			)
			.toBeGreaterThan(0.4);
		await page.keyboard.up('ArrowRight');

		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-play="operation"]')).toBeVisible();

		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="记忆货架书房"]')).toHaveAttribute(
			'data-ready',
			'1',
			{ timeout: 20_000 }
		);

		await page.goto('/modules/games/annual-report/play', { waitUntil: 'networkidle' });
		await expect(page.getByRole('tab', { name: '假设' })).toBeVisible();
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="便利店三维店面"]')).toHaveAttribute(
			'data-ready',
			'1',
			{ timeout: 20_000 }
		);
		await page.goto('/modules/games/shangban/play', { waitUntil: 'networkidle' });
		await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
	});
});
