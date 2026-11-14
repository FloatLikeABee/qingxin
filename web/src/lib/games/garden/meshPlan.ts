import type { LeafShape, Morph } from './morph';
import type { PlantDef } from './plants';
import type { Stage } from './sim';

export type GeoKind = 'box' | 'sphere' | 'cyl' | 'cone';
export type Tint = 'stem' | 'leaf' | 'bloom' | 'fruit' | 'wood';

export interface MeshPart {
	geo: GeoKind;
	x: number;
	y: number;
	z: number;
	sx: number;
	sy: number;
	sz: number;
	rx: number;
	ry: number;
	rz: number;
	tint: Tint;
}

function part(
	geo: GeoKind,
	x: number,
	y: number,
	z: number,
	sx: number,
	sy: number,
	sz: number,
	tint: Tint,
	rx = 0,
	ry = 0,
	rz = 0
): MeshPart {
	return { geo, x, y, z, sx, sy, sz, rx, ry, rz, tint };
}

function leafSpec(shape: LeafShape): { geo: GeoKind; sx: number; sy: number; sz: number } {
	if (shape === 'lance') return { geo: 'cyl', sx: 0.045, sy: 0.32, sz: 0.045 };
	if (shape === 'needle') return { geo: 'cyl', sx: 0.02, sy: 0.34, sz: 0.02 };
	if (shape === 'frond') return { geo: 'box', sx: 0.32, sy: 0.03, sz: 0.11 };
	if (shape === 'palmate') return { geo: 'box', sx: 0.22, sy: 0.035, sz: 0.18 };
	if (shape === 'heart') return { geo: 'sphere', sx: 0.18, sy: 0.1, sz: 0.16 };
	if (shape === 'compound') return { geo: 'sphere', sx: 0.11, sy: 0.045, sz: 0.14 };
	if (shape === 'round') return { geo: 'sphere', sx: 0.18, sy: 0.055, sz: 0.18 };
	return { geo: 'sphere', sx: 0.15, sy: 0.05, sz: 0.11 };
}

function addLeaves(
	out: MeshPart[],
	morph: Morph,
	count: number,
	y: number,
	span: number,
	droop: number
) {
	const spec = leafSpec(morph.leafShape);
	const n = Math.max(3, Math.min(12, count));
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + morph.height * 0.15;
		const rise = (i % 3) * 0.045 * morph.height;
		out.push(
			part(
				spec.geo,
				Math.cos(a) * span,
				y + rise,
				Math.sin(a) * span * 0.78,
				spec.sx,
				spec.sy,
				spec.sz,
				'leaf',
				morph.leafShape === 'frond' ? 0.15 : -0.55 - droop,
				a,
				morph.leafShape === 'lance' ? 0.35 : 0.18
			)
		);
		if (morph.leafShape === 'compound') {
			out.push(
				part(
					'sphere',
					Math.cos(a) * span * 1.18,
					y + rise + 0.04,
					Math.sin(a) * span * 0.9,
					0.08,
					0.035,
					0.1,
					'leaf',
					-0.4,
					a + 0.4,
					0.1
				)
			);
		}
	}
}

