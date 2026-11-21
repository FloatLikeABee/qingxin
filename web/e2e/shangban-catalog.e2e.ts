import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
	}, theme);
}

async function bootWithSave(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', 'light');
		localStorage.setItem(
			'qingxin.shangban',
			JSON.stringify({
				schema: 2,
				seed: 11,
				tick: 12,
				day: 3,
				player: { roleId: 'finance', floor: 4, pay: 44, x: 5, z: 4, reputation: 12 }
			})
		);
	});
}

test('catalog lists 上班 as a playable game on phone and desktop', async ({ page }) => {
	await boot(page);
	for (const view of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(view);
		await page.goto('/modules/games', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '轻心游戏' })).toBeVisible();
		const card = page.locator('a.game-card').filter({ hasText: '上班' });
		await expect(card).toBeVisible();
		await expect(card.getByText('即将到来')).toHaveCount(0);
		await expect(card.getByText('经营', { exact: true })).toBeVisible();
		await page.getByLabel('找一款想玩的').fill('上班');
		await expect(card).toBeVisible();
		await expect(page.getByRole('heading', { name: '晴空出击' })).toHaveCount(0);
		await page.getByLabel('找一款想玩的').fill('');
		await page.getByRole('button', { name: '经营' }).click();
		await expect(card).toBeVisible();
		await expect(page.getByRole('heading', { name: '便利店经理' }).first()).toBeVisible();
		await page.getByRole('button', { name: '经营' }).click();
	}
});

test('module hub no longer lists 上班 as a top-level tile', async ({ page }) => {
	await boot(page);
	for (const view of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(view);
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-board-tile="shangban"]')).toHaveCount(0);
		await expect(page.locator('[data-qx-topbar]').getByText('上班')).toHaveCount(0);
		await expect(page.locator('[data-board-tile="games"]')).toBeVisible();
		await expect(page.getByRole('heading', { name: '游戏' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '秘密' })).toBeVisible();
		await expect(page.getByRole('heading', { name: '积木台' })).toBeVisible();
	}
});

test('legacy /modules/shangban redirects into catalog play with immersive chrome', async ({
	page
}) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules/shangban', { waitUntil: 'networkidle' });
	await expect(page).toHaveURL(/\/modules\/games\/shangban\/play\/?$/);
	await expect(page.locator('[data-shangban="1"]')).toBeVisible();
	await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
	await expect(page.locator('[data-qx-topbar]')).toHaveCount(0);
	await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
	await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
	await expect(page.locator('canvas[aria-label="轻心大厦"]')).toHaveAttribute('data-ready', '1', {
		timeout: 20_000
	});
});

test('canonical catalog play keeps the same local save key and progress', async ({ page }) => {
	await bootWithSave(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/modules/games/shangban/play', { waitUntil: 'networkidle' });
	const root = page.locator('[data-shangban="1"]');
	await expect(root).toBeVisible();
	await expect(root).toHaveAttribute('data-role', 'finance');
	await expect(root).toHaveAttribute('data-pay', '44');
	await expect(root).toHaveAttribute('data-floor', '4');
	await expect(root).toHaveAttribute('data-day', '3');
	const key = await page.evaluate(() => localStorage.getItem('qingxin.shangban'));
	expect(key).toBeTruthy();
	expect(key).toContain('"schema":2');
	expect(key).toContain('finance');
});

test('desktop and phone catalog navigation reach play and return', async ({ page }) => {
	await boot(page);
	for (const view of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(view);
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
		await page.locator('[data-board-tile="games"]').click();
		await expect(page).toHaveURL(/\/modules\/games\/?$/);
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
		await page.locator('a.game-card').filter({ hasText: '上班' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/shangban\/?$/);
		await expect(page.getByRole('heading', { name: '上班', level: 1 })).toBeVisible();
		await expect(page.getByText('Workday')).toBeVisible();
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
		await page.getByRole('link', { name: '开始上班' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/shangban\/play\/?$/);
		await expect(page.locator('[data-qx-topbar]')).toHaveCount(0);
		await expect(page.locator('[data-shangban="1"]')).toBeVisible();
		await page.getByRole('link', { name: '← 返回目录' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/?$/);
		await expect(page.getByRole('heading', { name: '轻心游戏' })).toBeVisible();
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
	}
});

test('home 去上班 still reaches play through the legacy deep link', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '上班' }).first()).toBeVisible();
	await page.getByRole('link', { name: '去上班' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/shangban\/play\/?$/);
	await expect(page.locator('[data-shangban="1"]')).toBeVisible();
});
