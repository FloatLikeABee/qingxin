import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
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

async function noOverflow(page: Page, width: number) {
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(width + 2);
}

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

test.describe('space-glass shell', () => {
	for (const view of [
		{ width: 390, height: 844 },
		{ width: 768, height: 1024 },
		{ width: 1280, height: 800 },
		{ width: 1600, height: 900 }
	] as const) {
		test(`no sidebar or leftover gutter at ${view.width}`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page, 'dark');
			await page.goto('/modules', { waitUntil: 'networkidle' });
			await expect(page.locator('aside')).toHaveCount(0);
			await expect(page.locator('nav.fixed')).toHaveCount(0);
			await expect(page.locator('[data-qx-topbar]')).toBeVisible();
			await expect(page.getByRole('link', { name: '模块中心' }).first()).toBeVisible();
			const left = await page.locator('main').evaluate((el) => getComputedStyle(el).paddingLeft);
			expect(Number.parseFloat(left)).toBeLessThan(80);
			await noOverflow(page, view.width);
		});
	}

	test('top bar reaches board, 上班, settings, kit, login', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await boot(page, 'dark');
		await page.goto('/', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toBeVisible();
		await expect(page.getByRole('heading', { name: '上班' }).first()).toBeVisible();
		await page.locator('[data-qx-topbar]').getByRole('link', { name: '模块中心' }).click();
		await expect(page).toHaveURL(/\/modules\/?$/);
		await expect(page.locator('[data-board-tile="shangban"]')).toBeVisible();
		await page.locator('[data-board-tile="shangban"]').click();
		await expect(page).toHaveURL(/\/modules\/shangban/);
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-topbar]')).toHaveCount(0);
		await page.goto('/settings');
		await expect(page.getByRole('heading', { name: '我的' })).toBeVisible();
		await expect(page.getByRole('link', { name: /设计系统/ })).toBeVisible();
		await page.getByRole('link', { name: /设计系统/ }).click();
		await expect(page).toHaveURL(/\/kit/);
		await page.goto('/settings');
		await page.getByRole('button', { name: '退出登录' }).click();
		await expect(page.getByRole('link', { name: '登录 / 注册' })).toBeVisible();
		await page.getByRole('link', { name: '登录 / 注册' }).click();
		await expect(page).toHaveURL(/\/login/);
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
	});

	test('reduced motion keeps dust static', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules', { waitUntil: 'networkidle' });
		const dust = page.locator('[data-qx-dust]');
		await expect(dust).toBeVisible();
		await expect(dust).toHaveAttribute('data-anim', '0');
		await page.waitForTimeout(400);
		await expect(dust).toHaveAttribute('data-anim', '0');
	});

	test('guest dark hub after board nav looks like space glass', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toBeVisible();
		await expect(page.locator('[data-qx-dust]')).toHaveAttribute('data-anim', '1');
		await page.waitForTimeout(350);
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(bg.replace(/\s/g, '')).toMatch(/rgb\(7,\s*11,\s*20\)|#070b14/i);
		const card = page.locator('[data-board-tile="jimutai"] .qx-glass').first();
		await expect(card).toBeVisible();
		const ratio = await card.evaluate((el) => {
			const parse = (value: string) => {
				const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
				return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
			};
			const lum = (rgb: number[]) => {
				const parts = rgb.map((channel) => {
					const next = channel / 255;
					return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
				});
				return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!;
			};
			const cs = getComputedStyle(el);
			const fg = lum(parse(cs.color));
			const bg = lum(parse(cs.backgroundColor));
			const light = Math.max(fg, bg);
			const dark = Math.min(fg, bg);
			return (light + 0.05) / (dark + 0.05);
		});
		expect(ratio).toBeGreaterThanOrEqual(4.5);
		await page.screenshot({
			path: 'screenshots/space-glass-modules-1280-dark.png',
			fullPage: true
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.screenshot({ path: 'screenshots/space-glass-modules-390-dark.png', fullPage: true });
	});

	test('guest shell keeps login and does not write a theme', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
		});
		await page.goto('/', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
		await expect(page.locator('[data-board-tile="shangban"]')).toBeVisible();
		expect(await page.evaluate(() => localStorage.getItem('qingxin.theme'))).toBeNull();
		await page.locator('[data-qx-topbar]').getByRole('link', { name: '我的' }).click();
		await expect(page.getByRole('link', { name: '登录 / 注册' })).toBeVisible();
		await page.getByRole('link', { name: '登录 / 注册' }).click();
		await expect(page).toHaveURL(/\/login/);
		await expect(page.locator('.qx-glass-field').first()).toBeVisible();
		await expect(page.locator('section .qx-glass').first()).toBeVisible();
	});

	test('browser back, deep links, and keyboard reach the top bar', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await page.locator('[data-qx-topbar]').getByRole('link', { name: '我的' }).click();
		await expect(page).toHaveURL(/\/settings/);
		await page.goBack();
		await expect(page).toHaveURL(/\/modules\/?$/);
		await page.goto('/modules/mood');
		await expect(page.getByRole('link', { name: '返回模块中心' }).first()).toBeVisible();
		await page.goto('/privacy');
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
		await page.goto('/modules');
		await page.locator('[data-qx-topbar]').getByRole('link', { name: '首页' }).focus();
		await expect(
			page.locator('[data-qx-topbar]').getByRole('link', { name: '首页' })
		).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(
			page.locator('[data-qx-topbar]').getByRole('link', { name: '模块中心' })
		).toBeFocused();
	});

	test('reduced motion solidifies glass and dust never intercepts clicks', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules', { waitUntil: 'networkidle' });
		const dust = page.locator('[data-qx-dust]');
		await expect(dust).toHaveAttribute('data-anim', '0');
		const pe = await dust.evaluate((el) => getComputedStyle(el).pointerEvents);
		expect(pe).toBe('none');
		const glass = page.locator('[data-board-tile="jimutai"] .qx-glass').first();
		const blur = await glass.evaluate((el) => getComputedStyle(el).backdropFilter);
		expect(blur === 'none' || blur === '').toBeTruthy();
		await page.locator('[data-board-tile="finance"]').click();
		await expect(page).toHaveURL(/\/finance/);
	});

	test('dust cadence is bounded and play views unmount the field', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toHaveAttribute('data-anim', '1');
		await expect
			.poll(async () => page.locator('[data-qx-dust]').getAttribute('data-cadence'), {
				timeout: 2500
			})
			.not.toBeNull();
		const cadence = Number(await page.locator('[data-qx-dust]').getAttribute('data-cadence'));
		expect(cadence).toBeGreaterThanOrEqual(30);
		expect(cadence).toBeLessThanOrEqual(90);
		await page.goto('/modules/jimutai', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-topbar]')).toHaveCount(0);
	});

	test('after screenshots of hub, account, form, and game chrome', async ({ page }) => {
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
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		const shots: Array<{
			path: string;
			width: number;
			height: number;
			theme: 'light' | 'dark';
			route: string;
		}> = [
			{ path: '/', width: 1280, height: 800, theme: 'dark', route: 'home' },
			{ path: '/', width: 390, height: 844, theme: 'dark', route: 'home' },
			{ path: '/', width: 1280, height: 800, theme: 'light', route: 'home' },
			{ path: '/', width: 390, height: 844, theme: 'light', route: 'home' },
			{ path: '/modules', width: 1280, height: 800, theme: 'dark', route: 'modules' },
			{ path: '/modules', width: 390, height: 844, theme: 'dark', route: 'modules' },
			{ path: '/modules', width: 1280, height: 800, theme: 'light', route: 'modules' },
			{ path: '/modules', width: 390, height: 844, theme: 'light', route: 'modules' }
		];
		for (const shot of shots) {
			await page.setViewportSize({ width: shot.width, height: shot.height });
			await page.evaluate((theme) => {
				localStorage.setItem('qingxin.theme', theme);
			}, shot.theme);
			await page.goto(shot.path, { waitUntil: 'networkidle' });
			await expect(page.locator('[data-qx-dust]')).toHaveAttribute('data-anim', '1');
			await page.waitForTimeout(350);
			await page.screenshot({
				path: `screenshots/space-glass-after-${shot.route}-${shot.width}-${shot.theme}.png`,
				fullPage: true
			});
		}

		await page.setViewportSize({ width: 1280, height: 800 });
		await page.evaluate(() => localStorage.setItem('qingxin.theme', 'dark'));
		await page.goto('/settings', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '我的' })).toBeVisible();
		await page.screenshot({
			path: 'screenshots/space-glass-after-settings-1280-dark.png',
			fullPage: true
		});
		await page.goto('/login', { waitUntil: 'networkidle' });
		await page.screenshot({
			path: 'screenshots/space-glass-after-login-1280-dark.png',
			fullPage: true
		});
		await page.goto('/finance/add', { waitUntil: 'networkidle' });
		await page.screenshot({
			path: 'screenshots/space-glass-after-finance-1280-dark.png',
			fullPage: true
		});
		await page.goto('/kit', { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: '模态弹窗' }).click();
		await expect(page.getByRole('heading', { name: '模态说明' })).toBeVisible();
		await page.screenshot({ path: 'screenshots/space-glass-after-modal-1280-dark.png' });
		await page.keyboard.press('Escape');
		await page.goto('/modules/games/window-garden/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-garden-dock]')).toBeVisible();
		await page.screenshot({ path: 'screenshots/space-glass-after-garden-dock-1280-dark.png' });
		await page.goto('/modules/shangban', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-shangban-dock]')).toBeVisible({ timeout: 20_000 });
		await page.screenshot({ path: 'screenshots/space-glass-after-shangban-dock-390-dark.png' });
	});
});
