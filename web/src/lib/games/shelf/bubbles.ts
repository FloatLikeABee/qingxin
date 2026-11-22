export type GhostAnchor = { id: string; x: number; y: number };

export const SORRY_BUBBLE = { width: 168, height: 64 };
export const SORRY_BUBBLE_NARROW = { width: 148, height: 56 };

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

function overlaps(
	a: { x: number; y: number },
	b: { x: number; y: number },
	bubble: { width: number; height: number }
) {
	return (
		Math.abs(a.x + bubble.width / 2 - (b.x + bubble.width / 2)) < bubble.width * 0.9 &&
		Math.abs(a.y + bubble.height / 2 - (b.y + bubble.height / 2)) < bubble.height * 0.9
	);
}

/** Top-left pixel box for a 对不起 bubble, fully inside the canvas. Never hangs above the stage. */
export function placeSorryBubbles(
	ghosts: GhostAnchor[],
	canvas: { width: number; height: number },
	bubble: { width: number; height: number } = SORRY_BUBBLE,
	pad = 10
): Array<{ id: string; x: number; y: number }> {
	const maxX = Math.max(pad, canvas.width - pad - bubble.width);
	const maxY = Math.max(pad, canvas.height - pad - bubble.height);
	const placed: Array<{ id: string; x: number; y: number }> = [];
	for (const ghost of ghosts) {
		let x = ghost.x + 20;
		let y = ghost.y - bubble.height * 0.25;
		if (x > maxX) x = ghost.x - bubble.width - 12;
		x = clamp(x, pad, maxX);
		y = clamp(y, pad, maxY);
		for (let n = 0; n < 4; n++) {
			const hit = placed.find((p) => overlaps({ x, y }, p, bubble));
			if (!hit) break;
			x = clamp(hit.x + (x >= hit.x ? bubble.width + 10 : -(bubble.width + 10)), pad, maxX);
			if (y + 16 <= maxY) y = clamp(y + 16, pad, maxY);
		}
		placed.push({ id: ghost.id, x: Math.round(x), y: Math.round(y) });
	}
	return placed;
}
