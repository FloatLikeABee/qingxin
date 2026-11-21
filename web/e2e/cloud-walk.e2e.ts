import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		if (!sessionStorage.getItem('qingxin.keepCloud')) {
			localStorage.removeItem('qingxin.games.cloud-walk');
		}
	}, theme);
}

async function waitSky(page: Page) {
	await expect(page.locator('canvas[aria-label="云上散步天空"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
}

test.describe('云上散步', () => {
	test('guest walks, rides wind, bounces, collects weather, and the garden persists', async ({
		page
	}) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/cloud-walk', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '云上散步', level: 1 })).toBeVisible();
		await expect(page.getByText('Cloud Walk')).toBeVisible();
		await expect(page.getByText('没有计时，也没有分数')).toBeVisible();
		await expect(page.getByRole('link', { name: '开始散步' })).toBeVisible();
		await page.getByRole('link', { name: '开始散步' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/cloud-walk\/play/);
		await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
		await waitSky(page);
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
		await expect(page.getByRole('button', { name: '风声' })).toBeVisible();
		await expect(page.getByRole('button', { name: '低细腻' })).toBeVisible();
		await expect(page.getByRole('button', { name: '跳一下' })).toBeVisible();
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-sky', 'dawn');
		await expect(sky).toHaveAttribute('data-garden', '0');
		await page.screenshot({ path: 'screenshots/cloud-walk-play-1280-dark.png' });

		await sky.click({ position: { x: 640, y: 360 } });
		await page.keyboard.down('ArrowRight');
		await expect.poll(async () => sky.getAttribute('data-wind'), { timeout: 18_000 }).toBe('1');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-island')), { timeout: 12_000 })
			.toBeGreaterThanOrEqual(1);
		await expect
			.poll(async () => Number(await sky.getAttribute('data-frags')), { timeout: 12_000 })
			.toBeGreaterThanOrEqual(1);
		await expect
			.poll(async () => sky.getAttribute('data-sky'), { timeout: 4_000 })
			.not.toBe('dawn');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-garden')))
			.toBeGreaterThanOrEqual(1);
		await page.screenshot({ path: 'screenshots/cloud-walk-wind-1280-dark.png' });

		const bounceDeadline = Date.now() + 16_000;
		while ((await sky.getAttribute('data-bounce')) !== '1' && Date.now() < bounceDeadline) {
			await page.keyboard.press('Space');
			await page.waitForTimeout(400);
		}
		await expect.poll(async () => sky.getAttribute('data-bounce'), { timeout: 20_000 }).toBe('1');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-island')), { timeout: 20_000 })
			.toBeGreaterThanOrEqual(2);
		await expect
			.poll(async () => Number(await sky.getAttribute('data-frags')), { timeout: 16_000 })
			.toBeGreaterThanOrEqual(2);
		await expect
			.poll(async () => Number(await sky.getAttribute('data-garden')))
			.toBeGreaterThanOrEqual(2);
		await page.keyboard.up('ArrowRight');
		await page.screenshot({ path: 'screenshots/cloud-walk-garden-1280-dark.png' });

		const skyMode = await sky.getAttribute('data-sky');
		const frags = Number(await sky.getAttribute('data-frags'));
		const garden = Number(await sky.getAttribute('data-garden'));
		expect(skyMode).not.toBe('dawn');
		expect(frags).toBeGreaterThanOrEqual(2);
		expect(garden).toBeGreaterThanOrEqual(2);

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepCloud', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		await waitSky(page);
		expect(Number(await sky.getAttribute('data-frags'))).toBeGreaterThanOrEqual(2);
		expect(Number(await sky.getAttribute('data-garden'))).toBeGreaterThanOrEqual(2);
		expect(await sky.getAttribute('data-sky')).not.toBe('dawn');

		await page.getByRole('button', { name: '暂停' }).click();
		await expect(sky).toHaveAttribute('data-anim', '0');
		const islandPaused = await sky.getAttribute('data-island');
		await page.waitForTimeout(400);
		expect(await sky.getAttribute('data-island')).toBe(islandPaused);
		await page.getByRole('button', { name: '继续' }).click();
		await page.getByRole('button', { name: '低细腻' }).click();
		await expect(sky).toHaveAttribute('data-detail', 'low');
		expect(await sky.getAttribute('data-audio')).toBe('0');
		await page.getByRole('button', { name: '风声' }).click();
		await expect(sky).toHaveAttribute('data-audio', '1');
		await page.getByRole('button', { name: '静音' }).click();
		await expect(sky).toHaveAttribute('data-audio', '0');
		await page.getByRole('button', { name: '收起操作' }).click();
		await expect(page.getByRole('button', { name: '跳一下' })).toHaveCount(0);
		await page.getByRole('button', { name: '展开操作' }).click();

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(sky).toBeVisible();
		await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
		await expect(page.getByRole('button', { name: '跳一下' })).toBeVisible();
		await page.screenshot({ path: 'screenshots/cloud-walk-play-390-dark.png' });
	});

	test('reduced motion still paints a sky and memory shelf stays coming', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		await page.screenshot({ path: 'screenshots/cloud-walk-reduced-1280-light.png' });
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/memory-shelf', { waitUntil: 'networkidle' });
		await expect(page.getByRole('button', { name: '即将到来' })).toBeDisabled();
	});
});
