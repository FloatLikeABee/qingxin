import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem(
			'qingxin.session',
			JSON.stringify({
				userId: 'user-demo',
				displayName: '轻心同学',
				email: 'demo@qingxin.app',
				token: 'mock-token-demo'
			})
		);
	});
}

test('settings hides login/register while logged in', async ({ page }) => {
	await boot(page);
	await page.goto('/settings');
	await expect(page.getByRole('heading', { name: '我的' })).toBeVisible();
	await expect(page.getByText('已登录：轻心同学')).toBeVisible();
	await expect(page.getByText('退出登录')).toBeVisible();
	await expect(page.getByRole('link', { name: '登录 / 注册' })).toHaveCount(0);
});

test('logged-out settings still offers login', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
	await page.goto('/settings');
	await expect(page.getByRole('link', { name: '登录 / 注册' })).toBeVisible();
});

test('finance has sidebar, title, and hub link', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/finance');
	await expect(page.locator('aside')).toBeVisible();
	await expect(page.getByRole('heading', { name: '财务' })).toBeVisible();
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();
});

test('wellness has health title and hub link', async ({ page }) => {
	await boot(page);
	await page.goto('/wellness');
	await expect(page.getByRole('heading', { name: '健康' })).toBeVisible();
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();
});

test('pets and study link back to the hub', async ({ page }) => {
	await boot(page);
	await page.goto('/pets');
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();
	await page.goto('/study');
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();
});
