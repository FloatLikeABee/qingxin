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
};

async function readSky(sky: Locator): Promise<SkyVec> {
	return sky.evaluate((el) => ({
		x: Number(el.getAttribute('data-x')),
		y: Number(el.getAttribute('data-y')),
		z: Number(el.getAttribute('data-z')),
		r: Number(el.getAttribute('data-r')),
		biome: el.getAttribute('data-biome'),
		lookx: Number(el.getAttribute('data-lookx')),
		lookz: Number(el.getAttribute('data-lookz'))
	}));
}

async function shot(page: Page, name: string) {
	await page.screenshot({ path: `screenshots/${name}` });
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

async function flyUntil(
	page: Page,
	sky: Locator,
	target: { x: number; z: number; y?: number },
	pred: (v: SkyVec) => boolean,
	timeout: number
) {
	const start = Date.now();
	let held: string[] = [];
	let stickKey = '';
	let stickUntil = 0;
	const release = async () => {
		for (const key of held) await page.keyboard.up(key);
		held = [];
	};
	while (Date.now() - start < timeout) {
		const v = await readSky(sky);
		if (pred(v)) {
			await release();
			return v;
		}
		const next: string[] = [];
		if (target.y != null) {
			if (v.y < target.y - 0.5) next.push('Space');
		}
		const dx = target.x - v.x;
		const dz = target.z - v.z;
		const lx = v.lookx;
		const lz = v.lookz;
		const fwd = dx * lx + dz * lz;
		const right = dx * lz + dz * -lx;
		const preferred =
			Math.abs(fwd) >= Math.abs(right)
				? fwd >= 0
					? 'ArrowUp'
					: 'ArrowDown'
				: right >= 0
					? 'ArrowRight'
					: 'ArrowLeft';
		const now = Date.now();
		if (!stickKey || now >= stickUntil || stickKey === preferred) {
			stickKey = preferred;
			stickUntil = now + 1400;
		}
		next.push(stickKey);
		const uniq = [...new Set(next)];
		for (const key of held) if (!uniq.includes(key)) await page.keyboard.up(key);
		for (const key of uniq) if (!held.includes(key)) await page.keyboard.down(key);
		held = uniq;
		await page.waitForTimeout(180);
	}
	const last = await readSky(sky);
	await release();
	throw new Error(`timeout flying toward ${JSON.stringify(target)}; last ${JSON.stringify(last)}`);
}

test.describe('云上散步', () => {
	test('guest ghost climbs, dives, roams biomes, and hits the rim', async ({ page }) => {
		test.setTimeout(180_000);
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
		await holdButton(page, '潜入');
		await expect
			.poll(async () => Number(await sky.getAttribute('data-y')), { timeout: 12_000 })
			.toBeLessThan(-6);
		await expect(sky).toHaveAttribute('data-biome', 'underworld');
		await expect(sky).toHaveAttribute('data-dive', '1');
		await releaseMouse(page);
		await shot(page, 'cloud-walk-dive-1280.png');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(250);
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

		await flyUntil(page, sky, { x: 2, z: -40, y: 8 }, (v) => v.r >= 38, 28_000);
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
		expect(saved).toContain('"schema":2');
	});

	test('reduced motion still paints a sky and other games still boot', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules/games/cloud-walk/play', { waitUntil: 'networkidle' });
		await waitSky(page);
		await shot(page, 'cloud-walk-reduced-1280-light.png');
		await page.goto('/modules/games/tide-breath/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/convenient-store/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/memory-shelf/play', { waitUntil: 'networkidle' });
		await expect(page.locator('canvas[data-ready="1"]')).toBeVisible({ timeout: 20_000 });
		await page.goto('/modules/games/shangban/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-shangban="1"]')).toBeVisible();
	});
});