function addBloom(out: MeshPart[], morph: Morph, y: number, scale: number) {
	const kind = morph.bloomKind;
	if (kind === 'none') return;
	if (kind === 'disc') {
		out.push(part('sphere', 0, y, 0, 0.34 * scale, 0.1 * scale, 0.34 * scale, 'bloom'));
		out.push(part('sphere', 0, y + 0.02, 0, 0.16 * scale, 0.08 * scale, 0.16 * scale, 'fruit'));
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2;
			out.push(
				part(
					'cone',
					Math.cos(a) * 0.22 * scale,
					y,
					Math.sin(a) * 0.22 * scale,
					0.08 * scale,
					0.16 * scale,
					0.08 * scale,
					'bloom',
					1.2,
					a,
					0
				)
			);
		}
		return;
	}
	if (kind === 'spike') {
		out.push(part('cyl', 0, y + 0.08, 0, 0.06 * scale, 0.28 * scale, 0.06 * scale, 'bloom'));
		return;
	}
	if (kind === 'cluster') {
		out.push(part('sphere', 0.08, y, 0.04, 0.1 * scale, 0.1 * scale, 0.1 * scale, 'bloom'));
		out.push(
			part('sphere', -0.07, y + 0.03, -0.05, 0.09 * scale, 0.09 * scale, 0.09 * scale, 'bloom')
		);
		out.push(
			part('sphere', 0.02, y + 0.06, -0.08, 0.08 * scale, 0.08 * scale, 0.08 * scale, 'bloom')
		);
		return;
	}
	if (kind === 'bell') {
		out.push(
			part('cone', 0, y, 0, 0.16 * scale, 0.2 * scale, 0.16 * scale, 'bloom', Math.PI, 0, 0)
		);
		return;
	}
	if (kind === 'cup') {
		out.push(part('cone', 0, y, 0, 0.14 * scale, 0.18 * scale, 0.14 * scale, 'bloom'));
		return;
	}
	if (kind === 'umbrella') {
		out.push(part('sphere', 0, y, 0, 0.32 * scale, 0.06 * scale, 0.32 * scale, 'bloom'));
		out.push(part('cyl', 0, y - 0.12, 0, 0.03, 0.16, 0.03, 'stem'));
		return;
	}
	if (kind === 'star') {
		for (let i = 0; i < 5; i++) {
			const a = (i / 5) * Math.PI * 2;
			out.push(
				part(
					'cone',
					Math.cos(a) * 0.08,
					y,
					Math.sin(a) * 0.08,
					0.07 * scale,
					0.18 * scale,
					0.07 * scale,
					'bloom',
					0.9,
					a,
					0
				)
			);
		}
		return;
	}
	out.push(part('sphere', 0, y, 0, 0.16 * scale, 0.14 * scale, 0.16 * scale, 'bloom'));
}

function addFruit(out: MeshPart[], morph: Morph, y: number, span: number) {
	const kind = morph.fruitKind;
	if (kind === 'none') return;
	if (kind === 'berry') {
		out.push(part('sphere', span * 0.5, y * 0.55, 0.06, 0.12, 0.12, 0.12, 'fruit'));
		out.push(part('sphere', -span * 0.4, y * 0.62, -0.05, 0.1, 0.1, 0.1, 'fruit'));
		out.push(part('sphere', 0.04, y * 0.48, span * 0.35, 0.09, 0.09, 0.09, 'fruit'));
		return;
	}
	if (kind === 'pod') {
		out.push(part('cyl', 0.16, y * 0.4, 0.08, 0.06, 0.22, 0.06, 'fruit', 0.6, 0.4, 0.2));
		out.push(part('cyl', -0.12, y * 0.45, -0.04, 0.05, 0.18, 0.05, 'fruit', 0.5, -0.3, 0));
		return;
	}
	if (kind === 'bulb') {
		out.push(part('cone', 0, 0.08, 0, 0.16, 0.28, 0.16, 'fruit', Math.PI, 0, 0));
		return;
	}
	if (kind === 'head') {
		out.push(part('sphere', 0, y * 0.35, 0, 0.36, 0.28, 0.36, 'leaf'));
		return;
	}
	if (kind === 'gourd') {
		out.push(part('sphere', 0.2, 0.16, 0.1, 0.18, 0.14, 0.22, 'fruit'));
		out.push(part('cyl', 0.2, 0.28, 0.1, 0.04, 0.1, 0.04, 'stem'));
		return;
	}
	if (kind === 'drupe') {
		out.push(part('sphere', 0.22, y * 0.72, 0.1, 0.12, 0.14, 0.12, 'fruit'));
		out.push(part('sphere', -0.18, y * 0.78, -0.12, 0.11, 0.13, 0.11, 'fruit'));
		return;
	}
	if (kind === 'ear') {
		out.push(part('cyl', 0.08, y * 0.7, 0.04, 0.08, 0.28, 0.08, 'fruit', 0.25, 0, 0));
		out.push(part('cone', 0.08, y * 0.88, 0.04, 0.07, 0.1, 0.07, 'bloom'));
		return;
	}
	if (kind === 'cluster') {
		for (let i = 0; i < 6; i++) {
			const a = (i / 6) * Math.PI * 2;
			out.push(
				part(
					'sphere',
					Math.cos(a) * 0.08,
					y * 0.4 - (i % 3) * 0.05,
					Math.sin(a) * 0.08,
					0.07,
					0.07,
					0.07,
					'fruit'
				)
			);
		}
	}
}

