import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', 'light');
		if (!sessionStorage.getItem('qingxin.keepStore')) {
			localStorage.removeItem('qingxin.games.convenient-store');
		}
	});
}

async function openStore(page: Page) {
	await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
	const canvas = page.locator('canvas[aria-label="便利店三维店面"]');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
	return canvas;
}

async function tendShop(page: Page) {
	await page
		.getByRole('button', { name: /矿泉水/ })
		.first()
		.click();
	const restock = page.getByRole('button', { name: '从库房补货' });
	if (await restock.isEnabled()) await restock.click();
	const crate = page.getByRole('button', { name: /进一箱/ });
	if ((await crate.count()) && (await crate.first().isEnabled())) await crate.first().click();
}

test('natural 1x 3:00 shift restocks, sells, closes, then next shift pause/reload keeps best', async ({
	page
}) => {
	test.setTimeout(300_000);
	await boot(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	const canvas = await openStore(page);
	await expect(canvas).toHaveAttribute('data-day-ticks', '1800');
	await expect(page.getByText('3:00').first()).toBeVisible();
	await tendShop(page);
	const started = Date.now();
	while (Date.now() - started < 210_000) {
		if (await page.getByRole('heading', { name: '班次结束' }).isVisible()) break;
		const tick = Number(await canvas.getAttribute('data-tick'));
		if (tick >= 1800) break;
		await tendShop(page);
		await page.waitForTimeout(6000);
	}
	const elapsed = Date.now() - started;
	expect(elapsed).toBeGreaterThan(160_000);
	expect(elapsed).toBeLessThan(210_000);
	await expect(page.getByRole('heading', { name: '班次结束' })).toBeVisible({ timeout: 25_000 });
	await expect(canvas).toHaveAttribute('data-tick', '1800');
	await page.screenshot({ path: 'screenshots/store-shift-close-1280.png' });
	const saveAfterClose = await page.evaluate(() =>
		localStorage.getItem('qingxin.games.convenient-store')
	);
	expect(saveAfterClose).toBeTruthy();
	await page.locator('.overlay').getByRole('button', { name: '重新开始' }).click();
	await expect(page.getByRole('heading', { name: '班次结束' })).toHaveCount(0);
	await expect(page.getByText('3:00').first()).toBeVisible();
	expect(Number(await canvas.getAttribute('data-tick'))).toBeLessThan(40);
	await page.getByRole('button', { name: '暂停' }).click();
	await expect(canvas).toHaveAttribute('data-paused', '1');
	await page.screenshot({ path: 'screenshots/store-shift-next-pause-1280.png' });
	await page.evaluate(() => sessionStorage.setItem('qingxin.keepStore', '1'));
	await page.reload({ waitUntil: 'networkidle' });
	await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
	await expect(page.getByText('3:00').first()).toBeVisible();
	const saveAfterReload = await page.evaluate(() =>
		localStorage.getItem('qingxin.games.convenient-store')
	);
	expect(saveAfterReload).toBe(saveAfterClose);
	expect(saveAfterReload).toContain('bestRevenue');
});
