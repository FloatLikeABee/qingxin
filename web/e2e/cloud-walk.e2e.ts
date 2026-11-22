import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
		if (!sessionStorage.getItem('qingxin.keepCloud')) {
			localStorage.removeItem('qingxin.games.cloud-walk');
		}
	}, theme);
}

async function waitSky(page: Page) {
	await expect(page.locator('canvas[aria-label="云上散步天空"]')).toBeVisible();
	await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
}

type SkyVec = {
	x: number;
	y: number;
	z: number;
	r: number;
	biome: string | null;
	lookx: number;
	lookz: number;
	bound: boolean;
};

async function readSky(sky: Locator): Promise<SkyVec> {
	return sky.evaluate((el) => ({
		x: Number(el.getAttribute('data-x')),
		y: Number(el.getAttribute('data-y')),
		z: Number(el.getAttribute('data-z')),
		r: Number(el.getAttribute('data-r')),
		biome: el.getAttribute('data-biome'),
		lookx: Number(el.getAttribute('data-lookx')),
		lookz: Number(el.getAttribute('data-lookz')),
		bound: el.getAttribute('data-bound') === '1'
	}));
}

/** Chase camera +X: skyRight = (−lookZ, lookX) when look = (sin yaw, cos yaw). */
function alongScreenRight(from: SkyVec, to: SkyVec) {
	return (to.x - from.x) * -from.lookz + (to.z - from.z) * from.lookx;
}

async function shot(page: Page, name: string) {
	await page.screenshot({ path: `screenshots/${name}` });
}

async function focusStage(page: Page) {
	await page.locator('[data-play="cloud"]').evaluate((el) => (el as HTMLElement).focus());
}

async function holdShiftDive(page: Page, sky: Locator) {
	await focusStage(page);
	await page.keyboard.down('Shift');
	try {
		await expect(sky).toHaveAttribute('data-dive', '1', { timeout: 2500 });
	} catch {
		await page.evaluate(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Shift',
					code: 'ShiftLeft',
					bubbles: true,
					cancelable: true
				})
			);
		});
		await expect(sky).toHaveAttribute('data-dive', '1', { timeout: 2500 });
	}
}

async function releaseShiftDive(page: Page, sky: Locator) {
	await page.keyboard.up('Shift');
	try {
		await expect(sky).toHaveAttribute('data-dive', '0', { timeout: 2500 });
	} catch {
		await page.evaluate(() => {
			window.dispatchEvent(
				new KeyboardEvent('keyup', {
					key: 'Shift',
					code: 'ShiftLeft',
					bubbles: true,
					cancelable: true
				})
			);
		});
		await expect(sky).toHaveAttribute('data-dive', '0', { timeout: 2500 });
	}
}

async function holdButton(page: Page, name: string) {
	const btn = page.getByRole('button', { name });
	await expect(btn).toBeVisible();
	const box = await btn.boundingBox();
	expect(box).toBeTruthy();
	await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
	await page.mouse.down();
}

async function releaseMouse(page: Page) {
	await page.mouse.up();
}

const KEY_FLAG: Record<string, string> = {
	ArrowUp: 'data-up',
	ArrowDown: 'data-down',
	ArrowLeft: 'data-left',
	ArrowRight: 'data-right',
	Space: 'data-rise',
	Shift: 'data-dive'
};

async function pressSkyKey(page: Page, sky: Locator, key: string) {
	await page.keyboard.down(key);
	const attr = KEY_FLAG[key];
	if (!attr) return;
	try {
		await expect(sky).toHaveAttribute(attr, '1', { timeout: 400 });
	} catch {
		const code = key === 'Space' ? 'Space' : key === 'Shift' ? 'ShiftLeft' : key;
		const name = key === 'Space' ? ' ' : key === 'Shift' ? 'Shift' : key;
		await page.evaluate(
			({ code, name }) => {
				window.dispatchEvent(
					new KeyboardEvent('keydown', { key: name, code, bubbles: true, cancelable: true })
				);
			},
			{ code, name }
		);
		await expect(sky).toHaveAttribute(attr, '1', { timeout: 2500 });
	}
}

