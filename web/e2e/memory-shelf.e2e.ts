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

async function pauseWhen(page: Page, study: Locator, phase: string, minProgress = 0.25) {
	await expect.poll(async () => study.getAttribute('data-phase'), { timeout: 10_000 }).toBe(phase);
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
	test('guest rearranges books, meets one ghost, and starts a new round', async ({ page }) => {
		test.setTimeout(180_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/memory-shelf', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '记忆货架', level: 1 })).toBeVisible();
		await expect(page.getByText('Memory Shelf')).toBeVisible();
		await expect(page.getByText('没有计时，也没有分数')).toBeVisible();
		await expect(page.getByText('对不起！')).toBeVisible();
		await expect(page.getByRole('link', { name: '开始整理' })).toBeVisible();
		await page.getByRole('link', { name: '开始整理' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/memory-shelf\/play/);
		await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
		const study = await waitStudy(page);
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
		await expect(study).toHaveAttribute('data-phase', 'idle');
		await expect(study).toHaveAttribute('data-round', '0');
		expect(Number(await study.getAttribute('data-items'))).toBeGreaterThanOrEqual(20);
		await expect(page.getByRole('button', { name: '我记住了' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: '收藏室' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: '书房声' })).toBeVisible();
		await dualShot(page, study, 'memory-shelf-full');

		const before = await study.getAttribute('data-layout');
		const aid = await study.getAttribute('data-aid');
		await clickProjected(page, study, 'ax', 'ay');
		await expect(study).toHaveAttribute('data-held', aid!);
		await expect(study).toHaveAttribute('data-phase', 'idle');
		await dualShot(page, study, 'memory-shelf-place');
		await clickProjected(page, study, 'bx', 'by');
		await expect(study).toHaveAttribute('data-held', '');
		const swapped = await study.getAttribute('data-layout');
		expect(swapped).not.toBe(before);
		expect(
			(swapped ?? '').split('|').filter((line, i) => line !== before?.split('|')[i])
		).toHaveLength(2);

		await clickProjected(page, study, 'hx', 'hy');
		await pauseWhen(page, study, 'emerge', 0.3);
		await expect(study).toHaveAttribute('data-playing', '1');
		await dualShot(page, study, 'memory-shelf-emerge');
		await resume(page, study);

		await pauseWhen(page, study, 'cry', 0.2);
		await dualShot(page, study, 'memory-shelf-cry');
		await resume(page, study);

		await pauseWhen(page, study, 'sorry', 0.15);
		await expect(page.locator('p.sorry[data-apology="1"]')).toBeVisible();
		await expect(page.locator('p.sorry')).toContainText('对不起！');
		await expect(page.locator('p.sorry')).toContainText('sorry');
		await dualShot(page, study, 'memory-shelf-sorry');
		await resume(page, study);

		await pauseWhen(page, study, 'retreat', 0.15);
		await dualShot(page, study, 'memory-shelf-return');
		await resume(page, study);

		await expect
			.poll(async () => study.getAttribute('data-phase'), { timeout: 8_000 })
			.toBe('done');
		await expect(study).toHaveAttribute('data-apology', '0');
		await expect(page.getByRole('button', { name: '下一轮' })).toBeVisible();

		const haunt = await study.getAttribute('data-haunt');
		await clickProjected(page, study, 'hx', 'hy');
		await expect(study).toHaveAttribute('data-phase', 'done');
		await clickProjected(page, study, 'hx', 'hy');
		await expect(study).toHaveAttribute('data-phase', 'done');
		await expect(study).toHaveAttribute('data-haunt', haunt!);

		const layoutDone = await study.getAttribute('data-layout');
		await page.getByRole('button', { name: '下一轮' }).click();
		await expect(study).toHaveAttribute('data-phase', 'idle');
		await expect(study).toHaveAttribute('data-round', '1');
		expect(await study.getAttribute('data-haunt')).not.toBe(haunt);
		expect(await study.getAttribute('data-layout')).toBe(layoutDone);
		await expect(page.getByRole('button', { name: '下一轮' })).toHaveCount(0);

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepShelf', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		const again = await waitStudy(page);
		await expect(again).toHaveAttribute('data-round', '1');
		expect(await again.getAttribute('data-layout')).toBe(layoutDone);
		await expect(again).toHaveAttribute('data-phase', 'idle');

		await page.getByRole('button', { name: '暂停' }).click();
		await expect(again).toHaveAttribute('data-anim', '0');
		await page.getByRole('button', { name: '继续' }).click();
		await page.getByRole('button', { name: '低细腻' }).click();
		await expect(again).toHaveAttribute('data-detail', 'low');
		await page.getByRole('button', { name: '书房声' }).click();
		await expect(again).toHaveAttribute('data-audio', '1');
		await page.getByRole('button', { name: '静音' }).click();
		await page.getByRole('button', { name: '收起操作' }).click();
		await expect(page.getByRole('button', { name: '重新开始' })).toHaveCount(0);
		await page.getByRole('button', { name: '展开操作' }).click();
	});

	test('390 touch rearranges a book without dock grab buttons', async ({ page }) => {
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await boot(page, 'dark');
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		const study = await waitStudy(page);
		const before = await study.getAttribute('data-layout');
		const aid = await study.getAttribute('data-aid');
		const start = await canvasPoint(study, 'ax', 'ay');
		const dest = await canvasPoint(study, 'bx', 'by');
		await page.mouse.click(start.x, start.y);
		await expect(study).toHaveAttribute('data-held', aid!);
		await page.mouse.click(dest.x, dest.y);
		await expect(study).toHaveAttribute('data-held', '');
		expect(await study.getAttribute('data-layout')).not.toBe(before);
		await expect(page.getByRole('button', { name: /拿起|放到第/ })).toHaveCount(0);
		await page.screenshot({ path: 'screenshots/memory-shelf-touch-390-dark.png' });
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
		await expect(study).toHaveAttribute('data-phase', 'idle');
		await expect(study).toHaveAttribute('data-detail', 'low');
		const keys = await page.evaluate(() => ({
			theme: localStorage.getItem('qingxin.theme'),
			tide: localStorage.getItem('qingxin.games.tide-breath'),
			schema: JSON.parse(localStorage.getItem('qingxin.games.memory-shelf') || '{}').schema
		}));
		expect(keys.theme).toBe('dark');
		expect(keys.tide).toBe('{"schema":1}');
		expect(keys.schema).toBe(2);
	});

	test('reduced motion still shows apology; store tide cloud shangban still boot', async ({
		page
	}) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		const study = await waitStudy(page);
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
		await expect(page.locator('p.sorry[data-apology="1"]')).toBeVisible();
		await expect(page.locator('p.sorry')).toContainText('对不起！');
		await page.screenshot({ path: 'screenshots/memory-shelf-reduced-1280-light.png' });
		await resume(page, study);
		await expect
			.poll(async () => study.getAttribute('data-phase'), { timeout: 8_000 })
			.toBe('done');

		await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="便利店三维店面"]')).toHaveAttribute(
			'data-ready',
			'1',
			{ timeout: 20_000 }
		);
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="潮汐呼吸夜海"]')).toHaveAttribute(
			'data-ready',
			'1',
			{ timeout: 20_000 }
		);
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="云上散步天空"]')).toHaveAttribute(
			'data-ready',
			'1',
			{ timeout: 20_000 }
		);
		await page.goto('/modules/games/shangban/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="轻心大厦"]')).toHaveAttribute('data-ready', '1', {
			timeout: 20_000
		});
	});
});
