import { expect, test, type Page } from '@playwright/test';

const views = [
	{ name: '390', width: 390, height: 844 },
	{ name: '1280', width: 1280, height: 800 }
] as const;

const themes = ['light', 'dark'] as const;

async function boot(page: Page, theme: (typeof themes)[number]) {
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

async function openReady(page: Page, path: string) {
	await page.goto(path, { waitUntil: 'networkidle' });
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
}

for (const view of views) {
	for (const theme of themes) {
		test(`home ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/');
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			await expect(page.getByRole('heading', { name: '积木台' }).first()).toBeVisible();
			await expect(page.getByRole('heading', { name: '模块中心' }).first()).toBeVisible();
			await expect(page.getByRole('heading', { name: '上班' }).first()).toBeVisible();
			await expect(page.getByText('后勤与物流').first()).toBeVisible();
			await expect(page.getByText('经营管理').first()).toBeVisible();
			await expect(page.locator('aside')).toHaveCount(0);
			await expect(page.locator('nav.fixed')).toHaveCount(0);
			await expect(page.locator('[data-qx-topbar]')).toBeVisible();
			await page.screenshot({
				path: `screenshots/home-${view.name}-${theme}.png`,
				fullPage: true
			});
		});
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`create posting ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/modules/create');
			await expect(page.getByRole('heading', { name: '发布到社交平台' })).toBeVisible();
			await expect(page.getByRole('button', { name: '系统分享' })).toBeVisible();
			await page.screenshot({
				path: `screenshots/create-posting-${view.name}-${theme}.png`,
				fullPage: true
			});
		});
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`secrets mailbox ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/modules/secrets');
			await expect(page.getByRole('heading', { name: '秘密信箱' })).toBeVisible();
			await page.getByRole('checkbox').check();
			await page.getByPlaceholder('写给信箱的话，不必署名。').fill('把这句话交给信箱。');
			await page.getByRole('button', { name: '投进信箱' }).click();
			await expect(page.getByText('亲爱的来信人').first()).toBeVisible();
			const closeToast = page.getByRole('button', { name: '关闭提示' });
			if (await closeToast.count()) {
				await closeToast.first().click();
			}
			await page.screenshot({
				path: `screenshots/secrets-mailbox-${view.name}-${theme}.png`,
				fullPage: true
			});
		});
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`modules ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/modules');
			await expect(page.getByRole('heading', { name: '模块中心' })).toBeVisible();
			await expect(page.getByRole('heading', { name: '情绪日记+冥想' })).toBeVisible();
			await expect(page.getByRole('heading', { name: '积木台' })).toBeVisible();
			await expect(page.getByRole('heading', { name: '健康' })).toBeVisible();
			await expect(page.getByRole('heading', { name: '本地生活' })).toHaveCount(0);
			await expect(page.getByRole('heading', { name: '求职副业' })).toHaveCount(0);
			await page.screenshot({
				path: `screenshots/modules-${view.name}-${theme}.png`,
				fullPage: true
			});
		});
	}
}

const moodTabs = [
	{ key: 'journal', tab: '日记', ready: '示意洞察' },
	{ key: 'trends', tab: '趋势', ready: '这个月记下了' },
	{ key: 'meditate', tab: '冥想', ready: '4-7-8 呼吸' }
] as const;

for (const view of views) {
	for (const theme of themes) {
		for (const screen of moodTabs) {
			test(`mood ${screen.key} ${view.name} ${theme}`, async ({ page }) => {
				await page.setViewportSize({ width: view.width, height: view.height });
				await boot(page, theme);
				await openReady(page, '/modules/mood');
				await expect(page.getByRole('heading', { name: '情绪日记' })).toBeVisible();
				await expect(page.getByText('夜里醒了两次')).toBeVisible();
				await expect(page.getByText('示意洞察')).toBeVisible({ timeout: 10_000 });
				await page.getByRole('tab', { name: screen.tab }).click();
				await expect(page.getByText(screen.ready).first()).toBeVisible();
				await page.screenshot({
					path: `screenshots/mood-${screen.key}-${view.name}-${theme}.png`,
					fullPage: true
				});
			});
		}
	}
}

const retiredScreens = [
	{ key: 'local', path: '/modules/local', name: '本地生活' },
	{ key: 'ai', path: '/modules/ai', name: 'AI效率工具箱' },
	{ key: 'hustle', path: '/modules/hustle', name: '求职副业' },
	{ key: 'study', path: '/study', name: '学习打卡' }
] as const;

for (const view of views) {
	for (const theme of themes) {
		for (const screen of retiredScreens) {
			test(`retired ${screen.key} ${view.name} ${theme}`, async ({ page }) => {
				await page.setViewportSize({ width: view.width, height: view.height });
				await boot(page, theme);
				await openReady(page, screen.path);
				await expect(page.getByText(`${screen.name}已经从轻心主入口撤下`)).toBeVisible();
				await expect(page.getByRole('link', { name: '返回模块中心' }).first()).toBeVisible();
				await page.screenshot({
					path: `screenshots/retired-${screen.key}-${view.name}-${theme}.png`,
					fullPage: true
				});
			});
		}
	}
}

const createScreens = [
	{ key: 'editor', tab: '创作', ready: 'IDE 深色编辑区' },
	{ key: 'templates', tab: '模板', ready: '一键使用' },
	{ key: 'works', tab: '作品', ready: '版本历史' }
] as const;

