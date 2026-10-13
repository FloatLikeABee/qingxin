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
			if (view.width < 800) {
				await expect(page.locator('nav.fixed')).toBeVisible();
			} else {
				await expect(page.locator('aside')).toBeVisible();
			}
			await page.screenshot({
				path: `screenshots/home-${view.name}-${theme}.png`,
				fullPage: view.width >= 800
			});
		});
	}
}

test('kit 390 light', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await boot(page, 'light');
	await openReady(page, '/kit');
	await expect(page.getByRole('heading', { name: '设计系统' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Button' })).toBeVisible();
	await page.screenshot({ path: 'screenshots/kit-390-light.png', fullPage: false });
});

test('modules 390 dark', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await boot(page, 'dark');
	await openReady(page, '/modules');
	await expect(page.getByRole('heading', { name: '模块中心' })).toBeVisible();
	await expect(page.getByRole('heading', { name: '情绪日记+冥想' })).toBeVisible();
	await expect(page.getByRole('heading', { name: '求职副业' })).toBeVisible();
	await page.addStyleTag({ content: 'nav.fixed { position: static; }' });
	await page.screenshot({ path: 'screenshots/modules-390-dark.png', fullPage: true });
});

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
				if (view.width < 800) {
					await page.addStyleTag({ content: 'nav.fixed { position: static; }' });
				}
				await page.screenshot({
					path: `screenshots/mood-${screen.key}-${view.name}-${theme}.png`,
					fullPage: true
				});
			});
		}
	}
}

test('settings 1280 light', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await boot(page, 'light');
	await openReady(page, '/settings');
	await expect(page.getByRole('heading', { name: '我的' })).toBeVisible();
	await expect(page.getByText('仅夜间开启')).toBeVisible();
	await page.screenshot({ path: 'screenshots/settings-1280-light.png', fullPage: true });
});
