export const TIDE_CAMERA = {
	position: [0, 5.2, 12.8] as const,
	lookAt: [0, 1.4, -1.8] as const
};

const FORWARD = [0, -0.25198, -0.96773] as const;
const UP = [0, 0.96773, -0.25198] as const;
const RIGHT = [1, 0, 0] as const;

export function skyBandPoint(nx: number, ny: number, dist: number): [number, number, number] {
	const [px, py, pz] = TIDE_CAMERA.position;
	return [
		px + FORWARD[0] * dist + UP[0] * ny + RIGHT[0] * nx,
		py + FORWARD[1] * dist + UP[1] * ny + RIGHT[1] * nx,
		pz + FORWARD[2] * dist + UP[2] * ny + RIGHT[2] * nx
	];
}

export const TIDE_MOON = skyBandPoint(-5.4, 6.05, 22);

export function skyStarCount(lowDetail: boolean) {
	return lowDetail ? 400 : 900;
}

export type ConstellationName = '水母' | '灯鱼' | '蝠鲼' | '螺';

export interface Constellation {
	name: ConstellationName;
	points: [number, number, number][];
	edges: [number, number][];
}

function figure(
	name: ConstellationName,
	dots: Array<[number, number, number]>,
	edges: [number, number][]
): Constellation {
	return {
		name,
		points: dots.map(([nx, ny, dist]) => skyBandPoint(nx, ny, dist)),
		edges
	};
}

export const CONSTELLATIONS: Constellation[] = [
	figure(
		'水母',
		[
			[-9.2, 6.4, 24],
			[-7.4, 7.5, 24],
			[-5.6, 6.3, 24],
			[-7.5, 5.4, 24],
			[-8.8, 4.2, 24],
			[-7.5, 3.8, 24],
			[-6.1, 4.1, 24]
		],
		[
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[3, 4],
			[3, 5],
			[3, 6]
		]
	),
	figure(
		'灯鱼',
		[
			[1.4, 7.2, 25],
			[3.8, 7.35, 25],
			[6.4, 6.9, 25],
			[8.2, 7.8, 25],
			[4.0, 8.15, 25]
		],
		[
			[0, 1],
			[1, 2],
			[2, 3],
			[1, 4]
		]
	),
	figure(
		'蝠鲼',
		[
			[-4.6, 5.1, 26],
			[0.1, 5.55, 26],
			[4.8, 5.0, 26],
			[0.0, 4.35, 26],
			[0.4, 4.15, 26.6]
		],
		[
			[0, 1],
			[1, 2],
			[1, 3],
			[1, 4]
		]
	),
	figure(
		'螺',
		[
			[8.4, 4.9, 23],
			[9.6, 5.7, 23],
			[10.6, 5.15, 23],
			[9.5, 4.45, 23],
			[8.2, 4.55, 23],
			[9.2, 5.05, 23]
		],
		[
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[5, 1]
		]
	)
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
	for (let i = 0; i < count; i++) {
		const nx = (rand() - 0.5) * 22;
		const ny = 3.4 + rand() * 5.4;
		const dist = 18 + rand() * 12;
		const point = skyBandPoint(nx, ny, dist);
		out[i * 3] = point[0];
		out[i * 3 + 1] = point[1];
		out[i * 3 + 2] = point[2];
	}
}