for (const view of views) {
	for (const theme of themes) {
		for (const screen of createScreens) {
			test(`create ${screen.key} ${view.name} ${theme}`, async ({ page }) => {
				await page.setViewportSize({ width: view.width, height: view.height });
				await boot(page, theme);
				await openReady(page, '/modules/create');
				await expect(page.getByRole('heading', { name: '内容创作' })).toBeVisible();
				await expect(page.getByRole('button', { name: '生成' })).toBeVisible();
				await page.getByRole('tab', { name: screen.tab }).click();
				await expect(page.getByText(screen.ready).first()).toBeVisible();
				await page.screenshot({
					path: `screenshots/create-${screen.key}-${view.name}-${theme}.png`,
					fullPage: true
				});
			});
		}
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`games catalog ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/modules/games');
			await expect(page.getByRole('heading', { name: '轻心游戏' })).toBeVisible();
			await expect(page.getByRole('heading', { name: '便利店经理' }).first()).toBeVisible();
			await expect(page.getByRole('heading', { name: '窗前庭园' }).first()).toBeVisible();
			await expect(page.getByRole('heading', { name: '晴空出击' }).first()).toBeVisible();
			await expect(page.getByRole('button', { name: '经营' })).toBeVisible();
			const garden = page.locator('a.game-card').filter({ hasText: '窗前庭园' });
			const jet = page.locator('a.game-card').filter({ hasText: '晴空出击' });
			await expect(garden.getByText('即将到来')).toHaveCount(0);
			await expect(jet.getByText('即将到来')).toHaveCount(0);
			await page.screenshot({
				path: `screenshots/games-catalog-${view.name}-${theme}.png`,
				fullPage: true
			});
		});
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`store play ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/modules/games/convenient-store/play');
			await expect(page.locator('canvas[aria-label="便利店三维店面"]')).toBeVisible();
			await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
			await expect(page.getByRole('button', { name: '从库房补货' })).toBeVisible();
			await page.waitForTimeout(1200);
			const storeScroll = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(storeScroll).toBeLessThanOrEqual(view.width + 2);
			await page.screenshot({
				path: `screenshots/store-play-${view.name}-${theme}.png`
			});
		});
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`garden play ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await page.addInitScript(() => {
				if (!sessionStorage.getItem('qingxin.keepGarden')) {
					localStorage.removeItem('qingxin.games.window-garden');
				}
				(window as { __qingxinE2E?: boolean }).__qingxinE2E = true;
			});
			await openReady(page, '/modules/games/window-garden/play');
			await expect(page.locator('canvas[aria-label="窗前庭园"]')).toBeVisible();
			await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
			await expect(page.getByRole('button', { name: '浇水' })).toBeVisible();
			await page.waitForFunction(() =>
				Boolean(
					(
						window as { __qingxinGardenTest?: { potClient: (id: number) => unknown } }
					).__qingxinGardenTest?.potClient(0)
				)
			);
			await page.evaluate(() => {
				(
					window as { __qingxinGardenTest?: { setPaused: (paused: boolean) => void } }
				).__qingxinGardenTest?.setPaused(true);
			});
			const clickPot = async (id: number) => {
				const pt = await page.evaluate((bedId) => {
					return (
						window as {
							__qingxinGardenTest?: { potClient: (id: number) => { x: number; y: number } | null };
						}
					).__qingxinGardenTest?.potClient(bedId);
				}, id);
				if (!pt) throw new Error(`pot ${id}`);
				await page.mouse.click(pt.x, pt.y);
			};
			await clickPot(0);
			await page.getByRole('button', { name: '番茄', exact: true }).click();
			await page.getByRole('button', { name: '种下番茄' }).click();
			await clickPot(1);
			await page.getByRole('button', { name: '生菜', exact: true }).click();
			await page.getByRole('button', { name: '种下生菜' }).click();
			await page.evaluate(() => {
				const api = (
					window as {
						__qingxinGardenTest?: {
							tick: (n: number) => void;
							setPaused: (paused: boolean) => void;
						};
					}
				).__qingxinGardenTest;
				api?.tick(24);
				api?.setPaused(false);
			});
			await expect(page.locator('canvas[aria-label="窗前庭园"]')).toHaveAttribute(
				'data-plants',
				/tomato,lettuce/
			);
			const gardenScroll = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(gardenScroll).toBeLessThanOrEqual(view.width + 2);
			await page.screenshot({
				path: `screenshots/garden-play-${view.name}-${theme}.png`
			});
		});
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`sky play ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/modules/games/sky-sortie/play');
			const canvas = page.locator('canvas[aria-label="晴空出击"]');
			await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
			await page.waitForTimeout(800);
			await page.screenshot({
				path: `screenshots/sky-play-${view.name}-${theme}.png`
			});
		});
	}
}

for (const view of views) {
	for (const theme of themes) {
		test(`settings ${view.name} ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, theme);
			await openReady(page, '/settings');
			await expect(page.getByRole('heading', { name: '我的' })).toBeVisible();
			await expect(page.getByText('仅夜间开启')).toBeVisible();
			await page.screenshot({
				path: `screenshots/settings-${view.name}-${theme}.png`,
				fullPage: true
			});
		});
	}
}
