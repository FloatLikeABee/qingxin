import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		if (!sessionStorage.getItem('qingxin.keepShelf')) {
			localStorage.removeItem('qingxin.games.memory-shelf');
		}
	}, theme);
}

async function waitStudy(page: Page) {
	const study = page.locator('canvas[aria-label="记忆货架书房"]');
	await expect(study).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await expect.poll(async () => study.getAttribute('data-hx'), { timeout: 15_000 }).not.toBeNull();
	return study;
}

async function dualShot(page: Page, study: Locator, name: string) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect.poll(async () => (await study.boundingBox())?.width ?? 0).toBeGreaterThan(400);
	await page.screenshot({ path: `screenshots/${name}-1280-dark.png` });
	await page.setViewportSize({ width: 390, height: 844 });
	await expect.poll(async () => (await study.boundingBox())?.width ?? 0).toBeLessThan(500);
	await page.screenshot({ path: `screenshots/${name}-390-dark.png` });
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect.poll(async () => (await study.boundingBox())?.width ?? 0).toBeGreaterThan(400);
	await expect.poll(async () => study.getAttribute('data-items'), { timeout: 8_000 }).toBe('48');
}

async function shot1280(page: Page, study: Locator, name: string) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect.poll(async () => (await study.boundingBox())?.width ?? 0).toBeGreaterThan(400);
	await page.screenshot({ path: `screenshots/${name}-1280-dark.png` });
}

async function canvasPoint(study: Locator, xKey: string, yKey: string) {
	const box = await study.boundingBox();
	if (!box) throw new Error('canvas box');
	const x = Number(await study.getAttribute(`data-${xKey}`));
	const y = Number(await study.getAttribute(`data-${yKey}`));
	if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`bad ${xKey}/${yKey}`);
	return { x: box.x + x, y: box.y + y, localX: x, localY: y };
}

async function clickProjected(page: Page, study: Locator, xKey: string, yKey: string) {
	const pt = await canvasPoint(study, xKey, yKey);
	await page.mouse.click(pt.x, pt.y);
}

async function dragProjected(page: Page, study: Locator) {
	const aid = await study.getAttribute('data-aid');
	const start = await canvasPoint(study, 'ax', 'ay');
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await expect(study).toHaveAttribute('data-held', aid!);
	const dest = await canvasPoint(study, 'bx', 'by');
	expect(Math.hypot(dest.x - start.x, dest.y - start.y)).toBeGreaterThan(12);
	await page.mouse.move(dest.x, dest.y, { steps: 20 });
	await page.mouse.up();
	await expect(study).toHaveAttribute('data-held', '');
}

async function assertApologyOnStage(page: Page, study: Locator) {
	const canvasBox = await study.boundingBox();
	const headerBox = await page.locator('[data-shelf-top]').boundingBox();
	expect(canvasBox).toBeTruthy();
	expect(headerBox).toBeTruthy();
	const bubbles = page.locator('p.sorry[data-apology="1"]');
	await expect(bubbles.first()).toBeVisible();
	const n = await bubbles.count();
	expect(n).toBeGreaterThanOrEqual(1);
	for (let i = 0; i < n; i++) {
		const bubble = bubbles.nth(i);
		await expect(bubble.locator('.say')).toHaveText('对不起！');
		await expect(bubble.locator('.say')).toHaveCSS('white-space', 'nowrap');
		const box = await bubble.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
		expect(box!.y).toBeGreaterThanOrEqual(canvasBox!.y - 1);
		expect(box!.x).toBeGreaterThanOrEqual(canvasBox!.x - 1);
		expect(box!.x + box!.width).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width + 1);
		expect(box!.y + box!.height).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height + 1);
		expect(box!.height).toBeLessThan(72);
	}
}

async function pauseWhen(page: Page, study: Locator, phase: string, minProgress = 0.25) {
	await expect.poll(async () => study.getAttribute('data-phase'), { timeout: 12_000 }).toBe(phase);
	await expect
		.poll(async () => Number(await study.getAttribute('data-progress')), { timeout: 6_000 })
		.toBeGreaterThan(minProgress);
	await page.getByRole('button', { name: '暂停' }).click();
	await expect(study).toHaveAttribute('data-anim', '0');
}

async function resume(page: Page, study: Locator) {
	await page.getByRole('button', { name: '继续' }).click();
	await expect(study).toHaveAttribute('data-anim', '1');
}

