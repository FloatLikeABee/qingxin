import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 720 } }
});

async function boot(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', 'light');
		(window as { __qingxinE2E?: boolean }).__qingxinE2E = true;
	});
}

test('record sky sortie play', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/modules/games/sky-sortie/play', { waitUntil: 'networkidle' });
	const canvas = page.locator('canvas[aria-label="晴空出击"]');
	await expect(canvas).toHaveAttribute('data-fired', '1', { timeout: 10_000 });
	const box = await canvas.boundingBox();
	if (!box) throw new Error('canvas');
	await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
	await page.mouse.down();
	for (let i = 0; i < 40; i++) {
		await page.mouse.move(box.x + box.width * (0.3 + (i % 8) * 0.05), box.y + box.height * 0.42);
		await page.waitForTimeout(80);
	}
	await page.mouse.up();
	await page.screenshot({ path: 'screenshots/sky-play-gameplay.png' });
});

test('record window garden play', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/modules/games/window-garden/play', { waitUntil: 'networkidle' });
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await page.getByRole('button', { name: /种下番茄/ }).click();
	await page.getByRole('button', { name: '浇水' }).click();
	await page.getByRole('button', { name: '施肥' }).click();
	await page.getByRole('button', { name: '修剪' }).click();
	await page.evaluate(() => {
		(window as { __qingxinGardenTest?: { seedDemo: () => void } }).__qingxinGardenTest?.seedDemo();
	});
	await page.waitForTimeout(1600);
	await page.screenshot({ path: 'screenshots/garden-play-gameplay.png' });
});

test('record store play', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await page
		.getByRole('button', { name: /矿泉水/ })
		.first()
		.click();
	await page.getByRole('button', { name: '从库房补货' }).click();
	await page.waitForTimeout(1800);
	await page.screenshot({ path: 'screenshots/store-play-gameplay.png' });
});