async function flyUntil(
	page: Page,
	sky: Locator,
	target: { x: number; z: number; y?: number },
	pred: (v: SkyVec) => boolean,
	timeout: number
) {
	const start = Date.now();
	let held: string[] = [];
	const release = async () => {
		for (const key of held) {
			await page.keyboard.up(key);
			const attr = KEY_FLAG[key];
			if (attr) {
				await page.evaluate(
					({ code, name }) => {
						window.dispatchEvent(
							new KeyboardEvent('keyup', { key: name, code, bubbles: true, cancelable: true })
						);
					},
					{
						code: key === 'Space' ? 'Space' : key === 'Shift' ? 'ShiftLeft' : key,
						name: key === 'Space' ? ' ' : key === 'Shift' ? 'Shift' : key
					}
				);
			}
		}
		held = [];
	};
	while (Date.now() - start < timeout) {
		await focusStage(page);
		const v = await readSky(sky);
		if (pred(v)) {
			await release();
			return v;
		}
		const next: string[] = [];
		if (target.y != null) {
			if (v.y < target.y - 0.5) next.push('Space');
			if (v.y > target.y + 0.8) next.push('Shift');
		}
		const dx = target.x - v.x;
		const dz = target.z - v.z;
		const lx = v.lookx;
		const lz = v.lookz;
		const fwd = dx * lx + dz * lz;
		const right = dx * -lz + dz * lx;
		if (fwd > 0.45) next.push('ArrowUp');
		else if (fwd < -0.45) next.push('ArrowDown');
		if (right > 0.45) next.push('ArrowRight');
		else if (right < -0.45) next.push('ArrowLeft');
		if (
			!next.includes('ArrowUp') &&
			!next.includes('ArrowDown') &&
			!next.includes('ArrowRight') &&
			!next.includes('ArrowLeft')
		) {
			next.push(
				Math.abs(fwd) >= Math.abs(right)
					? fwd >= 0
						? 'ArrowUp'
						: 'ArrowDown'
					: right >= 0
						? 'ArrowRight'
						: 'ArrowLeft'
			);
		}
		const uniq = [...new Set(next)];
		for (const key of held) {
			if (uniq.includes(key)) continue;
			await page.keyboard.up(key);
			const attr = KEY_FLAG[key];
			if (attr) {
				await page.evaluate(
					({ code, name }) => {
						window.dispatchEvent(
							new KeyboardEvent('keyup', { key: name, code, bubbles: true, cancelable: true })
						);
					},
					{
						code: key === 'Space' ? 'Space' : key === 'Shift' ? 'ShiftLeft' : key,
						name: key === 'Space' ? ' ' : key === 'Shift' ? 'Shift' : key
					}
				);
			}
		}
		for (const key of uniq) if (!held.includes(key)) await pressSkyKey(page, sky, key);
		held = uniq;
		await page.waitForTimeout(180);
	}
	const last = await readSky(sky);
	if (pred(last)) {
		await release();
		return last;
	}
	await release();
	throw new Error(`timeout flying toward ${JSON.stringify(target)}; last ${JSON.stringify(last)}`);
}

