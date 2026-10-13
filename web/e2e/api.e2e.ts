import { expect, test, type Page } from '@playwright/test';

async function acceptPrivacy(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
}

async function registerFresh(page: Page) {
	const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
	const email = `e2e-${stamp}@qingxin.app`;
	const note = `e2e心情${stamp}`;
	await acceptPrivacy(page);
	await page.goto('/register');
	await page.getByLabel('称呼').fill('E2E同学');
	await page.getByLabel('邮箱').fill(email);
	await page.getByLabel('密码').fill('correct-horse');
	await page.getByRole('button', { name: '注册' }).click();
	await expect(page.getByText('已登录：E2E同学')).toBeVisible({ timeout: 15_000 });
	return { email, note };
}

test('register round-trips through the Rust API', async ({ page }) => {
	const { note } = await registerFresh(page);
	await expect(page.getByText('退出登录')).toBeVisible();
	await expect(page.getByRole('link', { name: '登录 / 注册' })).toHaveCount(0);

	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();

	await page.goto('/modules/mood');
	await expect(page.getByRole('heading', { name: '情绪日记' })).toBeVisible();
	await page.getByRole('button', { name: '很好' }).click();
	await page.getByLabel('一句备注（选填）').fill(note);
	await page.getByRole('button', { name: '记下这一刻' }).click();
	await expect(page.getByText(note)).toBeVisible({ timeout: 15_000 });

	await page.goto('/modules/local');
	await expect(page.getByRole('heading', { name: '本地生活' })).toBeVisible();
	await page.getByRole('button', { name: '列表' }).click();
	await expect(page.getByText('轻心宠物医院').first()).toBeVisible();
});

test('finance health pets study share shell chrome', async ({ page }) => {
	await registerFresh(page);
	await page.setViewportSize({ width: 1280, height: 800 });

	await page.goto('/finance');
	await expect(page.locator('aside')).toBeVisible();
	await expect(page.getByRole('heading', { name: '财务' })).toBeVisible();
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();

	await page.goto('/wellness');
	await expect(page.getByRole('heading', { name: '健康' })).toBeVisible();
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();

	await page.goto('/pets');
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();

	await page.goto('/study');
	await expect(page.getByRole('link', { name: '返回模块中心' })).toBeVisible();
});