test.describe('记忆货架', () => {
	test('guest rearranges books, meets concurrent ghosts, and keeps ids', async ({ page }) => {
		test.setTimeout(180_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/memory-shelf', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '记忆货架', level: 1 })).toBeVisible();
		await expect(page.getByText('Memory Shelf')).toBeVisible();
		await expect(page.getByText('没有计时，也没有分数')).toBeVisible();
		await expect(page.getByText('对不起！')).toBeVisible();
		await expect(page.getByText(/最多四只鬼/)).toBeVisible();
		await expect(page.getByRole('link', { name: '开始整理' })).toBeVisible();
		await page.getByRole('link', { name: '开始整理' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/memory-shelf\/play/);
		const study = await waitStudy(page);
		await expect(study).toHaveAttribute('data-phase', 'idle');
		await expect(study).toHaveAttribute('data-items', '48');
		expect(Number(await study.getAttribute('data-hcount'))).toBe(4);
		await expect(study).toHaveAttribute('data-cap', '4');
		await expect(page.getByText(/最多四只鬼会同时道歉/)).toBeVisible();
		await expect(page.getByRole('button', { name: '书房声' })).toBeVisible();
		await dualShot(page, study, 'memory-shelf-full');

		const before = await study.getAttribute('data-layout');
		const aid = await study.getAttribute('data-aid');
		await clickProjected(page, study, 'ax', 'ay');
		await expect(study).toHaveAttribute('data-held', aid!);
		await expect(study).toHaveAttribute('data-phase', 'idle');
		await shot1280(page, study, 'memory-shelf-place');
		await clickProjected(page, study, 'bx', 'by');
		await expect(study).toHaveAttribute('data-held', '');
		await dualShot(page, study, 'memory-shelf-swapped');
		const swapped = await study.getAttribute('data-layout');
		expect(swapped).not.toBe(before);
		expect(
			(swapped ?? '').split('|').filter((line, i) => line !== before?.split('|')[i])
		).toHaveLength(2);

		const afterTap = await study.getAttribute('data-layout');
		await dragProjected(page, study);
		const afterDrag = await study.getAttribute('data-layout');
		expect(afterDrag).not.toBe(afterTap);
		expect(
			(afterDrag ?? '').split('|').filter((line, i) => line !== afterTap?.split('|')[i])
		).toHaveLength(2);

		const first = await study.getAttribute('data-h0');
		for (let i = 0; i < 4; i++) {
			await expect
				.poll(async () => study.getAttribute(`data-hx${i}`), { timeout: 8_000 })
				.not.toBeNull();
			await clickProjected(page, study, `hx${i}`, `hy${i}`);
		}
		await expect
			.poll(async () => {
				const phases = await Promise.all(
					[0, 1, 2, 3].map((i) => study.getAttribute(`data-hp${i}`))
				);
				return phases.filter((phase) => phase && phase !== 'idle').length;
			})
			.toBe(4);
		await expect(study).toHaveAttribute('data-playing', '1');
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(study).toHaveAttribute('data-anim', '0');
		await shot1280(page, study, 'memory-shelf-emerge');
		await resume(page, study);

		await expect
			.poll(
				async () => {
					const phases = await Promise.all(
						[0, 1, 2, 3].map((i) => study.getAttribute(`data-hp${i}`))
					);
					return phases.filter((phase) => phase === 'cry' || phase === 'sorry').length;
				},
				{ timeout: 12_000 }
			)
			.toBe(4);
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(study).toHaveAttribute('data-anim', '0');
		expect(Number(await study.getAttribute('data-hcount'))).toBe(4);
		await shot1280(page, study, 'memory-shelf-cry');
		await resume(page, study);

		await expect
			.poll(async () => study.getAttribute('data-apology'), { timeout: 10_000 })
			.toBe('1');
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(study).toHaveAttribute('data-anim', '0');
		await expect(page.locator('p.sorry[data-apology="1"]').first()).toBeVisible();
		await expect(page.locator('p.sorry').first()).toContainText('对不起！');
		expect(await page.locator('p.sorry[data-apology="1"]').count()).toBeGreaterThanOrEqual(1);
		await assertApologyOnStage(page, study);
		await shot1280(page, study, 'memory-shelf-sorry');
		await resume(page, study);

		await expect
			.poll(
				async () => (await study.getAttribute('data-haunt'))?.split(',').includes(first ?? ''),
				{
					timeout: 10_000
				}
			)
			.toBe(false);
		expect(Number(await study.getAttribute('data-hcount'))).toBe(4);
		await shot1280(page, study, 'memory-shelf-return');

		const layoutDone = await study.getAttribute('data-layout');
		await page.getByRole('button', { name: '下一轮' }).click();
		await expect(study).toHaveAttribute('data-phase', 'idle');
		expect(await study.getAttribute('data-layout')).toBe(layoutDone);

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepShelf', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		const again = await waitStudy(page);
		expect(await again.getAttribute('data-layout')).toBe(layoutDone);
		await expect(again).toHaveAttribute('data-items', '48');

		const idsHigh = await again.getAttribute('data-layout');
		await page.getByRole('button', { name: '低细腻' }).click();
		await expect(again).toHaveAttribute('data-detail', 'low');
		await expect(again).toHaveAttribute('data-items', '30');
		await page.getByRole('button', { name: '高细腻' }).click();
		await expect(again).toHaveAttribute('data-items', '48');
		expect(await again.getAttribute('data-layout')).toBe(idsHigh);

		await page.getByRole('button', { name: '书房声' }).click();
		await expect(again).toHaveAttribute('data-audio', '1');
		await page.getByRole('button', { name: '静音' }).click();
	});

	test('390 compact rearranges and taps a ghost with 44px controls', async ({ page }) => {
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await boot(page, 'dark');
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		const study = await waitStudy(page);
		expect(Number(await study.getAttribute('data-items'))).toBeLessThanOrEqual(30);
		expect(Number(await study.getAttribute('data-hcount'))).toBeLessThanOrEqual(2);
		await expect(study).toHaveAttribute('data-cap', '2');
		await expect(page.getByText(/最多两只鬼会同时道歉/)).toBeVisible();
		await expect(page.locator('.need')).not.toContainText('最多四只鬼');
		const before = await study.getAttribute('data-layout');
		const aid = await study.getAttribute('data-aid');
		const start = await canvasPoint(study, 'ax', 'ay');
		expect(start.localY).toBeGreaterThan(48);
		await page.mouse.click(start.x, start.y);
		await expect(study).toHaveAttribute('data-held', aid!);
		const dest = await canvasPoint(study, 'bx', 'by');
		expect(Math.hypot(dest.x - start.x, dest.y - start.y)).toBeGreaterThan(12);
		await page.mouse.click(dest.x, dest.y);
		await expect(study).toHaveAttribute('data-held', '');
		expect(await study.getAttribute('data-layout')).not.toBe(before);
		await page.screenshot({ path: 'screenshots/memory-shelf-touch-390-dark.png' });

		const afterTap = await study.getAttribute('data-layout');
		await dragProjected(page, study);
		expect(await study.getAttribute('data-layout')).not.toBe(afterTap);

		const hauntN = Math.min(2, Number(await study.getAttribute('data-hcount')) || 0);
		expect(hauntN).toBeGreaterThanOrEqual(1);
		for (let i = 0; i < hauntN; i++) {
			await expect
				.poll(async () => study.getAttribute(`data-hx${i}`), { timeout: 8_000 })
				.not.toBeNull();
			await clickProjected(page, study, `hx${i}`, `hy${i}`);
		}
		await expect
			.poll(async () => study.getAttribute('data-apology'), { timeout: 10_000 })
			.toBe('1');
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(study).toHaveAttribute('data-anim', '0');
		await expect(study).toHaveAttribute('data-cap', '2');
		await expect(study).toHaveAttribute('data-cap-copy', '两');
		await expect(page.locator('[data-cap-live="1"]')).toHaveText('最多两只鬼');
		await expect(page.locator('[data-cap-copy="两"]').first()).toBeVisible();
		await expect(page.locator('.need')).toContainText(/最多两只鬼/);
		await expect(page.locator('.need')).not.toContainText('四只鬼');
		await expect(page.locator('[data-shelf-top]')).toContainText(/最多两只/);
		await expect(page.locator('p.sorry[data-apology="1"]').first()).toBeVisible();
		await assertApologyOnStage(page, study);
		await page.screenshot({ path: 'screenshots/memory-shelf-ghost-390-dark.png' });
		await page.screenshot({ path: 'screenshots/memory-shelf-sorry-390-dark.png' });

		const audio = page.getByRole('button', { name: '书房声' });
		const box = await audio.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.width).toBeGreaterThanOrEqual(44);
		await expect(page.getByRole('button', { name: /拿起|放到第/ })).toHaveCount(0);
	});

	test('schema 2 save keeps b0 and writes schema 3', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
			localStorage.setItem('qingxin.theme', 'dark');
			localStorage.setItem('qingxin.games.cargo-haul', '{"schema":2}');
			localStorage.setItem('qingxin.games.cloud-walk', '{"schema":3}');
			localStorage.setItem('qingxin.games.operation', '{"schema":2}');
			localStorage.setItem(
				'qingxin.games.memory-shelf',
				JSON.stringify({
					schema: 2,
					items: [
						{
							id: 'b0',
							kind: 'book',
							title: '夜航',
							tone: 0.2,
							row: 1,
							slot: 2,
							tall: 0.5,
							thick: 0.25
						}
					],
					hauntId: 'b0',
					phase: 'idle',
					round: 0,
					lowDetail: false,
					audioWanted: false,
					dockCollapsed: false
				})
			);
		});
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		const study = await waitStudy(page);
		await expect(page.locator('.notice')).toHaveText('货架又添了几格。');
		await expect(study).toHaveAttribute('data-items', '48');
		expect((await study.getAttribute('data-layout')) ?? '').toMatch(/b0:1:2/);
		const keys = await page.evaluate(() => ({
			cargo: localStorage.getItem('qingxin.games.cargo-haul'),
			cloud: localStorage.getItem('qingxin.games.cloud-walk'),
			op: localStorage.getItem('qingxin.games.operation'),
			schema: JSON.parse(localStorage.getItem('qingxin.games.memory-shelf') || '{}').schema
		}));
		expect(keys.cargo).toBe('{"schema":2}');
		expect(keys.cloud).toBe('{"schema":3}');
		expect(keys.op).toBe('{"schema":2}');
		expect(keys.schema).toBe(3);
	});

	test('schema 1 save migrates without wiping other qingxin keys', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
			localStorage.setItem('qingxin.theme', 'dark');
			localStorage.setItem('qingxin.games.tide-breath', '{"schema":1}');
			localStorage.setItem(
				'qingxin.games.memory-shelf',
				JSON.stringify({
					schema: 1,
					puzzle: 2,
					phase: 'restore',
					lowDetail: true,
					audioWanted: true,
					dockCollapsed: false
				})
			);
		});
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		const study = await waitStudy(page);
		await expect(page.locator('.notice')).toHaveText('货架换了样子，书还在等你摆。');
		await expect(study).toHaveAttribute('data-detail', 'low');
		await expect(study).toHaveAttribute('data-items', '30');
		const keys = await page.evaluate(() => ({
			theme: localStorage.getItem('qingxin.theme'),
			tide: localStorage.getItem('qingxin.games.tide-breath'),
			schema: JSON.parse(localStorage.getItem('qingxin.games.memory-shelf') || '{}').schema
		}));
		expect(keys.theme).toBe('dark');
		expect(keys.tide).toBe('{"schema":1}');
		expect(keys.schema).toBe(3);
	});

	test('reduced motion still shows apology; truck cloud operation still boot', async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		const study = await waitStudy(page);
		expect(Number(await study.getAttribute('data-items'))).toBeLessThanOrEqual(30);
		await clickProjected(page, study, 'hx', 'hy');
		await expect
			.poll(
				async () => {
					if ((await study.getAttribute('data-apology')) !== '1') return false;
					if ((await study.getAttribute('data-anim')) === '1') {
						await page.keyboard.press('p');
					}
					return (
						(await study.getAttribute('data-apology')) === '1' &&
						(await study.getAttribute('data-anim')) === '0'
					);
				},
				{ timeout: 8_000 }
			)
			.toBe(true);
		await expect(page.locator('p.sorry[data-apology="1"]').first()).toBeVisible();
		await page.screenshot({ path: 'screenshots/memory-shelf-reduced-1280-light.png' });
		await resume(page, study);

		await page.goto('/modules/games/cargo-haul/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="重卡公路"]')).toHaveAttribute('data-ready', '1', {
			timeout: 20_000
		});
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="云上散步天空"]')).toHaveAttribute(
			'data-ready',
			'1',
			{ timeout: 20_000 }
		);
		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-play="operation"]')).toBeVisible();
	});
});