test.describe('云上散步', () => {
	test.describe.configure({ workers: 1 });

	test('Shift-alone dives and Space-alone climbs with keydown evidence', async ({ page }) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-dive', '0');
		const y0 = Number(await sky.getAttribute('data-y'));
		await holdShiftDive(page, sky);
		expect(await sky.getAttribute('data-dive')).toBe('1');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-y')), { timeout: 8_000 })
			.toBeLessThan(y0 - 0.6);
		await releaseShiftDive(page, sky);
		expect(await sky.getAttribute('data-dive')).toBe('0');
		const yHeld = Number(await sky.getAttribute('data-y'));
		await page.waitForTimeout(450);
		expect(Number(await sky.getAttribute('data-y'))).toBeCloseTo(yHeld, 0);
		await focusStage(page);
		await page.keyboard.down('Space');
		await expect(sky).toHaveAttribute('data-rise', '1', { timeout: 2500 });
		await expect
			.poll(async () => Number(await sky.getAttribute('data-y')), { timeout: 8_000 })
			.toBeGreaterThan(yHeld + 0.6);
		await page.keyboard.up('Space');
		await expect(sky).toHaveAttribute('data-rise', '0');
	});

	test('guest ghost climbs, dives, roams biomes, and hits the rim', async ({ page }) => {
		test.setTimeout(210_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/cloud-walk', { waitUntil: 'networkidle' });
		await expect(page.getByRole('heading', { name: '云上散步', level: 1 })).toBeVisible();
		await expect(page.getByText('Cloud Walk')).toBeVisible();
		await expect(page.getByRole('link', { name: '开始散步' })).toBeVisible();
		await page.getByRole('link', { name: '开始散步' }).click();
		await expect(page).toHaveURL(/\/modules\/games\/cloud-walk\/play/);
		await waitSky(page);
		await expect(page.getByRole('button', { name: '飞升' })).toBeVisible();
		await expect(page.getByRole('button', { name: '潜入' })).toBeVisible();
		await expect(page.getByRole('button', { name: '回家' })).toBeVisible();
		await expect(page.getByRole('button', { name: '跳一下' })).toHaveCount(0);
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-biome', 'garden');
		await shot(page, 'cloud-walk-play-1280-dark.png');

		await holdButton(page, '飞升');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-y')), { timeout: 8_000 })
			.toBeGreaterThan(6);
		await releaseMouse(page);
		await shot(page, 'cloud-walk-ghost-climb-1280.png');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(250);
		await shot(page, 'cloud-walk-ghost-climb-390.png');
		await page.setViewportSize({ width: 1280, height: 800 });

		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-y'))).toBeLessThan(2);
		await holdShiftDive(page, sky);
		await expect
			.poll(
				async () => {
					const v = await readSky(sky);
					return v.biome === 'water' && v.y < -1.6 && v.y > -5.2;
				},
				{ timeout: 10_000 }
			)
			.toBe(true);
		await releaseShiftDive(page, sky);
		await expect(sky).toHaveAttribute('data-biome', 'water');
		await shot(page, 'cloud-walk-water-1280.png');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(180);
		await shot(page, 'cloud-walk-water-390.png');
		await page.setViewportSize({ width: 1280, height: 800 });
		await holdShiftDive(page, sky);
		await expect
			.poll(
				async () => {
					const v = await readSky(sky);
					return v.biome === 'underworld' && v.y < -7 && v.y > -12;
				},
				{ timeout: 12_000 }
			)
			.toBe(true);
		await releaseShiftDive(page, sky);
		await expect(sky).toHaveAttribute('data-biome', 'underworld');
		await shot(page, 'cloud-walk-grotto-1280.png');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(180);
		await shot(page, 'cloud-walk-grotto-390.png');
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.getByRole('button', { name: '低细腻' }).click();
		await expect(sky).toHaveAttribute('data-detail', 'low');
		await page.waitForTimeout(220);
		await shot(page, 'cloud-walk-grotto-lowdetail-1280.png');
		await page.getByRole('button', { name: '高细腻' }).click();
		await shot(page, 'cloud-walk-dive-1280.png');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(180);
		await shot(page, 'cloud-walk-dive-390.png');
		await page.setViewportSize({ width: 1280, height: 800 });

		await page.getByRole('button', { name: '回家' }).click();
		await flyUntil(page, sky, { x: 16, z: 2, y: 3 }, (v) => v.biome === 'alien', 28_000);
		await shot(page, 'cloud-walk-alien-1280.png');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(250);
		await shot(page, 'cloud-walk-alien-390.png');
		await page.setViewportSize({ width: 1280, height: 800 });

		await page.getByRole('button', { name: '回家' }).click();
		await flyUntil(page, sky, { x: 2, z: -16, y: 8 }, (v) => v.biome === 'city', 32_000);
		await shot(page, 'cloud-walk-city-1280.png');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(250);
		await shot(page, 'cloud-walk-city-390.png');
		await page.setViewportSize({ width: 1280, height: 800 });

		await focusStage(page);
		await flyUntil(
			page,
			sky,
			{ x: 2, z: -40, y: 8 },
			(v) => v.bound || Math.hypot(v.x, v.z) >= 37.5,
			40_000
		);
		await expect(sky).toHaveAttribute('data-bound', '1');
		await shot(page, 'cloud-walk-bound-1280.png');

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepCloud', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		await waitSky(page);
		await expect(sky).toHaveAttribute('data-ready', '1');

		await page.getByRole('button', { name: '暂停' }).click();
		await expect(sky).toHaveAttribute('data-anim', '0');
		const yPaused = await sky.getAttribute('data-y');
		await page.waitForTimeout(400);
		expect(await sky.getAttribute('data-y')).toBe(yPaused);
		await page.getByRole('button', { name: '继续' }).click();
		await page.getByRole('button', { name: '低细腻' }).click();
		await expect(sky).toHaveAttribute('data-detail', 'low');
		await page.getByRole('button', { name: '风声' }).click();
		await expect(sky).toHaveAttribute('data-audio', '1');
		await page.getByRole('button', { name: '静音' }).click();
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole('button', { name: '飞升' })).toBeVisible();
		await expect(page.getByRole('button', { name: '潜入' })).toBeVisible();
		await expect(page.getByRole('button', { name: '跳一下' })).toHaveCount(0);
		const y0 = Number(await sky.getAttribute('data-y'));
		const rise = page.getByRole('button', { name: '飞升' });
		const box = await rise.boundingBox();
		expect(box).toBeTruthy();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		await rise.hover();
		await page.mouse.down();
		await expect
			.poll(async () => Number(await sky.getAttribute('data-y')), { timeout: 6_000 })
			.toBeGreaterThan(y0 + 0.8);
		await page.mouse.up();
		const y1 = Number(await sky.getAttribute('data-y'));
		const diveBtn = page.getByRole('button', { name: '潜入' });
		await diveBtn.hover();
		await page.mouse.down();
		await expect
			.poll(async () => Number(await sky.getAttribute('data-y')), { timeout: 6_000 })
			.toBeLessThan(y1 - 0.8);
		await page.mouse.up();
		await shot(page, 'cloud-walk-play-390-dark.png');
	});

	test('schema 1 save migrates fragments and garden without wiping other keys', async ({
		page
	}) => {
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
			localStorage.setItem('qingxin.theme', 'dark');
			localStorage.setItem('qingxin.games.tide-breath', '{"schema":1}');
			localStorage.setItem(
				'qingxin.games.cloud-walk',
				JSON.stringify({
					schema: 1,
					x: 0,
					y: 1,
					z: 0,
					yaw: 1.18,
					island: 0,
					visited: [0, 1],
					skyMode: 'sun',
					fragments: [
						{ id: 1, kind: 'sun', collected: true },
						{ id: 2, kind: 'rain', collected: true },
						{ id: 3, kind: 'breeze', collected: false },
						{ id: 4, kind: 'night', collected: false }
					],
					garden: [
						{ kind: 'sun', x: -1.45, z: -1.65, grown: 0.8 },
						{ kind: 'rain', x: 0.25, z: -2.05, grown: 0.4 }
					]
				})
			);
		});
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-frags', '2');
		await expect(sky).toHaveAttribute('data-garden', '2');
		await expect(sky).toHaveAttribute('data-sky', 'sun');
		const theme = await page.evaluate(() => localStorage.getItem('qingxin.theme'));
		const tide = await page.evaluate(() => localStorage.getItem('qingxin.games.tide-breath'));
		expect(theme).toBe('dark');
		expect(tide).toBe('{"schema":1}');
		const saved = await page.evaluate(() => localStorage.getItem('qingxin.games.cloud-walk'));
		expect(saved).toContain('"schema":3');
	});

	test('reduced motion still paints a sky and other games still boot', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		await shot(page, 'cloud-walk-reduced-1280-light.png');
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await holdShiftDive(page, sky);
		await expect
			.poll(
				async () => {
					const v = await readSky(sky);
					return v.biome === 'water' && v.y < -1.6 && v.y > -5.2;
				},
				{ timeout: 10_000 }
			)
			.toBe(true);
		await releaseShiftDive(page, sky);
		await shot(page, 'cloud-walk-water-reduced-1280-light.png');
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/shangban/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-shangban="1"]')).toBeVisible();
		await page.goto('/modules/games/cargo-haul/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[aria-label="重卡公路"]')).toBeVisible();
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/operation/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-play="operation"]')).toBeVisible();
	});

	test('yaw 0 holds W straight on +Z without idle mesh trap', async ({ page }) => {
		test.setTimeout(45_000);
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
			localStorage.setItem('qingxin.theme', 'dark');
			localStorage.setItem(
				'qingxin.games.cloud-walk',
				JSON.stringify({
					schema: 3,
					x: 0,
					y: 1,
					z: 0,
					yaw: 0,
					island: 0,
					biome: 'garden',
					visited: [0],
					biomes: ['garden'],
					skyMode: 'dawn',
					fragments: [
						{ id: 1, kind: 'sun', collected: false },
						{ id: 2, kind: 'rain', collected: false },
						{ id: 3, kind: 'breeze', collected: false },
						{ id: 4, kind: 'night', collected: false }
					],
					garden: []
				})
			);
		});
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-yaw', '0');
		const idleY = Number(await sky.getAttribute('data-y'));
		expect(idleY).toBeGreaterThan(0.6);
		await page.waitForTimeout(700);
		expect(Number(await sky.getAttribute('data-y'))).toBeCloseTo(idleY, 0);
		expect(Number(await sky.getAttribute('data-y'))).not.toBeCloseTo(0.1, 1);
		const z0 = Number(await sky.getAttribute('data-z'));
		const x0 = Number(await sky.getAttribute('data-x'));
		await focusStage(page);
		await page.keyboard.down('w');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-z')), { timeout: 6_000 })
			.toBeGreaterThan(z0 + 2);
		const x1 = Number(await sky.getAttribute('data-x'));
		expect(Math.abs(x1 - x0)).toBeLessThan(1);
		expect(Number(await sky.getAttribute('data-lookx'))).toBeCloseTo(0, 1);
		expect(Number(await sky.getAttribute('data-lookz'))).toBeGreaterThan(0.8);
		await page.keyboard.up('w');
	});

	test('left click flies, F destroys scenery, rebuild and pools stay bounded', async ({ page }) => {
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(page.getByRole('button', { name: '发射' })).toBeVisible();
		await expect(page.getByRole('button', { name: '重建云界' })).toBeVisible();
		await expect(sky).toHaveAttribute('data-hidden', '0');
		await expect(sky).toHaveAttribute('data-bullets', '0');
		await shot(page, 'cloud-cannon-before-impact-1280.png');

		const box = await sky.boundingBox();
		expect(box).toBeTruthy();
		const x0 = Number(await sky.getAttribute('data-x'));
		const z0 = Number(await sky.getAttribute('data-z'));
		await page.mouse.move(box!.x + box!.width * 0.62, box!.y + box!.height * 0.42);
		await page.mouse.down();
		await expect(sky).toHaveAttribute('data-steer', '1', { timeout: 2500 });
		await expect(sky).toHaveAttribute('data-fire', '0');
		await expect
			.poll(
				async () => {
					const v = await readSky(sky);
					return Math.hypot(v.x - x0, v.z - z0) > 0.6;
				},
				{ timeout: 6_000 }
			)
			.toBe(true);
		await expect(sky).toHaveAttribute('data-bullets', '0');
		await page.mouse.up();
		await expect(sky).toHaveAttribute('data-steer', '0', { timeout: 2500 });
		await expect(sky).toHaveAttribute('data-bullets', '0');

		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-y'))).toBeLessThan(2);
		await focusStage(page);
		await page.keyboard.down('f');
		await expect(sky).toHaveAttribute('data-fire', '1', { timeout: 2500 });
		await expect
			.poll(async () => Number(await sky.getAttribute('data-bullets')), { timeout: 4_000 })
			.toBeGreaterThan(0);
		await expect
			.poll(async () => Number(await sky.getAttribute('data-hidden')), { timeout: 8_000 })
			.toBeGreaterThan(0);
		await expect
			.poll(async () => Number(await sky.getAttribute('data-shards')), { timeout: 3_000 })
			.toBeGreaterThan(0);
		const hiddenIds = (await sky.getAttribute('data-hiddenids')) ?? '';
		expect(hiddenIds).not.toMatch(/\bwell\b/);
		expect(hiddenIds).not.toMatch(/cavern/);
		await shot(page, 'cloud-cannon-after-impact-1280.png');
		await page.keyboard.up('f');
		await expect(sky).toHaveAttribute('data-fire', '0');

		const pose = await readSky(sky);
		await page.getByRole('button', { name: '重建云界' }).click();
		await expect(sky).toHaveAttribute('data-hidden', '0');
		await expect(sky).toHaveAttribute('data-bullets', '0');
		await expect(sky).toHaveAttribute('data-shards', '0');
		const restored = await readSky(sky);
		expect(restored.x).toBeCloseTo(pose.x, 0);
		expect(restored.y).toBeCloseTo(pose.y, 0);
		expect(restored.z).toBeCloseTo(pose.z, 0);

		await page.keyboard.down('f');
		await page.waitForTimeout(2200);
		expect(Number(await sky.getAttribute('data-bullets'))).toBeLessThanOrEqual(12);
		expect(Number(await sky.getAttribute('data-shards'))).toBeLessThanOrEqual(48);
		await page.keyboard.up('f');

		await page.getByRole('button', { name: '暂停' }).click();
		await expect(sky).toHaveAttribute('data-anim', '0');
		const yPaused = await sky.getAttribute('data-y');
		await page.waitForTimeout(400);
		expect(await sky.getAttribute('data-y')).toBe(yPaused);
		await page.getByRole('button', { name: '继续' }).click();

		await page.evaluate(() => sessionStorage.setItem('qingxin.keepCloud', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		await waitSky(page);
		await expect(sky).toHaveAttribute('data-ready', '1');
		await expect(sky).toHaveAttribute('data-hidden', '0');
		const gpu = Number(await sky.getAttribute('data-gpu'));
		expect(Number.isFinite(gpu)).toBe(true);
		console.log(`cloud renderer.render ms (CPU timestamp around GL): ${gpu}`);

		await focusStage(page);
		await page.keyboard.down('Space');
		await expect(sky).toHaveAttribute('data-rise', '1', { timeout: 2500 });
		await page.evaluate(() => window.dispatchEvent(new Event('blur')));
		await expect(sky).toHaveAttribute('data-rise', '0', { timeout: 2500 });
		await expect(sky).toHaveAttribute('data-fire', '0');
		await expect(sky).toHaveAttribute('data-steer', '0');
	});

	test('390 fire control is 44px, tap-drag does not shoot, rise+fire together', async ({
		page
	}) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 390, height: 844 });
		await boot(page, 'dark');
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		const fire = page.getByRole('button', { name: '发射' });
		await expect(fire).toBeVisible();
		const fireBox = await fire.boundingBox();
		expect(fireBox).toBeTruthy();
		expect(fireBox!.height).toBeGreaterThanOrEqual(44);
		expect(fireBox!.width).toBeGreaterThanOrEqual(44);
		await shot(page, 'cloud-cannon-fire-390.png');

		const canvasBox = await sky.boundingBox();
		expect(canvasBox).toBeTruthy();
		const x0 = Number(await sky.getAttribute('data-x'));
		const z0 = Number(await sky.getAttribute('data-z'));
		await page.mouse.move(
			canvasBox!.x + canvasBox!.width * 0.55,
			canvasBox!.y + canvasBox!.height * 0.4
		);
		await page.mouse.down();
		await expect(sky).toHaveAttribute('data-steer', '1', { timeout: 2500 });
		await expect(sky).toHaveAttribute('data-fire', '0');
		await expect
			.poll(
				async () => {
					const v = await readSky(sky);
					return Math.hypot(v.x - x0, v.z - z0) > 0.4;
				},
				{ timeout: 6_000 }
			)
			.toBe(true);
		await expect(sky).toHaveAttribute('data-bullets', '0');
		await page.mouse.up();
		await expect(sky).toHaveAttribute('data-steer', '0');

		const y0 = Number(await sky.getAttribute('data-y'));
		const rise = page.getByRole('button', { name: '飞升' });
		await rise.dispatchEvent('pointerdown');
		await fire.dispatchEvent('pointerdown');
		await expect(sky).toHaveAttribute('data-rise', '1', { timeout: 2500 });
		await expect(sky).toHaveAttribute('data-fire', '1', { timeout: 2500 });
		await expect
			.poll(async () => Number(await sky.getAttribute('data-y')), { timeout: 6_000 })
			.toBeGreaterThan(y0 + 0.6);
		await expect
			.poll(async () => Number(await sky.getAttribute('data-bullets')), { timeout: 4_000 })
			.toBeGreaterThan(0);
		await shot(page, 'cloud-cannon-fire-active-390.png');
		await rise.dispatchEvent('pointerup');
		await fire.dispatchEvent('pointerup');
		await expect(sky).toHaveAttribute('data-fire', '0');
	});

	test('A/D and arrows strafe screen-right; 390 tap flies toward the visible point', async ({
		page
	}) => {
		test.setTimeout(90_000);
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
			localStorage.setItem('qingxin.theme', 'dark');
			localStorage.setItem(
				'qingxin.games.cloud-walk',
				JSON.stringify({
					schema: 3,
					x: 0,
					y: 1,
					z: 0,
					yaw: 0,
					island: 0,
					biome: 'garden',
					visited: [0],
					biomes: ['garden'],
					skyMode: 'dawn',
					fragments: [
						{ id: 1, kind: 'sun', collected: false },
						{ id: 2, kind: 'rain', collected: false },
						{ id: 3, kind: 'breeze', collected: false },
						{ id: 4, kind: 'night', collected: false }
					],
					garden: []
				})
			);
		});
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		const sky = page.locator('canvas[aria-label="云上散步天空"]');
		await expect(sky).toHaveAttribute('data-yaw', '0');
		await shot(page, 'cloud-strafe-idle-1280.png');

		const xIdle = Number(await sky.getAttribute('data-x'));
		const zIdle = Number(await sky.getAttribute('data-z'));
		await focusStage(page);
		await pressSkyKey(page, sky, 'ArrowRight');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-x')), { timeout: 6_000 })
			.toBeLessThan(xIdle - 1.5);
		expect(Number(await sky.getAttribute('data-yaw'))).toBeCloseTo(0, 1);
		expect(Math.abs(Number(await sky.getAttribute('data-z')) - zIdle)).toBeLessThan(1);
		const xRight = Number(await sky.getAttribute('data-x'));
		console.log(
			`cloud ArrowRight yaw0 dx=${(xRight - xIdle).toFixed(2)} (screen-right is world -X)`
		);
		await shot(page, 'cloud-strafe-right-1280.png');
		await page.keyboard.up('ArrowRight');

		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-x'))).toBeCloseTo(0, 0);
		await focusStage(page);
		await page.keyboard.down('d');
		try {
			await expect(sky).toHaveAttribute('data-right', '1', { timeout: 400 });
		} catch {
			await page.evaluate(() => {
				window.dispatchEvent(
					new KeyboardEvent('keydown', {
						key: 'd',
						code: 'KeyD',
						bubbles: true,
						cancelable: true
					})
				);
			});
			await expect(sky).toHaveAttribute('data-right', '1', { timeout: 2500 });
		}
		await expect
			.poll(async () => Number(await sky.getAttribute('data-x')), { timeout: 6_000 })
			.toBeLessThan(-1.5);
		await page.keyboard.up('d');
		await page.evaluate(() => {
			window.dispatchEvent(
				new KeyboardEvent('keyup', { key: 'd', code: 'KeyD', bubbles: true, cancelable: true })
			);
		});

		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-x'))).toBeCloseTo(0, 0);
		await focusStage(page);
		await pressSkyKey(page, sky, 'ArrowLeft');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-x')), { timeout: 6_000 })
			.toBeGreaterThan(1.5);
		await shot(page, 'cloud-strafe-left-1280.png');
		await page.keyboard.up('ArrowLeft');

		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-z'))).toBeCloseTo(0, 0);
		await focusStage(page);
		await page.keyboard.down('w');
		await pressSkyKey(page, sky, 'ArrowRight');
		await expect
			.poll(
				async () => {
					const x = Number(await sky.getAttribute('data-x'));
					const z = Number(await sky.getAttribute('data-z'));
					return z > 1.2 && x < -0.8;
				},
				{ timeout: 6_000 }
			)
			.toBe(true);
		await page.keyboard.up('w');
		await page.keyboard.up('ArrowRight');

		await page.getByRole('button', { name: '回家' }).click();
		await focusStage(page);
		await pressSkyKey(page, sky, 'ArrowRight');
		await expect(sky).toHaveAttribute('data-right', '1');
		await page.evaluate(() => window.dispatchEvent(new Event('blur')));
		await expect(sky).toHaveAttribute('data-right', '0', { timeout: 2500 });
		await expect(sky).toHaveAttribute('data-steer', '0');
		const stopped = await readSky(sky);
		await page.waitForTimeout(400);
		const still = await readSky(sky);
		expect(still.x).toBeCloseTo(stopped.x, 0);
		expect(still.z).toBeCloseTo(stopped.z, 0);

		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-yaw'))).toBeCloseTo(0, 1);
		await focusStage(page);
		await pressSkyKey(page, sky, 'ArrowRight');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-x')), { timeout: 6_000 })
			.toBeLessThan(-1.2);
		await shot(page, 'cloud-strafe-right-390.png');
		await page.keyboard.up('ArrowRight');
		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-yaw'))).toBeCloseTo(0, 1);
		const leftBox = await sky.boundingBox();
		expect(leftBox).toBeTruthy();
		const left0 = await readSky(sky);
		await page.mouse.move(leftBox!.x + leftBox!.width * 0.16, leftBox!.y + leftBox!.height * 0.28);
		await page.mouse.down();
		await expect(sky).toHaveAttribute('data-steer', '1', { timeout: 2500 });
		await expect
			.poll(
				async () => {
					const v = await readSky(sky);
					return alongScreenRight(left0, v) < -0.8 && v.y > 0.4;
				},
				{ timeout: 8_000 }
			)
			.toBe(true);
		console.log(
			`cloud 390 tap-left alongScreenRight=${alongScreenRight(left0, await readSky(sky)).toFixed(2)}`
		);
		await shot(page, 'cloud-tap-left-390.png');
		await page.mouse.up();
		await expect(sky).toHaveAttribute('data-steer', '0', { timeout: 2500 });

		await page.getByRole('button', { name: '回家' }).click();
		await expect.poll(async () => Number(await sky.getAttribute('data-x'))).toBeCloseTo(0, 0);
		const rightBox = await sky.boundingBox();
		expect(rightBox).toBeTruthy();
		const right0 = await readSky(sky);
		await page.mouse.move(rightBox!.x + rightBox!.width * 0.84, rightBox!.y + rightBox!.height * 0.28);
		await page.mouse.down();
		await expect(sky).toHaveAttribute('data-steer', '1', { timeout: 2500 });
		await expect
			.poll(
				async () => {
					const v = await readSky(sky);
					return alongScreenRight(right0, v) > 0.8 && v.y > 0.4;
				},
				{ timeout: 8_000 }
			)
			.toBe(true);
		console.log(
			`cloud 390 tap-right alongScreenRight=${alongScreenRight(right0, await readSky(sky)).toFixed(2)}`
		);
		await shot(page, 'cloud-tap-right-390.png');
		await page.mouse.up();
	});
});
