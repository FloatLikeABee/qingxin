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

test('content posting offers official share and copy, not a publisher login', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/modules/create', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '内容创作' })).toBeVisible();
	await expect(page.getByRole('heading', { name: '发布到社交平台' })).toBeVisible();
	await expect(page.getByRole('button', { name: '系统分享' })).toBeVisible();
	await expect(page.getByRole('button', { name: '复制文案' })).toBeVisible();
	await expect(page.getByRole('button', { name: '微信' })).toBeVisible();
	await expect(page.getByText('非官方接口')).toBeVisible();
	await page.getByRole('button', { name: '复制文案' }).click();
	await expect(page.getByText('已复制').first()).toBeVisible();
});

test('secrets mailbox requires consent and shows a letter board', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules/secrets', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '秘密信箱' })).toBeVisible();
	await expect(page.getByText('不是聊天')).toBeVisible();
	await expect(page.getByText('不会公开张贴')).toBeVisible();
	await page.getByRole('button', { name: '投进信箱' }).click();
	await expect(page.getByText('请先同意').first()).toBeVisible();
	await page.getByRole('checkbox').check();
	await page.getByPlaceholder('写给信箱的话，不必署名。').fill('今天有点累，想把话放进信箱。');
	await page.getByRole('button', { name: '投进信箱' }).click();
	await expect(page.getByText('信已投进格子').first()).toBeVisible();
	await expect(page.getByRole('heading', { name: '木板上的信' })).toBeVisible();
	await expect(page.getByRole('button', { name: /信箱写的/ })).toBeVisible();
	await expect(page.getByText('亲爱的来信人')).toBeVisible();
	await expect(page.getByText('此致')).toBeVisible();
	await expect(page.getByRole('button', { name: /你写的/ })).toBeVisible();
});

test('primary nav dropped 组件 and added 内容', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	const nav = page.locator('nav.fixed');
	await expect(nav.getByText('内容')).toBeVisible();
	await expect(nav.getByText('组件')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: '秘密' })).toBeVisible();
});
