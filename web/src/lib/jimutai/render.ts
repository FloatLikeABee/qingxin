import * as THREE from 'three';
import { faceFromNormal, originFromGround, type Face } from './input';
import { CELL, GRID_X, GRID_Z, cellKey, worldCells, type Cell, type ColorId } from './pieces';
import type { CameraState, World } from './world';

export interface PickHit {
	kind: 'ground' | 'piece';
	cell: Cell;
	face: Face;
}

export interface GhostPreview {
	cells: Cell[];
	ok: boolean;
}

export interface JimutaiScene {
	sync(world: World, ghost: GhostPreview | null): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	pick(clientX: number, clientY: number): PickHit | null;
	orbit(dx: number, dy: number): void;
	pan(dx: number, dy: number): void;
	zoom(delta: number): void;
	applyCamera(camera: CameraState): void;
	readCamera(): CameraState;
	screenOf(cell: Cell): { x: number; y: number } | null;
}

const TINT: Record<ColorId, number> = {
	blue: 0x3b82f6,
	sky: 0x7dd3fc,
	coral: 0xfb7185,
	teal: 0x2dd4bf,
	gold: 0xfbbf24
};

function isDark() {
	return document.documentElement.classList.contains('dark');
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2d');
	draw(ctx, size);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	return texture;
}

