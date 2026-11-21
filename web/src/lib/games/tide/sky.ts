export const TIDE_CAMERA = {
	position: [0, 5.2, 12.8] as const,
	lookAt: [0, 1.4, -1.8] as const,
	moon: [-5, 12.2, -9.4] as const
};

export function skyStarCount(lowDetail: boolean) {
	return lowDetail ? 400 : 900;
}

export type ConstellationName = '水母' | '灯鱼' | '蝠鲼' | '螺';

export interface Constellation {
	name: ConstellationName;
	points: [number, number, number][];
	edges: [number, number][];
}

function pt(x: number, y: number, z: number): [number, number, number] {
	return [x, y, z];
}

export const CONSTELLATIONS: Constellation[] = [
	{
		name: '水母',
		points: [
			pt(-8.5, 14.2, -12.5),
			pt(-6.8, 16.4, -13.2),
			pt(-5.1, 14.0, -12.8),
			pt(-6.9, 12.6, -12.4),
			pt(-8.0, 10.2, -11.8),
			pt(-6.8, 9.4, -11.6),
			pt(-5.6, 10.0, -11.9)
		],
		edges: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[3, 4],
			[3, 5],
			[3, 6]
		]
	},
	{
		name: '灯鱼',
		points: [
			pt(1.2, 15.8, -14.2),
			pt(3.4, 16.1, -14.0),
			pt(5.6, 15.4, -13.4),
			pt(7.1, 16.8, -13.6),
			pt(3.6, 17.4, -14.4)
		],
		edges: [
			[0, 1],
			[1, 2],
			[2, 3],
			[1, 4]
		]
	},
	{
		name: '蝠鲼',
		points: [
			pt(-2.2, 11.8, -16.4),
			pt(0.2, 12.6, -15.6),
			pt(2.6, 11.6, -16.2),
			pt(0.0, 10.8, -14.8),
			pt(0.4, 10.4, -17.2)
		],
		edges: [
			[0, 1],
			[1, 2],
			[1, 3],
			[1, 4]
		]
	},
	{
		name: '螺',
		points: [
			pt(7.8, 12.4, -11.2),
			pt(8.8, 13.6, -11.8),
			pt(9.6, 12.8, -12.6),
			pt(8.6, 11.8, -12.8),
			pt(7.6, 12.0, -12.0),
			pt(8.4, 12.6, -12.2)
		],
		edges: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[5, 1]
		]
	}
];

export function constellationLinePositions(constellation: Constellation): Float32Array {
	const out: number[] = [];
	for (const [a, b] of constellation.edges) {
		const from = constellation.points[a]!;
		const to = constellation.points[b]!;
		out.push(from[0], from[1], from[2], to[0], to[1], to[2]);
	}
	return new Float32Array(out);
}

export function fillSkyStarPositions(count: number, out: Float32Array, seed = 11) {
	let state = seed >>> 0;
	const rand = () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
	let i = 0;
	let guard = 0;
	while (i < count && guard < count * 24) {
		guard += 1;
		const theta = rand() * Math.PI * 2;
		const y = 0.22 + rand() * 0.78;
		const r = Math.sqrt(Math.max(0, 1 - y * y));
		const x = Math.cos(theta) * r;
		const z = Math.sin(theta) * r;
		if (z > 0.28) continue;
		const radius = 22 + rand() * 12;
		out[i * 3] = x * radius;
		out[i * 3 + 1] = y * radius;
		out[i * 3 + 2] = z * radius;
		i += 1;
	}
	while (i < count) {
		out[i * 3] = (rand() - 0.5) * 28;
		out[i * 3 + 1] = 8 + rand() * 16;
		out[i * 3 + 2] = -8 - rand() * 14;
		i += 1;
	}
}