function familyPlan(morph: Morph, stage: Stage, scale: number): MeshPart[] {
	const out: MeshPart[] = [];
	const h = Math.min(1.08, Math.max(0.32, morph.height * scale * 0.78));
	const family = morph.family;
	const showBloom = stage === 'bud' || stage === 'bloom' || stage === 'ripe';
	const showFruit = stage === 'ripe';
	const leafN = Math.max(3, Math.round((morph.leafCount / 2) * scale));

	if (family === 'rosette') {
		addLeaves(out, morph, Math.max(8, leafN), 0.14, 0.22 + h * 0.2, 0.05);
		if (showFruit) addFruit(out, morph, h, 0.2);
		else if (showBloom) addBloom(out, morph, 0.22 + h * 0.25, 0.7);
		return out;
	}
	if (family === 'succulent') {
		const pads = Math.min(10, morph.leafCount);
		for (let i = 0; i < pads; i++) {
			const a = (i / pads) * Math.PI * 2;
			out.push(
				part(
					'sphere',
					Math.cos(a) * 0.16,
					0.12 + (i % 2) * 0.06,
					Math.sin(a) * 0.16,
					0.1 + morph.height * 0.08,
					0.2 + morph.height * 0.15,
					0.08,
					'leaf',
					0.7,
					a,
					0.15
				)
			);
		}
		out.push(part('sphere', 0, 0.16, 0, 0.14, 0.12, 0.14, 'stem'));
		if (showBloom) addBloom(out, morph, 0.34 + h * 0.2, 0.55);
		return out;
	}
	if (family === 'leafy') {
		out.push(part('cyl', 0, h * 0.12, 0, 0.05, h * 0.22, 0.05, 'stem'));
		addLeaves(out, morph, Math.max(8, leafN), h * 0.22, 0.26 + h * 0.1, 0);
		if (showFruit && morph.fruitKind === 'head') addFruit(out, morph, h, 0.2);
		else if (showBloom) addBloom(out, morph, h * 0.55, 0.6);
		return out;
	}
	if (family === 'grass') {
		const stems = Math.max(1, Math.min(8, morph.stemCount));
		for (let i = 0; i < stems; i++) {
			const a = (i / stems) * Math.PI * 2;
			const r = stems === 1 ? 0 : 0.1;
			out.push(
				part(
					'cyl',
					Math.cos(a) * r,
					h * 0.48,
					Math.sin(a) * r,
					0.03,
					h * 0.96,
					0.03,
					'stem',
					0.08,
					a,
					0.12
				)
			);
		}
		addLeaves(out, morph, Math.min(8, leafN), h * 0.4, 0.18, 0.2);
		if (showFruit) addFruit(out, morph, h, 0.12);
		else if (showBloom) addBloom(out, morph, h * 0.95, 0.7);
		return out;
	}
	if (family === 'tree') {
		const canopy = 0.5 + morph.leafCount * 0.016 + morph.height * 0.04;
		out.push(part('cyl', 0, h * 0.32, 0, 0.1, h * 0.64, 0.1, 'wood'));
		out.push(part('sphere', 0, h * 0.82, 0, canopy, canopy * 0.78, canopy, 'leaf'));
		out.push(
			part('sphere', 0.22, h * 0.72, 0.12, canopy * 0.52, canopy * 0.42, canopy * 0.52, 'leaf')
		);
		out.push(
			part('sphere', -0.2, h * 0.78, -0.14, canopy * 0.45, canopy * 0.4, canopy * 0.45, 'leaf')
		);
		if (showBloom && morph.bloomKind !== 'none') addBloom(out, morph, h * 0.9, 0.5);
		if (showFruit) addFruit(out, morph, h, 0.28);
		return out;
	}
	if (family === 'vine') {
		out.push(part('cyl', 0.18, h * 0.5, -0.04, 0.04, h, 0.04, 'wood'));
		out.push(part('cyl', -0.16, h * 0.42, 0.04, 0.03, h * 0.84, 0.03, 'wood'));
		out.push(part('cyl', 0, h * 0.92, 0, 0.28, 0.03, 0.03, 'wood', 0, 0, 1.2));
		out.push(part('cyl', 0.02, h * 0.45, 0, 0.035, h * 0.9, 0.035, 'stem', 0.25, 0.4, 0.15));
		addLeaves(out, morph, Math.max(6, leafN), h * 0.55, 0.3, 0.1);
		if (showBloom && !showFruit) addBloom(out, morph, h * 0.75, 0.65);
		if (showFruit) addFruit(out, morph, h, 0.24);
		return out;
	}
	if (family === 'aquatic') {
		out.push(part('sphere', 0, 0.06, 0, 0.42, 0.04, 0.42, 'stem'));
		out.push(part('sphere', 0.16, 0.08, 0.08, 0.28, 0.03, 0.28, 'leaf'));
		out.push(part('cyl', 0, h * 0.4, 0, 0.035, h * 0.8, 0.035, 'stem'));
		addLeaves(out, morph, Math.min(6, leafN), h * 0.55, 0.16, 0);
		if (showBloom) addBloom(out, morph, h * 0.88, 0.8);
		if (showFruit) addFruit(out, morph, h, 0.16);
		return out;
	}
	if (family === 'flower') {
		out.push(part('cyl', 0, h * 0.42, 0, 0.045, h * 0.84, 0.045, 'stem'));
		addLeaves(out, morph, Math.max(4, Math.min(8, leafN)), h * 0.28, 0.2, 0.08);
		if (stage === 'bud') out.push(part('sphere', 0, h * 0.86, 0, 0.1, 0.1, 0.1, 'bloom'));
		else if (showBloom) addBloom(out, morph, h * 0.92, 1);
		if (showFruit) addFruit(out, morph, h, 0.16);
		return out;
	}
	const stems = Math.max(1, Math.min(4, morph.stemCount));
	for (let i = 0; i < stems; i++) {
		const a = (i / stems) * Math.PI * 2;
		const r = stems === 1 ? 0 : 0.07;
		out.push(
			part(
				'cyl',
				Math.cos(a) * r,
				h * 0.42,
				Math.sin(a) * r,
				0.04,
				h * 0.84,
				0.04,
				'stem',
				0.05,
				a,
				stems > 1 ? 0.12 : 0
			)
		);
	}
	addLeaves(out, morph, Math.max(5, leafN), h * 0.5, 0.22 + h * 0.04, 0.05);
	if (showBloom && !showFruit) addBloom(out, morph, h * 0.86, 0.75);
	if (showFruit) addFruit(out, morph, h, 0.2);
	else if (stage === 'bloom') addBloom(out, morph, h * 0.86, 0.75);
	return out;
}

