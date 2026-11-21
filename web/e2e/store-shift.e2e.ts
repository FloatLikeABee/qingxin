import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', 'light');
	});
}

async function openStore(page: Page) {
	await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
	const canvas = page.locator('canvas[aria-label="便利店三维店面"]');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
	return canvas;
}

test('default shift is 3:00 with real restock and shoppers, pause holds the clock', async ({
	page
}) => {
	test.setTimeout(60_000);
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	const canvas = await openStore(page);
	await expect(canvas).toHaveAttribute('data-day-ticks', '1800');
	await expect(page.getByText('3:00').first()).toBeVisible();
	await expect(page.getByRole('button', { name: '从库房补货' })).toBeVisible();
	await page
		.getByRole('button', { name: /矿泉水/ })
		.first()
		.click();
	await page.getByRole('button', { name: '从库房补货' }).click();
	await expect(canvas).toHaveAttribute('data-shoppers', /[1-9]/, { timeout: 20_000 });
	const tick0 = Number(await canvas.getAttribute('data-tick'));
	await page.waitForTimeout(2200);
	const tick1 = Number(await canvas.getAttribute('data-tick'));
	expect(tick1).toBeGreaterThan(tick0 + 12);
	expect(tick1).toBeLessThan(tick0 + 40);
	await page.getByRole('button', { name: '暂停' }).click();
	await expect(canvas).toHaveAttribute('data-paused', '1');
	const paused = Number(await canvas.getAttribute('data-tick'));
	await page.waitForTimeout(1200);
	expect(Number(await canvas.getAttribute('data-tick'))).toBe(paused);
	await page.getByRole('button', { name: '继续' }).click();
	await page.screenshot({ path: 'screenshots/store-shift-3min-390.png' });
});
