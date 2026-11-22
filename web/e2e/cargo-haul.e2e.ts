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
		anim: el.getAttribute('data-anim'),
		steer: Number(el.getAttribute('data-steer')),
		throttle: Number(el.getAttribute('data-throttle')),
		brake: Number(el.getAttribute('data-brake')),
		steerPtr: el.getAttribute('data-steer-ptr'),
		throttlePtr: el.getAttribute('data-throttle-ptr'),
		hrNdc: Number(el.getAttribute('data-hr-ndc')),
		hlNdc: Number(el.getAttribute('data-hl-ndc')),
		truckNdc: Number(el.getAttribute('data-truck-ndc')),
		camDet: Number(el.getAttribute('data-cam-det'))
	}));
}

function cabRightDelta(
	start: { x: number; z: number; yaw: number },
	now: { x: number; z: number }
) {
	return (now.x - start.x) * Math.cos(start.yaw) + (now.z - start.z) * Math.sin(start.yaw);
}

type Box = { x: number; y: number; width: number; height: number };

function boxesOverlap(a: Box, b: Box, slop = 1) {
	return (
		a.x + slop < b.x + b.width &&
		a.x + a.width > b.x + slop &&
		a.y + slop < b.y + b.height &&
		a.y + a.height > b.y + slop
	);
}

async function assertHudClear(page: Page) {
	const back = await page.locator('[data-hud="back"]').boundingBox();
	const stats = await page.locator('[data-hud="stats"]').boundingBox();
	const actions = await page.locator('[data-hud="actions"]').boundingBox();
	const km = await page.locator('[data-hud="km"]').boundingBox();
	const biome = await page.locator('[data-hud="biome"]').boundingBox();
	expect(back).toBeTruthy();
	expect(stats).toBeTruthy();
	expect(actions).toBeTruthy();
	expect(km).toBeTruthy();
	expect(biome).toBeTruthy();
	expect(boxesOverlap(back!, km!), '返回目录 overlaps 里程').toBe(false);
	expect(boxesOverlap(back!, stats!), '返回目录 overlaps stats').toBe(false);
	expect(boxesOverlap(biome!, actions!), '路况 overlaps 暂停').toBe(false);
	expect(boxesOverlap(stats!, actions!), 'stats overlap actions').toBe(false);
}