export function plantMeshPlan(def: PlantDef, stage: Stage, health = 3): MeshPart[] {
	if (stage === 'empty') return [];
	if (stage === 'seed') {
		return [part('sphere', 0, 0.07, 0, 0.1, 0.08, 0.1, 'fruit')];
	}
	if (stage === 'wilt') {
		return [
			part('cyl', 0.04, 0.16, 0, 0.04, 0.28, 0.04, 'wood', 0, 0, 0.7),
			part('sphere', 0.12, 0.28, 0.02, 0.16, 0.05, 0.12, 'wood', 0.4, 0.2, 0.5)
		];
	}
	if (stage === 'sprout') {
		return [
			part('cyl', 0, 0.16, 0, 0.035, 0.26, 0.035, 'stem'),
			part('sphere', 0.09, 0.26, 0, 0.14, 0.04, 0.09, 'leaf', 0, 0, -0.4),
			part('sphere', -0.08, 0.24, 0.02, 0.12, 0.04, 0.08, 'leaf', 0, 0, 0.4)
		];
	}
	const scale = stage === 'leaf' ? 0.58 : stage === 'bud' ? 0.76 : stage === 'bloom' ? 0.9 : 1;
	const parts = familyPlan(def.morph, stage, scale);
	if (health <= 1) {
		for (const item of parts) {
			if (item.tint === 'leaf' || item.tint === 'stem') item.rz += 0.18;
		}
	}
	return parts;
}

export function planSignature(parts: MeshPart[]): string {
	return parts
		.map(
			(item) =>
				`${item.geo}:${item.tint}:${item.x.toFixed(2)},${item.y.toFixed(2)},${item.z.toFixed(2)}:${item.sx.toFixed(2)}x${item.sy.toFixed(2)}x${item.sz.toFixed(2)}:${item.rx.toFixed(2)}/${item.ry.toFixed(2)}/${item.rz.toFixed(2)}`
		)
		.join('|');
}

export function familyRoles(parts: MeshPart[]) {
	return {
		leaves: parts.filter((item) => item.tint === 'leaf').length,
		blooms: parts.filter((item) => item.tint === 'bloom').length,
		fruits: parts.filter((item) => item.tint === 'fruit').length,
		stems: parts.filter((item) => item.tint === 'stem' || item.tint === 'wood').length
	};
}
