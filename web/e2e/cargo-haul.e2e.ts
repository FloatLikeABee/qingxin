import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		if (!sessionStorage.getItem('qingxin.keepHaul')) {
			localStorage.removeItem('qingxin.games.cargo-haul');
		}
	}, theme);
}

async function waitRoad(page: Page) {
	const road = page.locator('canvas[aria-label="重卡公路"]');
	await expect(road).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
	return road;
}

async function shot(page: Page, name: string) {
	await page.screenshot({ path: `screenshots/${name}.png` });
}

async function focusStage(page: Page) {
	await page.locator('[data-play="cargo"]').evaluate((el) => (el as HTMLElement).focus());
}

async function readRoad(road: Locator) {
	return road.evaluate((el) => ({
		speed: Number(el.getAttribute('data-speed')),
		yaw: Number(el.getAttribute('data-yaw')),
		x: Number(el.getAttribute('data-x')),
		z: Number(el.getAttribute('data-z')),
		biome: el.getAttribute('data-biome'),
		onroad: el.getAttribute('data-onroad'),
		reverse: el.getAttribute('data-reverse'),
		paused: el.getAttribute('data-paused'),
		odometer: Number(el.getAttribute('data-odometer')),
		fork: el.getAttribute('data-fork'),
		exitside: el.getAttribute('data-exitside'),
		recover: Number(el.getAttribute('data-recover')),
		anim: el.getAttribute('data-anim')
	}));
}


