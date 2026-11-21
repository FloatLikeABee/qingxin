import { FLOOR_HEIGHT } from './floors';

export function playFrustum(overview: boolean, viewportH: number): number {
	if (overview) return viewportH < 700 ? 12.5 : 13.8;
	return viewportH < 700 ? 4.35 : 4.85;
}

export function cameraPose(overview: boolean, floorY: number, yaw: number) {
	const radius = overview ? 24 : 10.4;
	const height = overview ? 18 : 6.6;
	return {
		x: Math.cos(yaw) * radius,
		y: floorY + height,
		z: Math.sin(yaw) * radius + (overview ? 3.4 : 1.05),
		lookX: 0,
		lookY: floorY + (overview ? FLOOR_HEIGHT * 2 : 0.62),
		lookZ: overview ? 0.4 : 0.15
	};
}
