import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		if (!sessionStorage.getItem('qingxin.keepTide')) {
			localStorage.removeItem('qingxin.games.tide-breath');
		}
	}, theme);
}

async function waitSea(page: Page) {
	await expect(page.locator('canvas[aria-label="潮汐呼吸夜海"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
}

test.describe('潮汐呼吸', () => {
	test('guest hold/release changes the ocean, then a guided collect unlocks coral', async ({
		page
	}) => {
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/tide-breath', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '潮汐呼吸', level: 1 })).toBeVisible();
		await expect(page.getByText('不必憋气')).toBeVisible();
		await expect(page.getByRole('link', { name: '开始入海' })).toBeVisible();
		await page.getByRole('link', { name: '开始入海' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/tide-breath\/play/);
		await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
		await waitSea(page);
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
		await expect(page.getByRole('button', { name: '海声' })).toBeVisible();
		await expect(page.getByRole('button', { name: '低细腻' })).toBeVisible();
		const sea = page.locator('canvas[aria-label="潮汐呼吸夜海"]');
		await page.screenshot({ path: 'screenshots/tide-breath-play-1280-dark.png' });
		const swell0 = Number(await sea.getAttribute('data-swell'));
		await page.keyboard.down('Space');
		await expect
			.poll(async () => Number(await sea.getAttribute('data-swell')), { timeout: 4000 })
			.toBeGreaterThan(Math.max(0.15, swell0 + 0.08));
		expect(await sea.getAttribute('data-holding')).toBe('1');
		await page.keyboard.up('Space');
		await expect.poll(async () => await sea.getAttribute('data-holding')).toBe('0');
		await expect
			.poll(async () => Number(await sea.getAttribute('data-pulse')), { timeout: 2000 })
			.toBeGreaterThan(0.2);
		await page.screenshot({ path: 'screenshots/tide-breath-swell-1280-dark.png' });
		for (let i = 0; i < 10; i++) {
			await page.keyboard.down('Space');
			await page.keyboard.press('ArrowUp');
			await page.keyboard.press('ArrowUp');
			await page.waitForTimeout(180);
			await page.keyboard.up('Space');
			const stars = Number(await sea.getAttribute('data-stars'));
			if (stars >= 1) break;
		}
		await expect
			.poll(async () => Number(await sea.getAttribute('data-stars')), { timeout: 20_000 })
			.toBeGreaterThanOrEqual(1);
		await expect
			.poll(async () => Number(await sea.getAttribute('data-coral')), { timeout: 8_000 })
			.toBeGreaterThanOrEqual(1);
		await page.screenshot({ path: 'screenshots/tide-breath-coral-1280-dark.png' });
		await page.evaluate(() => sessionStorage.setItem('qingxin.keepTide', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		await waitSea(page);
		expect(Number(await sea.getAttribute('data-stars'))).toBeGreaterThanOrEqual(1);
		expect(Number(await sea.getAttribute('data-coral'))).toBeGreaterThanOrEqual(1);
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(sea).toHaveAttribute('data-anim', '0');
		const swellPaused = Number(await sea.getAttribute('data-swell'));
		await page.waitForTimeout(400);
		expect(Math.abs(Number(await sea.getAttribute('data-swell')) - swellPaused)).toBeLessThan(0.04);
		await page.getByRole('button', { name: '继续' }).click();
		await page.getByRole('button', { name: '低细腻' }).click();
		await expect(sea).toHaveAttribute('data-detail', 'low');
		expect(await sea.getAttribute('data-audio')).toBe('0');
		await page.getByRole('button', { name: '海声' }).click();
		await expect(sea).toHaveAttribute('data-audio', '1');
		await page.getByRole('button', { name: '静音' }).click();
		await expect(sea).toHaveAttribute('data-audio', '0');
		await page.getByRole('button', { name: '收起操作' }).click();
		await expect(page.getByRole('button', { name: '按住呼吸潮' })).toHaveCount(0);
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(sea).toBeVisible();
		await page.screenshot({ path: 'screenshots/tide-breath-play-390-dark.png' });
	});

	test('reduced motion still paints a night sea and other games still boot', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await waitSea(page);
		await page.screenshot({ path: 'screenshots/tide-breath-reduced-1280-light.png' });
		await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	});
});
