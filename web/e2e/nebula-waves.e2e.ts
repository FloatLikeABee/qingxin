import { expect, test, type Page } from '@playwright/test';

test.use({
	video: { mode: 'on', size: { width: 1280, height: 800 } }
});

async function boot(page: Page, theme: 'light' | 'dark' = 'dark') {
	await page.addInitScript((nextTheme) => {
		localStorage.setItem('qingxin.privacyConsent', 'accepted');
		localStorage.setItem('qingxin.theme', nextTheme);
	}, theme);
}

async function contrastRatio(page: Page) {
	const card = page.locator('[data-board-tile="jimutai"] .qx-glass').first();
	await expect(card).toBeVisible();
	return card.evaluate((el) => {
		const parse = (value: string): number[] | null => {
			const rgb = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
			if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
			const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
			if (srgb) {
				return [Number(srgb[1]), Number(srgb[2]), Number(srgb[3])].map((n) =>
					Math.round(n <= 1 ? n * 255 : n)
				);
			}
			const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
			if (hex) {
				const n = hex[1]!;
				return [
					parseInt(n.slice(0, 2), 16),
					parseInt(n.slice(2, 4), 16),
					parseInt(n.slice(4, 6), 16)
				];
			}
			return null;
		};
		const fromFill = (value: string) => {
			const canvas = document.createElement('canvas');
			canvas.width = 1;
			canvas.height = 1;
			const ctx = canvas.getContext('2d');
			if (!ctx) return null;
			ctx.fillStyle = value;
			ctx.fillRect(0, 0, 1, 1);
			const d = ctx.getImageData(0, 0, 1, 1).data;
			if (d[3]! < 8) return null;
			return [d[0]!, d[1]!, d[2]!];
		};
		const lum = (rgb: number[]) => {
			const parts = rgb.map((channel) => {
				const next = channel / 255;
				return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!;
		};
		const cs = getComputedStyle(el);
		const root = getComputedStyle(document.documentElement);
		const fg =
			parse(cs.color) ?? fromFill(cs.color) ?? parse(root.getPropertyValue('--qx-text').trim());
		const bg =
			parse(cs.backgroundColor) ??
			fromFill(cs.backgroundColor) ??
			parse(root.getPropertyValue('--qx-card').trim());
		if (!fg || !bg) return 0;
		const light = Math.max(lum(fg), lum(bg));
		const dark = Math.min(lum(fg), lum(bg));
		return (light + 0.05) / (dark + 0.05);
	});
}

async function sampleDust(page: Page) {
	return page.locator('[data-qx-dust]').evaluate((el) => {
		const canvas = el as HTMLCanvasElement;
		const ctx = canvas.getContext('2d');
		if (!ctx) return { lit: 0, cells: [] as number[] };
		const cols = 16;
		const rows = 10;
		const cells: number[] = [];
		let lit = 0;
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const x = Math.min(
					canvas.width - 1,
					Math.max(0, Math.floor(((col + 0.5) / cols) * canvas.width))
				);
				const y = Math.min(
					canvas.height - 1,
					Math.max(0, Math.floor(((row + 0.5) / rows) * canvas.height))
				);
				const d = ctx.getImageData(x, y, 1, 1).data;
				const value = d[0] + d[1] + d[2] + d[3];
				cells.push(value);
				if (d[3]! > 8) lit += 1;
			}
		}
		return { lit, cells };
	});
}

async function nebulaTranslate(page: Page) {
	return page.locator('.qx-nebula-a').evaluate((el) => getComputedStyle(el).translate);
}

