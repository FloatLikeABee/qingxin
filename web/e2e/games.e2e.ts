import { expect, test, type Page } from '@playwright/test';
import {
	assertPotsAboveDock,
	bootGarden,
	gardenPause,
	gardenSnap,
	gardenTick,
	plantOnPot,
	spawnPest,
	tapPot,
	waitGarden
} from './garden-harness';

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
	await expect(page.getByRole('button', { name: '飞行' })).toBeVisible();
	await expect(page.getByRole('button', { name: '驾驶' })).toBeVisible();
	await page.getByLabel('找一款想玩的').fill('经理');
	await expect(page.getByRole('heading', { name: '便利店经理' }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: '晴空出击' })).toHaveCount(0);
	await page.getByLabel('找一款想玩的').fill('');
	await page.getByLabel('找一款想玩的').fill('年报');
	await expect(page.getByRole('heading', { name: '年报' }).first()).toBeVisible();
	await page.getByLabel('找一款想玩的').fill('');
	await page.getByLabel('找一款想玩的').fill('手术');
	await expect(page.getByRole('heading', { name: '手术' }).first()).toBeVisible();
	await page.getByLabel('找一款想玩的').fill('');
	await page.getByLabel('找一款想玩的').fill('烹饪');
	await expect(page.getByRole('heading', { name: '烹饪' }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: '灶台' })).toHaveCount(0);
	await page.getByLabel('找一款想玩的').fill('');
	await page.getByLabel('找一款想玩的').fill('医院');
	await expect(page.getByRole('heading', { name: '中医馆' }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: '医馆', exact: true })).toHaveCount(0);
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
	await page
		.getByRole('button', { name: /矿泉水/ })
		.first()
		.click();
	await page.getByRole('button', { name: '从库房补货' }).click();
	await expect(page.locator('canvas[data-shoppers]')).toHaveAttribute('data-shoppers', /[1-9]/, {
		timeout: 20_000
	});
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

test('annual report opens from catalog into play chrome', async ({ page }) => {
	await boot(page);
	await page.goto('/modules/games/annual-report', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '年报' })).toBeVisible();
	await expect(page.getByText(/不是真实财报/)).toBeVisible();
	await expect(page.getByRole('link', { name: '打开年报' })).toBeVisible();
	await page.getByRole('link', { name: '打开年报' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/annual-report\/play/);
	await expect(page.locator('[data-hud="mark"]')).toHaveText(/不是真实财报，也不连接 Excel/);
	await expect(page.getByRole('tab', { name: '假设' })).toBeVisible();
	await expect(page.getByLabel('公式栏')).toBeVisible();
});