test.describe('重卡', () => {
	test('guest steers a heavy truck through a junction and biomes', async ({ page }) => {
		test.setTimeout(180_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games', { waitUntil: 'networkidle' });
		await expect(page.getByRole('button', { name: '驾驶' })).toBeVisible();
		await page.getByRole('button', { name: '驾驶' }).click();
		await expect(page.getByRole('heading', { name: '重卡' })).toBeVisible();
		await page.locator('a.game-card').filter({ hasText: '重卡' }).click();
		await expect(page.getByRole('heading', { name: '重卡', level: 1 })).toBeVisible();
		await expect(page.getByText('Heavy Haul')).toBeVisible();
		await expect(page.getByText(/倒车|回收/)).toBeVisible();
		await page.getByRole('link', { name: '开始开车' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/cargo-haul\/play/);
		await expect(page.getByRole('link', { name: '← 返回目录' })).toBeVisible();
		const road = await waitRoad(page);
		await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
		await expect(page.getByRole('button', { name: '引擎声' })).toBeVisible();
		await expect(page.getByRole('button', { name: '回收' })).toBeVisible();
		const start = await readRoad(road);
		expect(start.biome).toBe('highway');
		await shot(page, 'cargo-haul-highway-1280');

		await focusStage(page);
		const yaw0 = start.yaw;
		await page.keyboard.down('w');
		await expect
			.poll(async () => Number(await road.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeGreaterThan(start.speed + 1);

		const seen = new Set([start.biome ?? 'highway']);
		await expect
			.poll(
				async () => {
					await focusStage(page);
					await page.keyboard.down('w');
					return (await road.getAttribute('data-fork')) === '1';
				},
				{ timeout: 28_000 }
			)
			.toBe(true);
		await shot(page, 'cargo-haul-junction-1280');
		await expect
			.poll(
				async () => {
					await focusStage(page);
					await page.keyboard.down('w');
					const biome = await road.getAttribute('data-biome');
					if (biome && !seen.has(biome)) {
						seen.add(biome);
						await shot(page, `cargo-haul-${biome}-1280`);
					}
					return seen.has('highway') && seen.has('city') && seen.has('country');
				},
				{ timeout: 55_000 }
			)
			.toBe(true);
		await page.keyboard.down('d');
		await expect
			.poll(async () => Math.abs(Number(await road.getAttribute('data-yaw')) - yaw0), {
				timeout: 8_000
			})
			.toBeGreaterThan(0.05);
		await page.keyboard.up('d');

		await page.keyboard.up('w');
		await page.keyboard.down('s');
		await expect
			.poll(async () => Math.abs(Number(await road.getAttribute('data-speed'))), {
				timeout: 10_000
			})
			.toBeLessThan(1.6);
		await page.keyboard.up('s');
		await page.getByRole('button', { name: '挂倒车' }).click();
		await expect(road).toHaveAttribute('data-reverse', '1');
		await page.keyboard.down('w');
		await expect
			.poll(async () => Number(await road.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeLessThan(-0.8);
		await shot(page, 'cargo-haul-reverse-1280');
		await page.keyboard.up('w');
		await page.keyboard.press('r');

		const odo = Number(await road.getAttribute('data-odometer'));
		await page.getByRole('button', { name: '回收' }).click();
		await expect
			.poll(async () => Number(await road.getAttribute('data-recover')))
			.toBeGreaterThan(0);
		expect(Number(await road.getAttribute('data-odometer'))).toBeGreaterThanOrEqual(odo - 2);
		await expect
			.poll(async () => (await road.getAttribute('data-onroad')) === '1', { timeout: 8_000 })
			.toBe(true);
		await shot(page, 'cargo-haul-recover-1280');

		await page.getByRole('button', { name: '暂停' }).click();
		await expect(road).toHaveAttribute('data-anim', '0');
		await expect(road).toHaveAttribute('data-paused', '1');
		await page.getByRole('button', { name: '继续' }).click();
		await expect(road).toHaveAttribute('data-anim', '1');
		await expect(road).toHaveAttribute('data-paused', '0');
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
			document.dispatchEvent(new Event('visibilitychange'));
		});
		await page.waitForTimeout(400);
		await expect(road).toHaveAttribute('data-paused', '0');
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
			document.dispatchEvent(new Event('visibilitychange'));
		});
		await sessionStorageSet(page);
		const savedOdo = await road.getAttribute('data-odometer');
		await page.reload({ waitUntil: 'networkidle' });
		const road2 = await waitRoad(page);
		await expect
			.poll(async () => Number(await road2.getAttribute('data-odometer')))
			.toBeGreaterThan(Number(savedOdo) * 0.5);

		await page.setViewportSize({ width: 390, height: 844 });
		await expect.poll(async () => (await road2.boundingBox())?.width ?? 0).toBeLessThan(500);
		await expect(page.getByRole('button', { name: '油门', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: '刹车', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: '倒车', exact: true })).toBeVisible();
		const go = page.getByRole('button', { name: '油门', exact: true });
		const box = await go.boundingBox();
		expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		await go.dispatchEvent('pointerdown');
		await expect
			.poll(async () => Number(await road2.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeGreaterThan(2);
		await go.dispatchEvent('pointerup');
		await shot(page, 'cargo-haul-mobile-390');
		await page.getByRole('link', { name: '← 返回目录' }).click();
		await expect(page).toHaveURL(/\/modules\/games$/);
	});

	test('sibling catalog games still boot', async ({ page }) => {
		test.setTimeout(120_000);
		await boot(page, 'dark');
		await page.setViewportSize({ width: 1280, height: 800 });
		const routes: [string, string][] = [
			['/modules/games/convenient-store/play', '便利店三维店面'],
			['/modules/games/tide-breath/play', '潮汐呼吸夜海'],
			['/modules/games/cloud-walk/play', '云上散步天空'],
			['/modules/games/memory-shelf/play', '记忆货架书房'],
			['/modules/games/shangban/play', '轻心大厦']
		];
		for (const [path, label] of routes) {
			await page.goto(path, { waitUntil: 'networkidle' });
			const canvas = page.locator(`canvas[aria-label="${label}"]`);
			await expect(canvas).toBeVisible();
			await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		}
	});
});

async function sessionStorageSet(page: Page) {
	await page.evaluate(() => sessionStorage.setItem('qingxin.keepHaul', '1'));
}