test.describe('nebula waves shell', () => {
	test('dark hub animates waves without flashing and keeps glass readable', async ({ page }) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules', { waitUntil: 'networkidle' });
		const dust = page.locator('[data-qx-dust]');
		await expect(page.locator('[data-qx-nebula]')).toBeVisible();
		await expect(dust).toBeVisible();
		await expect(dust).toHaveAttribute('data-anim', '1');
		await expect(dust).toHaveAttribute('data-waves', /[2-9]/);
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(bg.replace(/\s/g, '')).toMatch(/rgb\(7,\s*11,\s*20\)|#070b14/i);
		expect(await contrastRatio(page)).toBeGreaterThanOrEqual(4.5);
		await expect
			.poll(async () => page.locator('[data-qx-dust]').getAttribute('data-cadence'), {
				timeout: 2500
			})
			.not.toBeNull();
		const cadence = Number(await dust.getAttribute('data-cadence'));
		expect(cadence).toBeGreaterThanOrEqual(30);
		expect(cadence).toBeLessThanOrEqual(90);
		await page.screenshot({ path: 'screenshots/nebula-waves-hub-1280-dark.png' });
		const before = await sampleDust(page);
		const t1 = await nebulaTranslate(page);
		await page.waitForTimeout(1200);
		const after = await sampleDust(page);
		const t2 = await nebulaTranslate(page);
		await page.screenshot({ path: 'screenshots/nebula-waves-hub-1280-dark-t2.png' });
		expect(before.lit).toBeGreaterThan(4);
		expect(after.cells.length).toBe(before.cells.length);
		let moved = 0;
		let totalDelta = 0;
		for (let i = 0; i < before.cells.length; i++) {
			const delta = Math.abs(before.cells[i]! - after.cells[i]!);
			if (delta > 2) moved += 1;
			totalDelta += delta;
		}
		const avgDelta = totalDelta / Math.max(1, before.cells.length);
		expect(
			moved > 0 || t1 !== t2,
			'canvas grid or CSS wave translate should change over 1.2s'
		).toBeTruthy();
		expect(avgDelta, 'no full-frame blink').toBeLessThan(80);
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(dust).toBeVisible();
		await page.screenshot({ path: 'screenshots/nebula-waves-hub-390-dark.png' });
	});

	test('reduced motion paints a still nebula, not a flat fill', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/modules', { waitUntil: 'networkidle' });
		const dust = page.locator('[data-qx-dust]');
		await expect(dust).toHaveAttribute('data-anim', '0');
		await page.waitForTimeout(400);
		await expect(dust).toHaveAttribute('data-anim', '0');
		const lit = await dust.evaluate((el) => {
			const canvas = el as HTMLCanvasElement;
			const ctx = canvas.getContext('2d');
			if (!ctx) return 0;
			const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
			let count = 0;
			for (let i = 3; i < data.length; i += 32) {
				if (data[i]! > 10) count += 1;
			}
			return count;
		});
		expect(lit).toBeGreaterThan(80);
		await page.screenshot({ path: 'screenshots/nebula-waves-reduced-1280.png' });
	});

	test('pauses when hidden and skips immersive play routes', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'dark');
		await page.goto('/modules', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toHaveAttribute('data-anim', '1');
		await page.evaluate(() => {
			let hidden = true;
			Object.defineProperty(document, 'hidden', {
				configurable: true,
				get: () => hidden
			});
			(window as Window & { __qxSetHidden?: (next: boolean) => void }).__qxSetHidden = (next) => {
				hidden = next;
				document.dispatchEvent(new Event('visibilitychange'));
			};
			document.dispatchEvent(new Event('visibilitychange'));
		});
		await expect(page.locator('[data-qx-dust]')).toHaveAttribute('data-anim', '0');
		await page.evaluate(() => {
			(window as Window & { __qxSetHidden?: (next: boolean) => void }).__qxSetHidden?.(false);
		});
		await expect(page.locator('[data-qx-dust]')).toHaveAttribute('data-anim', '1', {
			timeout: 4000
		});
		await page.goto('/modules/shangban', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
		await page.goto('/modules/jimutai', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await page.goto('/modules/games/window-garden/play', { waitUntil: 'networkidle' });
		await expect(page.locator('[data-qx-dust]')).toHaveCount(0);
		await expect(page.locator('[data-qx-nebula]')).toHaveCount(0);
	});

	test('light theme stays dawn, quieter, and does not overwrite the saved mode', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await boot(page, 'light');
		await page.goto('/modules', { waitUntil: 'networkidle' });
		expect(await page.evaluate(() => localStorage.getItem('qingxin.theme'))).toBe('light');
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(bg.replace(/\s/g, '')).toMatch(/rgb\(234,\s*243,\s*255\)|#eaf3ff/i);
		await expect(page.locator('[data-qx-dust]')).toBeVisible();
		expect(await contrastRatio(page)).toBeGreaterThanOrEqual(4.5);
		await page.screenshot({ path: 'screenshots/nebula-waves-hub-1280-light.png' });
		await page.setViewportSize({ width: 390, height: 844 });
		await page.screenshot({ path: 'screenshots/nebula-waves-hub-390-light.png' });
		await page.goto('/');
		expect(await page.evaluate(() => localStorage.getItem('qingxin.theme'))).toBe('light');
	});

	test('guest load still does not write a theme', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.addInitScript(() => {
			localStorage.setItem('qingxin.privacyConsent', 'accepted');
		});
		await page.goto('/', { waitUntil: 'networkidle' });
		expect(await page.evaluate(() => localStorage.getItem('qingxin.theme'))).toBeNull();
		await expect(page.locator('[data-qx-nebula]')).toBeVisible();
		await expect(page.locator('[data-qx-topbar]')).toBeVisible();
		await expect(page.locator('aside')).toHaveCount(0);
	});
});
