import { describe, expect, it } from 'vitest';
import { SORRY_BUBBLE, SORRY_BUBBLE_NARROW, placeSorryBubbles } from './bubbles';

function inside(
	box: { x: number; y: number },
	canvas: { width: number; height: number },
	bubble: { width: number; height: number },
	pad = 10
) {
	expect(box.x).toBeGreaterThanOrEqual(pad);
	expect(box.y).toBeGreaterThanOrEqual(pad);
	expect(box.x + bubble.width).toBeLessThanOrEqual(canvas.width - pad + 0.5);
	expect(box.y + bubble.height).toBeLessThanOrEqual(canvas.height - pad + 0.5);
}

describe('sorry bubble placement', () => {
	it('keeps a top-of-case ghost apology fully inside a 1280 canvas', () => {
		const canvas = { width: 1280, height: 620 };
		const [box] = placeSorryBubbles([{ id: 'b0', x: 640, y: 18 }], canvas, SORRY_BUBBLE);
		expect(box).toBeTruthy();
		inside(box!, canvas, SORRY_BUBBLE);
		expect(box!.y).toBeGreaterThanOrEqual(10);
	});

	it('keeps a top-left 390 ghost apology fully inside the canvas', () => {
		const canvas = { width: 390, height: 558 };
		const [box] = placeSorryBubbles([{ id: 'b1', x: 48, y: 22 }], canvas, SORRY_BUBBLE_NARROW);
		expect(box).toBeTruthy();
		inside(box!, canvas, SORRY_BUBBLE_NARROW);
		expect(box!.x).toBeGreaterThanOrEqual(10);
	});

	it('spreads two nearby apologies so they do not share one box', () => {
		const canvas = { width: 1280, height: 620 };
		const [a, b] = placeSorryBubbles(
			[
				{ id: 'b0', x: 500, y: 80 },
				{ id: 'b1', x: 520, y: 84 }
			],
			canvas,
			SORRY_BUBBLE
		);
		expect(a).toBeTruthy();
		expect(b).toBeTruthy();
		inside(a!, canvas, SORRY_BUBBLE);
		inside(b!, canvas, SORRY_BUBBLE);
		expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(40);
	});
});
