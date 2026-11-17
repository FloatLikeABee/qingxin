import { expect, test, type Page } from '@playwright/test';

async function acceptPrivacy(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
	});
}

async function registerFresh(page: Page) {
	const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
	const email = `pets-study-${stamp}@qingxin.app`;
	await acceptPrivacy(page);
	await page.goto('/register');
	await page.getByLabel('称呼').fill('豆豆家长');
	await page.getByLabel('邮箱').fill(email);
	await page.getByLabel('密码', { exact: true }).fill('correct-horse');
	await page.getByRole('button', { name: '注册' }).click();
	await expect(page.getByText('已登录：豆豆家长')).toBeVisible({ timeout: 15_000 });
}

test('adding a pet saves through the API and survives reload', async ({ page }) => {
	await registerFresh(page);
	await page.goto('/pets');
	await expect(page.getByRole('heading', { name: '宠物' })).toBeVisible();
	await expect(page.getByText('还没有毛孩子')).toBeVisible();

	await page.getByLabel('名字').fill('豆豆');
	await page.getByRole('button', { name: '添加宠物' }).click();
	await expect(page.getByRole('heading', { name: '豆豆' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('还没有毛孩子')).toHaveCount(0);

	await page.reload();
	await expect(page.getByRole('heading', { name: '豆豆' })).toBeVisible({ timeout: 15_000 });

	await page.getByRole('button', { name: '打卡' }).first().click();
	await expect(page.getByText('喂食 · 已完成 1')).toBeVisible({ timeout: 15_000 });

	await page.getByRole('link', { name: '打开档案' }).click();
	await expect(page.getByRole('heading', { name: '豆豆' })).toBeVisible();
	await page.getByLabel('克').fill('4200');
	await page.getByRole('button', { name: '记下体重' }).click();
	await expect(page.getByText('4.20 kg')).toBeVisible({ timeout: 15_000 });
});

test('study routes redirect to the retired notice without mounting check-in', async ({ page }) => {
	await registerFresh(page);
	await page.goto('/study');
	await expect(page.getByText('学习打卡已经从轻心主入口撤下')).toBeVisible();
	await expect(page.getByText('还没有挑战')).toHaveCount(0);
	await page.goto('/study/checkin');
	await expect(page.getByText('学习打卡已经从轻心主入口撤下')).toBeVisible();
	await expect(page.getByLabel('名称')).toHaveCount(0);
});
