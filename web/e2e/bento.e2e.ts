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

async function assertNoOverflow(page: Page, width: number) {
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(width + 1);
}

const views = [
	{ name: '390', width: 390, height: 844 },
	{ name: '1280', width: 1280, height: 800 }
] as const;

const paths = ['/', '/modules', '/settings'] as const;

for (const view of views) {
	for (const path of paths) {
		test(`bento ${path} ${view.name} has host and no overflow`, async ({ page }) => {
			await page.setViewportSize({ width: view.width, height: view.height });
			await boot(page);
			await page.goto(path, { waitUntil: 'networkidle' });
			await expect(page.locator('[data-bento]').first()).toBeVisible();
			await assertNoOverflow(page, view.width);
		});
	}
}

test('password toggle reveals and hides the login field', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/login', { waitUntil: 'networkidle' });
	const field = page.locator('input[autocomplete="current-password"]');
	await expect(field).toHaveAttribute('type', 'password');
	await page.getByRole('button', { name: '显示密码' }).click();
	await expect(field).toHaveAttribute('type', 'text');
	await page.getByRole('button', { name: '隐藏密码' }).click();
	await expect(field).toHaveAttribute('type', 'password');
});

test('auth switch link is underlined and uses primary color', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
	await page.goto('/login', { waitUntil: 'networkidle' });
	const link = page.getByRole('link', { name: '创建账号' });
	await expect(link).toBeVisible();
	await expect(link).toHaveCSS('text-decoration-line', 'underline');
	const color = await link.evaluate((el) => getComputedStyle(el).color);
	expect(color.replace(/\s/g, '')).toMatch(/rgb\(59,\s*130,\s*246\)|#3b82f6/i);
});

test('module cards keep DOM focus order at 1280', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await boot(page);
	await page.goto('/modules', { waitUntil: 'networkidle' });
	const cards = page.locator('[data-bento-item] a[href^="/modules/"]');
	const hrefs = await cards.evaluateAll((els) =>
		els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? '')
	);
	expect(hrefs.length).toBeGreaterThan(3);
	await cards.nth(0).focus();
	const focused: string[] = [hrefs[0] ?? ''];
	for (let i = 1; i < hrefs.length; i++) {
		await page.keyboard.press('Tab');
		focused.push(
			await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('href') ?? '')
		);
	}
	expect(focused).toEqual(hrefs);
});