export function mountJimutaiScene(canvas: HTMLCanvasElement): JimutaiScene | null {
	let renderer: ReturnType<typeof THREE.WebGLRenderer>;
	try {
		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance'
		});
	} catch {
		return null;
	}
	if (!renderer.getContext()) {
		renderer.dispose();
		return null;
	}
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor(0x000000, 0);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.08;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
	const cam: CameraState = {
		yaw: 0.72,
		pitch: 0.78,
		distance: 9.5,
		targetX: 0,
		targetY: 0.35,
		targetZ: 0
	};

	const unitBox = new THREE.BoxGeometry(1, 1, 1);
	const textures: Array<{ dispose: () => void }> = [];
	const materials: Array<ReturnType<typeof THREE.MeshStandardMaterial>> = [];
	const pickables: Array<ReturnType<typeof THREE.Mesh>> = [];

	const keep = (material: ReturnType<typeof THREE.MeshStandardMaterial>) => {
		materials.push(material);
		return material;
	};

	const mat = (color: number, extras: Record<string, unknown> = {}) =>
		keep(
			new THREE.MeshStandardMaterial({
				color,
				roughness: 0.46,
				metalness: 0.08,
				...extras
			})
		);

	const woodTex = canvasTexture((ctx, size) => {
		ctx.fillStyle = '#d7b48a';
		ctx.fillRect(0, 0, size, size);
		for (let i = 0; i < 28; i++) {
			ctx.strokeStyle = i % 2 ? 'rgba(120,72,32,0.18)' : 'rgba(255,236,210,0.28)';
			ctx.lineWidth = 6 + (i % 3);
			ctx.beginPath();
			ctx.moveTo(-20, i * 22);
			ctx.bezierCurveTo(size * 0.3, i * 22 + 8, size * 0.7, i * 22 - 10, size + 20, i * 22 + 4);
			ctx.stroke();
		}
	});
	woodTex.repeat.set(2, 2);
	textures.push(woodTex);

	const gridTex = canvasTexture((ctx, size) => {
		ctx.fillStyle = '#ead7b6';
		ctx.fillRect(0, 0, size, size);
		ctx.strokeStyle = 'rgba(59,130,246,0.28)';
		ctx.lineWidth = 3;
		const step = size / 16;
		for (let i = 0; i <= 16; i++) {
			const p = i * step;
			ctx.beginPath();
			ctx.moveTo(p, 0);
			ctx.lineTo(p, size);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, p);
			ctx.lineTo(size, p);
			ctx.stroke();
		}
	});
	textures.push(gridTex);

	const hemi = new THREE.HemisphereLight(0xdbeafe, 0xf8efe2, 0.9);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xfff7ed, 1.2);
	sun.position.set(6, 10, 5);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.left = -8;
	sun.shadow.camera.right = 8;
	sun.shadow.camera.top = 8;
	sun.shadow.camera.bottom = -8;
	scene.add(sun);
	const fill = new THREE.DirectionalLight(0x93c5fd, 0.4);
	fill.position.set(-6, 6, -4);
	scene.add(fill);
	const rim = new THREE.DirectionalLight(0xfb7185, 0.18);
	rim.position.set(3, 4, -6);
	scene.add(rim);

	const room = new THREE.Group();
	scene.add(room);
	const floor = new THREE.Mesh(unitBox, mat(isDark() ? 0x15253a : 0xe7f0fb));
	floor.position.set(0, -0.28, 0);
	floor.scale.set(18, 0.12, 18);
	floor.receiveShadow = true;
	room.add(floor);
	const wall = new THREE.Mesh(unitBox, mat(isDark() ? 0x1e3350 : 0xf8fbff));
	wall.position.set(0, 3.2, -7.2);
	wall.scale.set(18, 7, 0.2);
	room.add(wall);
	const windowPane = new THREE.Mesh(
		unitBox,
		mat(0x7dd3fc, { transparent: true, opacity: 0.35, roughness: 0.08, metalness: 0.2 })
	);
	windowPane.position.set(0, 3.6, -7.08);
	windowPane.scale.set(7.2, 3.4, 0.08);
	room.add(windowPane);

	const tableW = GRID_X * CELL;
	const tableD = GRID_Z * CELL;
	const table = new THREE.Mesh(
		unitBox,
		keep(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72, metalness: 0.02 }))
	);
	table.position.set(0, -0.1, 0);
	table.scale.set(tableW + 0.35, 0.2, tableD + 0.35);
	table.castShadow = true;
	table.receiveShadow = true;
	table.userData.kind = 'table';
	room.add(table);
	pickables.push(table);

	const grid = new THREE.Mesh(
		unitBox,
		keep(
			new THREE.MeshStandardMaterial({
				map: gridTex,
				transparent: true,
				opacity: 0.55,
				roughness: 0.85
			})
		)
	);
	grid.position.set(0, 0.002, 0);
	grid.scale.set(tableW, 0.004, tableD);
	grid.receiveShadow = true;
	room.add(grid);

	const legMat = mat(0x8b5a2b);
	for (const [lx, lz] of [
		[-1, -1],
		[-1, 1],
		[1, -1],
		[1, 1]
	] as const) {
		const leg = new THREE.Mesh(unitBox, legMat);
		leg.position.set(lx * (tableW / 2 - 0.18), -0.55, lz * (tableD / 2 - 0.18));
		leg.scale.set(0.16, 0.72, 0.16);
		leg.castShadow = true;
		room.add(leg);
	}

	const colorMats = {
		blue: mat(TINT.blue),
		sky: mat(TINT.sky),
		coral: mat(TINT.coral),
		teal: mat(TINT.teal),
		gold: mat(TINT.gold)
	};
	const ghostOk = mat(0x34d399, { transparent: true, opacity: 0.46, roughness: 0.3 });
	const ghostBad = mat(0xf87171, { transparent: true, opacity: 0.5, roughness: 0.3 });

	const blocks = new THREE.Group();
	scene.add(blocks);
	const ghostGroup = new THREE.Group();
	scene.add(ghostGroup);

	let placedSig = '';
	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const project = new THREE.Vector3();
	const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const hitPoint = new THREE.Vector3();

	function placeCamera() {
		cam.pitch = Math.min(1.32, Math.max(0.18, cam.pitch));
		cam.distance = Math.min(18, Math.max(5, cam.distance));
		const x = cam.targetX + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.distance;
		const y = cam.targetY + Math.sin(cam.pitch) * cam.distance;
		const z = cam.targetZ + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.distance;
		camera.position.set(x, y, z);
		camera.lookAt(cam.targetX, cam.targetY, cam.targetZ);
	}

	function cellPos(cell: Cell) {
		return {
			x: (cell.x - (GRID_X - 1) / 2) * CELL,
			y: cell.y * CELL + CELL / 2,
			z: (cell.z - (GRID_Z - 1) / 2) * CELL
		};
	}

	function addCube(
		parent: ReturnType<typeof THREE.Group>,
		cell: Cell,
		material: ReturnType<typeof THREE.MeshStandardMaterial>,
		pick = true
	) {
		const mesh = new THREE.Mesh(unitBox, material);
		const pos = cellPos(cell);
		mesh.position.set(pos.x, pos.y, pos.z);
		mesh.scale.set(CELL * 0.9, CELL * 0.9, CELL * 0.9);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.userData.kind = 'block';
		mesh.userData.cell = { ...cell };
		parent.add(mesh);
		if (pick) pickables.push(mesh);
		return mesh;
	}

	function rebuild(world: World) {
		const sig = world.placed
			.map(
				(piece) =>
					`${piece.id}:${piece.origin.x},${piece.origin.y},${piece.origin.z}:${piece.rotY}${piece.rotX}`
			)
			.join('|');
		if (sig === placedSig) return;
		placedSig = sig;
		for (const child of [...blocks.children]) {
			const idx = pickables.indexOf(child);
			if (idx >= 0) pickables.splice(idx, 1);
			blocks.remove(child);
		}
		for (const piece of world.placed) {
			for (const cell of worldCells(piece)) {
				addCube(blocks, cell, colorMats[piece.color]);
			}
		}
	}

	function syncGhost(ghost: GhostPreview | null) {
		while (ghostGroup.children.length) ghostGroup.remove(ghostGroup.children[0]!);
		if (!ghost) return;
		const material = ghost.ok ? ghostOk : ghostBad;
		const seen = new Set<string>();
		for (const cell of ghost.cells) {
			const key = cellKey(cell);
			if (seen.has(key)) continue;
			seen.add(key);
			addCube(ghostGroup, cell, material, false);
		}
	}

	function sync(world: World, ghost: GhostPreview | null) {
		applyCamera(world.camera);
		rebuild(world);
		syncGhost(ghost);
		const dark = isDark();
		scene.fog = new THREE.Fog(dark ? 0x0b1526 : 0xeaf3ff, 16, 36);
		(floor.material as ReturnType<typeof THREE.MeshStandardMaterial>).color.setHex(
			dark ? 0x15253a : 0xe7f0fb
		);
		(wall.material as ReturnType<typeof THREE.MeshStandardMaterial>).color.setHex(
			dark ? 0x1e3350 : 0xf8fbff
		);
	}

	function pick(clientX: number, clientY: number): PickHit | null {
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		const hits = raycaster.intersectObjects(pickables, false);
		for (const hit of hits) {
			if (hit.object.userData.kind === 'block' && hit.object.userData.cell) {
				const normal = hit.face
					? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
					: new THREE.Vector3(0, 1, 0);
				return {
					kind: 'piece',
					cell: { ...hit.object.userData.cell },
					face: faceFromNormal(normal.x, normal.y, normal.z)
				};
			}
		}
		if (!raycaster.ray.intersectPlane(plane, hitPoint)) return null;
		const cell = originFromGround(hitPoint.x, hitPoint.z);
		if (cell.x < 0 || cell.x >= GRID_X || cell.z < 0 || cell.z >= GRID_Z) return null;
		return { kind: 'ground', cell, face: 'py' };
	}

	function orbit(dx: number, dy: number) {
		cam.yaw += dx * 0.007;
		cam.pitch += dy * 0.005;
		placeCamera();
	}

	function pan(dx: number, dy: number) {
		const right = new THREE.Vector3();
		camera.getWorldDirection(right);
		right.cross(camera.up).normalize();
		const up = camera.up.clone().normalize();
		cam.targetX -= right.x * dx * 0.012 + up.x * dy * 0.012;
		cam.targetY = Math.min(3, Math.max(0, cam.targetY + up.y * dy * 0.008));
		cam.targetZ -= right.z * dx * 0.012 + up.z * dy * 0.012;
		placeCamera();
	}

	function zoom(delta: number) {
		cam.distance *= delta > 0 ? 1.08 : 0.92;
		placeCamera();
	}

	function applyCamera(next: CameraState) {
		cam.yaw = next.yaw;
		cam.pitch = next.pitch;
		cam.distance = next.distance;
		cam.targetX = next.targetX;
		cam.targetY = next.targetY;
		cam.targetZ = next.targetZ;
		placeCamera();
	}

	function readCamera(): CameraState {
		return { ...cam };
	}

	function screenOf(cell: Cell) {
		const pos = cellPos(cell);
		project.set(pos.x, pos.y, pos.z).project(camera);
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0) return null;
		return {
			x: rect.left + ((project.x + 1) / 2) * rect.width,
			y: rect.top + ((-project.y + 1) / 2) * rect.height
		};
	}

	function resize() {
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, h < 700 ? 1.35 : 1.75));
		renderer.setSize(w, h, false);
		placeCamera();
	}

	function render() {
		renderer.render(scene, camera);
	}

	function dispose() {
		renderer.dispose();
		unitBox.dispose();
		for (const texture of textures) texture.dispose();
		for (const material of materials) material.dispose();
	}

	resize();
	return {
		sync,
		render,
		resize,
		dispose,
		pick,
		orbit,
		pan,
		zoom,
		applyCamera,
		readCamera,
		screenOf
	};
}