async function firePointer(
	locator: Locator,
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	pointerId: number,
	clientX: number,
	clientY: number
) {
	await locator.evaluate(
		(el, args) => {
			el.dispatchEvent(
				new PointerEvent(args.type, {
					pointerId: args.pointerId,
					pointerType: 'touch',
					isPrimary: args.pointerId === 11,
					clientX: args.clientX,
					clientY: args.clientY,
					bubbles: true,
					cancelable: true,
					buttons: args.type === 'pointerdown' || args.type === 'pointermove' ? 1 : 0
				})
			);
		},
		{ type, pointerId, clientX, clientY }
	);
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
		await expect(page.getByRole('slider', { name: '方向盘' })).toBeHidden();
		const start = await readRoad(road);
		expect(start.biome).toBe('highway');
		expect(start.hrNdc).toBeGreaterThan(start.hlNdc);
		expect(start.camDet).toBeGreaterThan(0.5);
		expect(Math.abs(start.truckNdc)).toBeLessThan(0.45);
		await assertHudClear(page);
		await shot(page, 'cargo-haul-highway-1280');

		await focusStage(page);
		const yaw0 = start.yaw;
		await page.keyboard.down('w');
		await expect
			.poll(async () => Number(await road.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeGreaterThan(start.speed + 1);

		const poseD = await readRoad(road);
		await page.keyboard.down('d');
		await expect
			.poll(async () => {
				const now = await readRoad(road);
				return cabRightDelta(poseD, now);
			}, { timeout: 8_000 })
			.toBeGreaterThan(0.2);
		await expect.poll(async () => Number(await road.getAttribute('data-steer'))).toBe(1);
		await page.keyboard.down('a');
		await expect.poll(async () => Number(await road.getAttribute('data-steer'))).toBe(-1);
		await page.keyboard.up('a');
		await expect.poll(async () => Number(await road.getAttribute('data-steer'))).toBe(1);
		await page.keyboard.up('d');
		await expect.poll(async () => Number(await road.getAttribute('data-steer'))).toBe(0);

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
		const poseR = await readRoad(road);
		await page.keyboard.down('d');
		await expect
			.poll(async () => {
				const now = await readRoad(road);
				return cabRightDelta(poseR, now);
			}, { timeout: 8_000 })
			.toBeGreaterThan(0.15);
		await shot(page, 'cargo-haul-reverse-1280');
		await page.keyboard.up('d');
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
		await assertHudClear(page);
		await shot(page, 'cargo-haul-hud-1280');

		await page.setViewportSize({ width: 390, height: 844 });
		await expect.poll(async () => (await road2.boundingBox())?.width ?? 0).toBeLessThan(500);
		await expect(page.getByRole('button', { name: '油门', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: '刹车', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: '倒车', exact: true })).toBeVisible();
		await expect(page.getByRole('slider', { name: '方向盘' })).toBeVisible();
		await assertHudClear(page);
		const go = page.getByRole('button', { name: '油门', exact: true });
		const box = await go.boundingBox();
		expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		await go.dispatchEvent('pointerdown');
		await expect
			.poll(async () => Number(await road2.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeGreaterThan(2);
		await go.dispatchEvent('pointerup');
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

test.describe('重卡 390 touch', () => {
	test.use({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true
	});

	test('fresh guest uses visible wheel with unclipped HUD', async ({ page }) => {
		test.setTimeout(120_000);
		await boot(page, 'dark');
		await page.goto('/modules/games', { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: '驾驶' }).click();
		await page.locator('a.game-card').filter({ hasText: '重卡' }).click();
		await page.getByRole('link', { name: '开始开车' }).click();
		const road = await waitRoad(page);
		const wheel = page.getByRole('slider', { name: '方向盘' });
		const go = page.getByRole('button', { name: '油门', exact: true });
		const brake = page.getByRole('button', { name: '刹车', exact: true });
		const reverse = page.getByRole('button', { name: '倒车', exact: true });
		await expect(wheel).toBeVisible();
		await expect(go).toBeVisible();
		await expect(brake).toBeVisible();
		await expect(reverse).toBeVisible();
		await assertHudClear(page);
		const wheelBox = await wheel.boundingBox();
		const goBox = await go.boundingBox();
		const dock = page.getByRole('region', { name: '重卡操作' });
		const dockBox = await dock.boundingBox();
		expect(wheelBox).toBeTruthy();
		expect(goBox).toBeTruthy();
		expect((wheelBox?.width ?? 0) >= 44 && (wheelBox?.height ?? 0) >= 44).toBe(true);
		expect((goBox?.width ?? 0) >= 44 && (goBox?.height ?? 0) >= 44).toBe(true);
		if (wheelBox && dockBox) expect(boxesOverlap(wheelBox, dockBox)).toBe(false);
		if (goBox && dockBox) expect(boxesOverlap(goBox, dockBox)).toBe(false);
		const start = await readRoad(road);
		expect(start.recover).toBe(0);
		expect(start.hrNdc).toBeGreaterThan(start.hlNdc);
		expect(start.camDet).toBeGreaterThan(0.5);
		expect(Math.abs(start.truckNdc)).toBeLessThan(0.45);
		await shot(page, 'cargo-haul-mobile-390');

		const leftX = (wheelBox?.x ?? 0) + (wheelBox?.width ?? 0) * 0.14;
		const wheelY = (wheelBox?.y ?? 0) + (wheelBox?.height ?? 0) * 0.42;
		const goX = (goBox?.x ?? 0) + (goBox?.width ?? 0) * 0.5;
		const goY = (goBox?.y ?? 0) + (goBox?.height ?? 0) * 0.5;
		await firePointer(wheel, 'pointerdown', 11, leftX, wheelY);
		await firePointer(go, 'pointerdown', 22, goX, goY);
		await expect
			.poll(async () => Number(await road.getAttribute('data-steer')), { timeout: 6_000 })
			.toBeLessThan(-0.3);
		await expect(road).toHaveAttribute('data-steer-ptr', '1');
		await expect(road).toHaveAttribute('data-throttle-ptr', '1');
		await expect(road).toHaveAttribute('data-throttle', '1');
		await expect
			.poll(async () => Number(await road.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeGreaterThan(start.speed + 0.8);
		await expect
			.poll(async () => Math.abs(Number(await road.getAttribute('data-yaw')) - start.yaw), {
				timeout: 8_000
			})
			.toBeGreaterThan(0.04);
		expect(Number(await road.getAttribute('data-recover'))).toBe(0);
		await shot(page, 'cargo-haul-mobile-steer-390');

		await firePointer(go, 'pointercancel', 22, goX, goY);
		await expect.poll(async () => Number(await road.getAttribute('data-throttle'))).toBe(0);
		await expect(road).toHaveAttribute('data-throttle-ptr', '0');
		await expect(road).toHaveAttribute('data-steer-ptr', '1');

		await firePointer(go, 'pointerdown', 22, goX, goY);
		await expect(road).toHaveAttribute('data-throttle', '1');
		await page.evaluate(() => window.dispatchEvent(new Event('blur')));
		await expect.poll(async () => Number(await road.getAttribute('data-throttle'))).toBe(0);
		await expect(road).toHaveAttribute('data-steer-ptr', '0');
		await expect(road).toHaveAttribute('data-release', 'blur');

		await firePointer(go, 'pointerdown', 22, goX, goY);
		await expect(road).toHaveAttribute('data-throttle', '1');
		await page.getByRole('button', { name: '暂停' }).click();
		await expect(road).toHaveAttribute('data-paused', '1');
		await expect.poll(async () => Number(await road.getAttribute('data-throttle'))).toBe(0);
		await expect(road).toHaveAttribute('data-release', 'pause');
		await page.getByRole('button', { name: '继续' }).click();

		await firePointer(go, 'pointerdown', 22, goX, goY);
		await expect
			.poll(async () => Number(await road.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeGreaterThan(3);
		await firePointer(go, 'pointerup', 22, goX, goY);
		const rolling = Number(await road.getAttribute('data-speed'));
		const brakeBox = await brake.boundingBox();
		await firePointer(brake, 'pointerdown', 33, (brakeBox?.x ?? 0) + 10, (brakeBox?.y ?? 0) + 10);
		await expect.poll(async () => Number(await road.getAttribute('data-brake'))).toBe(1);
		await expect
			.poll(async () => Number(await road.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeLessThan(rolling - 0.4);
		await firePointer(brake, 'pointerup', 33, (brakeBox?.x ?? 0) + 10, (brakeBox?.y ?? 0) + 10);

		await expect
			.poll(async () => Math.abs(Number(await road.getAttribute('data-speed'))), {
				timeout: 10_000
			})
			.toBeLessThan(2.2);
		await reverse.click();
		await expect(road).toHaveAttribute('data-reverse', '1');
		await firePointer(go, 'pointerdown', 22, goX, goY);
		await expect
			.poll(async () => Number(await road.getAttribute('data-speed')), { timeout: 8_000 })
			.toBeLessThan(-0.4);
		await firePointer(go, 'pointerup', 22, goX, goY);
		expect(Number(await road.getAttribute('data-recover'))).toBe(0);

		await page.setViewportSize({ width: 320, height: 720 });
		await expect(wheel).toBeVisible();
		await assertHudClear(page);
	});
});

test.describe('重卡 320 dock', () => {
	test.use({
		viewport: { width: 320, height: 720 },
		hasTouch: true,
		isMobile: true
	});

	test('fresh 320 guest starts with dock collapsed and truck in the gap', async ({ page }) => {
		test.setTimeout(60_000);
		await boot(page, 'dark');
		await page.goto('/modules/games/cargo-haul/play', { waitUntil: 'networkidle' });
		const road = await waitRoad(page);
		const wheel = page.getByRole('slider', { name: '方向盘' });
		const go = page.getByRole('button', { name: '油门', exact: true });
		await expect(wheel).toBeVisible();
		await expect(go).toBeVisible();
		await expect(page.getByRole('region', { name: '重卡操作' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: '展开操作' })).toBeVisible();
		await assertHudClear(page);
		const wheelBox = await wheel.boundingBox();
		const goBox = await go.boundingBox();
		expect((goBox?.width ?? 0) >= 44 && (goBox?.height ?? 0) >= 44).toBe(true);
		if (wheelBox && goBox) expect(boxesOverlap(wheelBox, goBox)).toBe(false);
		const pose = await readRoad(road);
		expect(pose.hrNdc).toBeGreaterThan(pose.hlNdc);
		expect(Math.abs(pose.truckNdc)).toBeLessThan(0.45);
		await shot(page, 'cargo-haul-mobile-320');
	});
});

async function sessionStorageSet(page: Page) {
	await page.evaluate(() => sessionStorage.setItem('qingxin.keepHaul', '1'));
}
