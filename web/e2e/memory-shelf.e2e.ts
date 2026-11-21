import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

const NAMES: Record<string, string> = {
	globe: '地球仪',
	cup: '茶杯',
	moth: '蛾标本',
	book: '旧书',
	bottle: '药水瓶',
	lamp: '台灯'
};

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
	await expect(page.locator('canvas[aria-label="记忆货架书房"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
}

async function slotsOf(page: Page) {
	const raw = await page.locator('canvas[aria-label="记忆货架书房"]').getAttribute('data-slots');
	return (raw ?? '').split(',');
}

async function restoreLayout(page: Page, original: string[]) {
	const study = page.locator('canvas[aria-label="记忆货架书房"]');
	for (let i = 0; i < original.length; i++) {
		const current = await slotsOf(page);
		if (current[i] === original[i]) continue;
		const want = original[i]!;
		const name = NAMES[want];
		if (!name) throw new Error(`no name for ${want}`);
		const held = await study.getAttribute('data-held');
		if (held !== want) {
			await page.getByRole('button', { name: `拿起${name}` }).click();
		}
		await page.getByRole('button', { name: `放到第${i + 1}格` }).click();
	}
}

test.describe('记忆货架', () => {
	test('guest inspects, corrects a wrong slot, unlocks the next shelf, and decorates', async ({
		page
	}) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/memory-shelf', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '记忆货架', level: 1 })).toBeVisible();
		await expect(page.getByText('Memory Shelf')).toBeVisible();
		await expect(page.getByText('没有计时，也没有分数')).toBeVisible();
		await expect(page.getByRole('link', { name: '开始整理' })).toBeVisible();
		await page.getByRole('link', { name: '开始整理' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/memory-shelf\/play/);
		await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
		await waitStudy(page);
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
		const study = page.locator('canvas[aria-label="记忆货架书房"]');
		await expect(study).toHaveAttribute('data-phase', 'observe');
		await expect(page.getByRole('button', { name: '我记住了' })).toBeVisible();
		await expect(page.getByRole('button', { name: '书房声' })).toBeVisible();
		await page.screenshot({ path: 'screenshots/memory-shelf-play-1280-dark.png' });
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(study).toBeVisible();
		await page.screenshot({ path: 'screenshots/memory-shelf-play-390-dark.png' });
		await page.setViewportSize({ width: 1280, height: 800 });

		const original = await slotsOf(page);
		expect(original.length).toBe(3);
		await page.getByRole('button', { name: `端详${NAMES[original[0]!]}` }).click();
		await expect(study).toHaveAttribute('data-inspect', original[0]!);
		const box = await study.boundingBox();
		if (box) {
			await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
			await page.mouse.down();
			await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.45);
			await page.mouse.up();
		}
		await page.getByRole('button', { name: '放下' }).click();
		await expect(study).toHaveAttribute('data-inspect', '');

		await page.getByRole('button', { name: '我记住了' }).click();
		await expect
			.poll(async () => study.getAttribute('data-phase'), { timeout: 8_000 })
			.toBe('restore');
		await page.screenshot({ path: 'screenshots/memory-shelf-restore-1280-dark.png' });

		const home = original.indexOf('globe');
		const wrong = home === 0 ? 1 : 0;
		await page.getByRole('button', { name: '拿起地球仪' }).click();
		await page.getByRole('button', { name: `放到第${wrong + 1}格` }).click();
		await expect(study).toHaveAttribute('data-wrong', '1');
		await expect(study).not.toHaveAttribute('data-phase', 'cleared');

		await restoreLayout(page, original);
		await expect
			.poll(async () => study.getAttribute('data-phase'), { timeout: 8_000 })
			.toBe('cleared');
		await expect
			.poll(async () => Number(await study.getAttribute('data-unlocked')))
			.toBeGreaterThanOrEqual(1);
		await page.screenshot({ path: 'screenshots/memory-shelf-solved-1280-dark.png' });

		await page.getByRole('button', { name: '下一架' }).click();
		await expect(study).toHaveAttribute('data-puzzle', '1');
		await expect(study).toHaveAttribute('data-phase', 'observe');
		expect((await slotsOf(page)).length).toBeGreaterThan(3);

		await page.getByRole('button', { name: '收藏室' }).click();
		await expect(study).toHaveAttribute('data-room', 'collection');
		await page.getByRole('button', { name: '摆放地球仪' }).click();
		await expect
			.poll(async () => Number(await study.getAttribute('data-arranged')))
			.toBeGreaterThanOrEqual(1);
		await page.screenshot({ path: 'screenshots/memory-shelf-room-1280-dark.png' });

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepShelf', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		await waitStudy(page);
		expect(Number(await study.getAttribute('data-unlocked'))).toBeGreaterThanOrEqual(1);
		expect(Number(await study.getAttribute('data-arranged'))).toBeGreaterThanOrEqual(1);
		expect(Number(await study.getAttribute('data-puzzle'))).toBeGreaterThanOrEqual(1);

		await page.getByRole('button', { name: '暂停' }).click();
		await expect(study).toHaveAttribute('data-anim', '0');
		await page.getByRole('button', { name: '继续' }).click();
		await page.getByRole('button', { name: '低细腻' }).click();
		await expect(study).toHaveAttribute('data-detail', 'low');
		await page.getByRole('button', { name: '书房声' }).click();
		await expect(study).toHaveAttribute('data-audio', '1');
		await page.getByRole('button', { name: '静音' }).click();
		await page.getByRole('button', { name: '收起操作' }).click();
		await expect(page.getByRole('button', { name: '摆放地球仪' })).toHaveCount(0);
		await page.getByRole('button', { name: '展开操作' }).click();

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(study).toBeVisible();
		await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
		await page.screenshot({ path: 'screenshots/memory-shelf-room-390-dark.png' });
	});

	test('reduced motion still paints the study; tide and cloud still boot', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		await waitStudy(page);
		await page.screenshot({ path: 'screenshots/memory-shelf-reduced-1280-light.png' });
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	});
});