test('cargo haul opens from catalog into play chrome', async ({ page }) => {
	await boot(page);
	await page.goto('/modules/games/cargo-haul', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '重卡' })).toBeVisible();
	await expect(page.getByRole('link', { name: '开始开车' })).toBeVisible();
	await page.getByRole('link', { name: '开始开车' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/cargo-haul\/play/);
	await expect(page.locator('canvas[aria-label="重卡公路"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
});

test('memory shelf opens from catalog into play chrome', async ({ page }) => {
	await boot(page);
	await page.goto('/modules/games/memory-shelf', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: '记忆货架' })).toBeVisible();
	await expect(page.getByRole('link', { name: '开始整理' })).toBeVisible();
	await page.getByRole('link', { name: '开始整理' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/memory-shelf\/play/);
	await expect(page.locator('canvas[aria-label="记忆货架书房"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
});

test('garden opens from catalog into play chrome', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules/games', { waitUntil: 'networkidle' });
	const garden = page.locator('a.game-card').filter({ hasText: '窗前庭园' });
	await expect(garden.getByText('即将到来')).toHaveCount(0);
	await garden.click();
	await expect(page.getByRole('heading', { name: '窗前庭园', level: 1 })).toBeVisible();
	await expect(
		page.getByText('番茄、黄瓜、茄子、辣椒、胡萝卜、萝卜、白菜、生菜、菠菜、小葱')
	).toBeVisible();
	await page.getByRole('link', { name: '开始种植' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/window-garden\/play/);
	await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
	await expect(page.locator('canvas[aria-label="窗前庭园"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('button', { name: '浇水' })).toBeVisible();
	await expect(page.getByRole('button', { name: '修剪' })).toBeVisible();
	await expect(page.getByRole('button', { name: '换盆' })).toBeVisible();
	await expect(page.getByRole('button', { name: /种下番茄/ })).toBeVisible();
	await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
	await expect(page.getByRole('button', { name: /^空盆$/ })).toHaveCount(0);
	await page.screenshot({ path: 'screenshots/garden-play-smoke-390.png' });
});

test('garden plants first, second, and last pots from scene taps and they grow independently', async ({
	page
}) => {
	test.setTimeout(90_000);
	await bootGarden(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules/games/window-garden/play', { waitUntil: 'networkidle' });
	await waitGarden(page);
	await gardenPause(page, true);
	await expect(page.locator('[data-seed-browser]')).toBeVisible();
	for (const name of [
		'番茄',
		'黄瓜',
		'茄子',
		'辣椒',
		'胡萝卜',
		'萝卜',
		'白菜',
		'生菜',
		'菠菜',
		'小葱'
	]) {
		await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
	}
	await plantOnPot(page, 0, '番茄');
	await plantOnPot(page, 1, '生菜');
	await plantOnPot(page, 11, '黄瓜');
	await tapPot(page, 0);
	const planted = await gardenSnap(page);
	expect(planted.selected).toBe(0);
	expect(planted.beds[1]?.plantId).toBe('lettuce');
	expect(planted.beds[1]?.stage).toBe('seed');
	await gardenTick(page, 20);
	const grown = await gardenSnap(page);
	expect(grown.beds[0]?.stage).not.toBe('seed');
	expect(grown.beds[1]?.stage).not.toBe('seed');
	expect(grown.beds[11]?.stage).not.toBe('seed');
	expect(page.locator('canvas')).toHaveAttribute('data-stages', /^(?!seed,seed).+/);
	const stagesAfter20 = await page
		.locator('canvas[aria-label="窗前庭园"]')
		.getAttribute('data-stages');
	expect(stagesAfter20?.split(',')[0]).not.toBe('seed');
	expect(stagesAfter20?.split(',')[1]).not.toBe('seed');
	expect(stagesAfter20?.split(',')[11]).not.toBe('seed');
	await gardenPause(page, false);
	await page.screenshot({ path: 'screenshots/garden-two-pot-growth-390.png' });
	await gardenPause(page, true);
	await gardenTick(page, 40);
	const ripe = await gardenSnap(page);
	expect(ripe.beds[0]?.stage).toBe('ripe');
	expect(ripe.beds[1]?.stage).toBe('ripe');
	expect(ripe.beds[11]?.stage).toBe('ripe');
	const stagesRipe = await page
		.locator('canvas[aria-label="窗前庭园"]')
		.getAttribute('data-stages');
	expect(stagesRipe?.split(',')[1]).toBe('ripe');
	await page.evaluate(() => sessionStorage.setItem('qingxin.keepGarden', '1'));
	await page.reload({ waitUntil: 'networkidle' });
	await waitGarden(page);
	const reloaded = await gardenSnap(page);
	expect(reloaded.beds[0]?.plantId).toBe('tomato');
	expect(reloaded.beds[1]?.plantId).toBe('lettuce');
	expect(reloaded.beds[11]?.plantId).toBe('cucumber');
	expect(reloaded.beds[1]?.stage).toBe('ripe');
	await gardenPause(page, true);
	await tapPot(page, 0);
	await page.getByRole('button', { name: '收获', exact: true }).click();
	await expect.poll(async () => (await gardenSnap(page)).beds[0]?.stage).toBe('empty');
	for (let id = 0; id < 12; id++) {
		await tapPot(page, id);
	}
	await assertPotsAboveDock(page);
});

test('garden care, bugs, harvest, and desktop pot taps', async ({ page }) => {
	test.setTimeout(90_000);
	await bootGarden(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/modules/games/window-garden/play', { waitUntil: 'networkidle' });
	await waitGarden(page);
	await gardenPause(page, true);
	await plantOnPot(page, 0, '番茄');
	await page.getByRole('button', { name: '浇水' }).click();
	await page.getByRole('button', { name: '施肥' }).click();
	await page.getByRole('button', { name: '修剪' }).click();
	await expect(page.getByText(/剪不得|修了一枝|剪得太勤/)).toBeVisible();
	await gardenTick(page, 16);
	await spawnPest(page, 0);
	await tapPot(page, 0);
	await page.getByRole('button', { name: /害虫/ }).first().click();
	await expect(page.getByText('捉走了害虫')).toBeVisible();
	await gardenTick(page, 48);
	await page.getByRole('button', { name: '换盆' }).click();
	await page.getByRole('button', { name: '收获', exact: true }).click();
	await expect.poll(async () => (await gardenSnap(page)).beds[0]?.stage).toBe('empty');
	for (let id = 0; id < 12; id++) {
		await tapPot(page, id);
	}
	await assertPotsAboveDock(page);
	await page.screenshot({ path: 'screenshots/garden-play-glass-1280.png' });
});

test('old florist and night routes redirect', async ({ page }) => {
	await boot(page);
	await page.goto('/modules/games/corner-florist', { waitUntil: 'networkidle' });
	await expect(page).toHaveURL(/\/modules\/games\/window-garden\/?$/);
	await expect(page.getByRole('heading', { name: '窗前庭园', level: 1 })).toBeVisible();
	await page.goto('/modules/games/night-puzzle', { waitUntil: 'networkidle' });
	await expect(page).toHaveURL(/\/modules\/games\/sky-sortie\/?$/);
	await expect(page.getByRole('heading', { name: '晴空出击', level: 1 })).toBeVisible();
});

test('shooter opens from catalog and plays', async ({ page }) => {
	test.setTimeout(90_000);
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/modules/games', { waitUntil: 'networkidle' });
	const jet = page.locator('a.game-card').filter({ hasText: '晴空出击' });
	await expect(jet.getByText('即将到来')).toHaveCount(0);
	await jet.click();
	await page.getByRole('link', { name: '开始出击' }).click();
	await expect(page).toHaveURL(/\/modules\/games\/sky-sortie\/play/);
	const canvas = page.locator('canvas[aria-label="晴空出击"]');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
	await expect(canvas).toHaveAttribute('data-fired', '1', { timeout: 5_000 });
	await expect(page.getByText('分数')).toBeVisible();
	await page.screenshot({ path: 'screenshots/sky-play-smoke-390.png' });

	const box = await canvas.boundingBox();
	if (!box) throw new Error('canvas box');
	await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.35);
	await page.mouse.down();
	await expect(canvas).toHaveAttribute('data-boss', '1', { timeout: 40_000 });
	await expect(page.getByText('头目来了')).toBeVisible();
	for (let i = 0; i < 120; i++) {
		await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.18);
		if ((await canvas.getAttribute('data-over')) === '1') break;
		await page.waitForTimeout(180);
	}
	await expect(page.getByText('结束了')).toBeVisible({ timeout: 20_000 });
	await page.mouse.up();
});

test('kit lives under 我的, not in tab bar', async ({ page }) => {
	await boot(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/settings', { waitUntil: 'networkidle' });
	await expect(page.getByRole('link', { name: /设计系统/ })).toBeVisible();
	const nav = page.locator('[data-qx-topbar]');
	await expect(nav.getByText('组件')).toHaveCount(0);
	await expect(nav.getByText('我的')).toBeVisible();
});
