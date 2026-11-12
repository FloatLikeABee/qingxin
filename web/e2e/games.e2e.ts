import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		localStorage.setItem(
			'qingxin.session',
			JSON.stringify({
				userId: 'user-demo',
				displayName: '轻心同学',
				email: 'demo@qingxin.app',
				token: 'mock-token-demo'
			})
		);
	}, theme);
}

test('hub lists 游戏 as an openable module', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules', { waitUntil: 'networkidle' });
	const gameCard = page.getByRole('link', { name: /游戏/ }).first();
	await expect(gameCard).toBeVisible();
	await expect(page.getByRole('button', { name: '即将到来' })).toHaveCount(0);
	await gameCard.click();
	await expect(page).toHaveURL(/\/modules\/games/);
	await expect(page.getByRole('heading', { name: '轻心游戏' })).toBeVisible();
});

test('catalog search and category filter', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/modules/games', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '轻心游戏' })).toBeVisible();
	await expect(page.getByRole('button', { name: '经营' })).toBeVisible();
	await expect(page.getByRole('button', { name: '休闲' })).toBeVisible();
	await expect(page.getByRole('button', { name: '益智' })).toBeVisible();
	await expect(page.getByRole('button', { name: '节奏' })).toBeVisible();
	await page.getByLabel('找一款想玩的').fill('经理');
	await expect(page.getByRole('heading', { name: '便利店经理' }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: '夜窗拼图' })).toHaveCount(0);
	await page.getByLabel('找一款想玩的').fill('');
	await page.getByRole('button', { name: '节奏' }).click();
	await expect(page.getByRole('heading', { name: '潮汐呼吸' })).toBeVisible();
	await expect(page.getByRole('heading', { name: '便利店经理' })).toHaveCount(0);
});

test('card opens detail then play chrome', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules/games', { waitUntil: 'networkidle' });
	await page.getByRole('link', { name: '先看介绍' }).click();
	await expect(page.getByRole('heading', { name: '便利店经理', level: 1 })).toBeVisible();
	await expect(page.getByText('Convenient Store Manager')).toBeVisible();
	await expect(page.getByRole('heading', { name: '关于这款游戏' })).toBeVisible();
	await page.getByRole('link', { name: '开始经营' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/convenient-store\/play/);
	await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
	await expect(page.locator('canvas[aria-label="便利店三维店面"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
	await expect(page.getByRole('button', { name: '重新开始' })).toBeVisible();
	await expect(page.getByText('现金')).toBeVisible();
	await expect(page.getByRole('button', { name: '从库房补货' })).toBeVisible();
	await page.screenshot({ path: 'screenshots/store-play-smoke-390.png' });
	await page.getByRole('link', { name: '← 返回目录' }).click();
	await expect(page.getByRole('heading', { name: '轻心游戏' })).toBeVisible();
});

test('play mounts without a session', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', 'light');
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
	await expect(page.locator('canvas[aria-label="便利店三维店面"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('heading', { name: '便利店经理' })).toBeVisible();
	await expect(page.getByRole('button', { name: /架上/ }).first()).toBeVisible();
	await page.getByRole('button', { name: '暂停' }).click();
	await expect(page.getByText('客人还在店门口等着。')).toBeVisible();
});

test('coming soon game cannot start a session', async ({ page }) => {
	await boot(page);
	await page.goto('/modules/games/night-puzzle', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '夜窗拼图' })).toBeVisible();
	await expect(page.getByRole('button', { name: '即将到来' })).toBeDisabled();
	await expect(page.locator('canvas')).toHaveCount(0);
});

test('kit lives under 我的, not in tab bar', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/settings', { waitUntil: 'networkidle' });
	await expect(page.getByRole('link', { name: /设计系统/ })).toBeVisible();
	const nav = page.locator('nav.fixed');
	await expect(nav.getByText('组件')).toHaveCount(0);
	await expect(nav.getByText('我的')).toBeVisible();
});
