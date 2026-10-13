import { expect, test } from '@playwright/test';

test('has expected h1', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});
