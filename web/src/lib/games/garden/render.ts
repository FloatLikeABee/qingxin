import * as THREE from 'three';
import { plantMeshPlan, type GeoKind, type Tint } from './meshPlan';
import { plantById } from './plants';
import type { Bed, Bug, GardenState } from './sim';

export interface GardenScene {
	sync(garden: GardenState, selected: number): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	pick(clientX: number, clientY: number): number | null;
}

const COLS = 4;

function isDark(): boolean {
	return document.documentElement.classList.contains('dark');
}

function hex(color: string, fallback = 0x4d7c0f) {
	const n = Number.parseInt(color.replace('#', ''), 16);
	return Number.isFinite(n) ? n : fallback;
}

export function potPos(id: number) {
	const col = id % COLS;
	const row = Math.floor(id / COLS);
	return { x: (col - 1.5) * 1.08, z: (row - 1.05) * 0.98 };
}

function mat(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.62,
		metalness: 0.04,
		...extras
	});
}

export function mountGardenScene(canvas: HTMLCanvasElement): GardenScene | null {
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: true,
		powerPreference: 'high-performance'
	});
	if (!renderer.getContext()) {
		renderer.dispose();
		return null;
	}
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor(0x000000, 0);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.1;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 48);
	function placeCamera(aspect: number) {
		const portrait = aspect < 0.78;
		camera.fov = portrait ? 44 : 34;
		camera.position.set(0, portrait ? 5.55 : 4.25, portrait ? 7.35 : 5.35);
		camera.lookAt(0, portrait ? 0.62 : 0.7, portrait ? 0.15 : -0.35);
		camera.updateProjectionMatrix();
	}
	placeCamera(1);

	const box = new THREE.BoxGeometry(1, 1, 1);
	const sphere = new THREE.SphereGeometry(0.5, 16, 12);
	const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
	const cone = new THREE.ConeGeometry(0.5, 1, 10);
	const potBody = new THREE.CylinderGeometry(0.46, 0.34, 1, 14);
	const geos: Record<GeoKind, unknown> = { box, sphere, cyl, cone };
	const materials: Array<{ dispose: () => void }> = [];
	const matCache = new Map<string, ReturnType<typeof mat>>();
	const keep = (material: ReturnType<typeof mat>, key?: string) => {
		materials.push(material);
		if (key) matCache.set(key, material);
		return material;
	};
	const cached = (key: string, color: number, extras: Record<string, unknown> = {}) => {
		const hit = matCache.get(key);
		if (hit) return hit;
		return keep(mat(color, extras), key);
	};

	let wood = keep(mat(0xc48a58), 'wood');
	let wall = keep(mat(0xe8f1fb), 'wall');
	let trim = keep(mat(0x3b82f6), 'trim');
	let sill = keep(mat(0xf3e6d4), 'sill');
	let soil = keep(mat(0x6b4423), 'soil');
	let glass = keep(
		mat(0xbfdbfe, { transparent: true, opacity: 0.22, roughness: 0.06, metalness: 0.22 }),
		'glass'
	);
	let curtain = keep(
		mat(0x93c5fd, { transparent: true, opacity: 0.28, roughness: 0.85, side: THREE.DoubleSide }),
		'curtain'
	);
	let city = keep(mat(0x64748b), 'city');
	const selectMat = cached('select', 0x3b82f6, { emissive: 0x3b82f6, emissiveIntensity: 0.45 });
	const dropMat = cached('drop', 0x3b82f6, { emissive: 0x3b82f6, emissiveIntensity: 0.35 });
	const feedMat = cached('feed', 0xeab308, { emissive: 0xeab308, emissiveIntensity: 0.28 });
	const hurtMat = cached('hurt', 0xc45c6a, { emissive: 0xc45c6a, emissiveIntensity: 0.3 });
	const shadeMat = cached('cloth', 0x60a5fa, { transparent: true, opacity: 0.55 });

	const hemi = new THREE.HemisphereLight(0xb9d7ff, 0xe8d5b5, 0.95);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xfff4dd, 1.25);
	sun.position.set(-2.6, 6.4, 3.4);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.left = -6;
	sun.shadow.camera.right = 6;
	sun.shadow.camera.top = 6;
	sun.shadow.camera.bottom = -6;
	scene.add(sun);
	const windowLight = new THREE.PointLight(0x93c5fd, 0.85, 12);
	windowLight.position.set(0, 2.5, -2.1);
	scene.add(windowLight);
	const lamp = new THREE.PointLight(0xffe7c2, 0.6, 9);
	lamp.position.set(1.8, 2.6, 1.6);
	scene.add(lamp);

	const root = new THREE.Group();
	scene.add(root);
	const pickables: Array<ReturnType<typeof THREE.Mesh>> = [];
	const potGroups: Array<ReturnType<typeof THREE.Group>> = [];
	const plantGroups: Array<ReturnType<typeof THREE.Group>> = [];
	const rings: Array<ReturnType<typeof THREE.Mesh>> = [];
	const needGroups: Array<ReturnType<typeof THREE.Group>> = [];
	const shadeCloths: Array<ReturnType<typeof THREE.Mesh>> = [];
	const bugsRoot = new THREE.Group();
	root.add(bugsRoot);
	const bugMap = new Map<number, ReturnType<typeof THREE.Group>>();
	const plantKey: string[] = Array.from({ length: 12 }, () => '');
	const needKey: string[] = Array.from({ length: 12 }, () => '');
	let reduceMotion = false;

	function addMesh(
		parent: { add: (child: unknown) => void },
		geo: unknown,
		material: unknown,
		x: number,
		y: number,
		z: number,
		sx: number,
		sy: number,
		sz: number
	) {
		const mesh = new THREE.Mesh(geo as never, material as never);
		mesh.position.set(x, y, z);
		mesh.scale.set(sx, sy, sz);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		parent.add(mesh);
		return mesh;
	}

	function applyPalette() {
		const dark = isDark();
		scene.background = new THREE.Color(dark ? 0x0b1526 : 0x9ec9ff);
		hemi.color.set(dark ? 0x8fb4e8 : 0xb9d7ff);
		hemi.groundColor.set(dark ? 0x1b283c : 0xe8d5b5);
		wall.color.set(dark ? 0x1c2e46 : 0xe8f1fb);
		sill.color.set(dark ? 0x3a2a1c : 0xf3e6d4);
		wood.color.set(dark ? 0x8a5a38 : 0xc48a58);
		city.color.set(dark ? 0x1e293b : 0x64748b);
		curtain.color.set(dark ? 0x1d4ed8 : 0x93c5fd);
		sun.intensity = dark ? 0.7 : 1.25;
		windowLight.intensity = dark ? 1.05 : 0.85;
	}

	function buildRoom() {
		addMesh(root, box, wall, 0, 1.65, -2.62, 7.8, 3.4, 0.12);
		addMesh(root, box, glass, 0, 1.85, -2.54, 4.6, 2.05, 0.05);
		addMesh(root, box, trim, 0, 2.9, -2.5, 4.9, 0.1, 0.1);
		addMesh(root, box, trim, 0, 0.82, -2.5, 4.9, 0.1, 0.1);
		addMesh(root, box, trim, -2.3, 1.86, -2.5, 0.08, 2.1, 0.08);
		addMesh(root, box, trim, 2.3, 1.86, -2.5, 0.08, 2.1, 0.08);
		addMesh(root, box, trim, 0, 1.86, -2.5, 0.08, 2.1, 0.08);
		addMesh(root, box, trim, 0, 1.86, -2.5, 4.7, 0.08, 0.08);
		addMesh(root, box, wall, -3.85, 1.65, 0.2, 0.12, 3.4, 5.6);
		addMesh(root, box, wall, 3.85, 1.65, 0.2, 0.12, 3.4, 5.6);
		addMesh(root, box, wood, 0, -0.06, 0.55, 7.6, 0.1, 5.8);
		addMesh(root, box, sill, 0, 0.34, -1.85, 5.4, 0.14, 0.85);
		addMesh(root, box, wood, 0, 0.3, 0.45, 5.5, 0.14, 3.55);
		addMesh(root, box, cached('rug', 0x14b8a6), 0, 0.0, 1.4, 3.2, 0.03, 1.6);
		addMesh(root, box, curtain, -2.55, 1.85, -2.35, 0.55, 2.1, 0.04);
		addMesh(root, box, curtain, 2.55, 1.85, -2.35, 0.55, 2.1, 0.04);
		addMesh(root, box, city, -1.4, 1.15, -3.35, 0.9, 1.6, 0.5);
		addMesh(root, box, city, 0.15, 1.45, -3.5, 0.7, 2.2, 0.45);
		addMesh(root, box, city, 1.5, 1.05, -3.4, 1.1, 1.4, 0.5);
		addMesh(root, box, cached('gold', 0xeab308), -1.4, 2.05, -3.1, 0.12, 0.12, 0.12);
		addMesh(root, cyl, cached('can', 0x3b82f6), 2.35, 0.55, 1.55, 0.22, 0.28, 0.18);
		addMesh(root, cyl, cached('canspout', 0x60a5fa), 2.5, 0.62, 1.42, 0.06, 0.22, 0.06);
		addMesh(root, cyl, cached('gold2', 0xeab308), -2.35, 2.85, 0.8, 0.16, 0.05, 0.16);
	}

	function tintMat(def: NonNullable<ReturnType<typeof plantById>>, tint: Tint) {
		if (tint === 'stem') return cached(`stem-${def.id}`, hex(def.palette.stem));
		if (tint === 'leaf') return cached(`leaf-${def.id}`, hex(def.palette.leaf, 0x65a30d));
		if (tint === 'bloom') return cached(`bloom-${def.id}`, hex(def.palette.bloom, 0xf97316));
		if (tint === 'fruit') return cached(`fruit-${def.id}`, hex(def.palette.bloom, 0xef4444));
		return cached('bark', 0x7c4a24);
	}

	function fillPlant(group: ReturnType<typeof THREE.Group>, bed: Bed) {
		while (group.children.length) group.remove(group.children[0]!);
		const def = bed.plantId ? plantById(bed.plantId) : undefined;
		if (!def || bed.stage === 'empty') {
			group.rotation.z = 0;
			return;
		}
		for (const item of plantMeshPlan(def, bed.stage, bed.health)) {
			const mesh = addMesh(
				group,
				geos[item.geo],
				tintMat(def, item.tint),
				item.x,
				item.y,
				item.z,
				item.sx,
				item.sy,
				item.sz
			);
			mesh.rotation.set(item.rx, item.ry, item.rz);
		}
		group.rotation.z = (3 - bed.health) * 0.09;
	}

	function fillNeeds(group: ReturnType<typeof THREE.Group>, bed: Bed) {
		while (group.children.length) group.remove(group.children[0]!);
		if (!bed.plantId || bed.stage === 'empty') return;
		let x = -0.12;
		if (bed.water <= 1) {
			addMesh(group, sphere, dropMat, x, 0, 0, 0.08, 0.11, 0.08);
			x += 0.14;
		}
		if (bed.nutrient <= 1) {
			addMesh(group, sphere, feedMat, x, 0, 0, 0.08, 0.08, 0.08);
			x += 0.14;
		}
		if (bed.health <= 1) addMesh(group, sphere, hurtMat, x, 0, 0, 0.08, 0.08, 0.08);
	}

	function makePot(id: number) {
		const group = new THREE.Group();
		const { x, z } = potPos(id);
		group.position.set(x, 0.44, z);
		root.add(group);
		const glaze = [0xc45c6a, 0xc47a4a, 0x14b8a6][id % 3] ?? 0xc45c6a;
		const terra = cached(`pot-${id % 3}`, glaze);
		const pot = addMesh(group, potBody, terra, 0, 0.18, 0, 0.72, 0.36, 0.72);
		pot.userData.bedId = id;
		pickables.push(pot);
		addMesh(group, cyl, terra, 0, 0.35, 0, 0.82, 0.06, 0.82);
		addMesh(group, cyl, soil, 0, 0.34, 0, 0.62, 0.05, 0.62);
		const ring = addMesh(group, cyl, selectMat, 0, 0.02, 0, 0.95, 0.03, 0.95);
		ring.visible = false;
		rings[id] = ring;
		const cloth = addMesh(group, box, shadeMat, 0, 0.42, 0, 0.7, 0.04, 0.7);
		cloth.visible = false;
		shadeCloths[id] = cloth;
		const plant = new THREE.Group();
		plant.position.y = 0.36;
		group.add(plant);
		const needs = new THREE.Group();
		needs.position.y = 1.15;
		group.add(needs);
		potGroups[id] = group;
		plantGroups[id] = plant;
		needGroups[id] = needs;
	}

	function bugMesh(bug: Bug) {
		const group = new THREE.Group();
		if (bug.kind === 'bee') {
			addMesh(group, sphere, cached('bee', 0xeab308), 0, 0, 0, 0.16, 0.11, 0.11);
			addMesh(group, sphere, cached('beedark', 0x1f2937), 0.05, 0, 0, 0.08, 0.09, 0.09);
			const wing = addMesh(
				group,
				sphere,
				cached('wing', 0xe0f2fe),
				0,
				0.05,
				0.06,
				0.14,
				0.03,
				0.08
			);
			wing.name = 'wing';
		} else if (bug.kind === 'butterfly') {
			const l = addMesh(group, box, cached('bf1', 0xf97316), -0.1, 0, 0, 0.2, 0.02, 0.14);
			const r = addMesh(group, box, cached('bf2', 0x818cf8), 0.1, 0, 0, 0.2, 0.02, 0.14);
			l.name = 'wingL';
			r.name = 'wingR';
		} else if (bug.kind === 'ladybug') {
			addMesh(group, sphere, cached('lb', 0xef4444), 0, 0, 0, 0.14, 0.1, 0.14);
			addMesh(group, sphere, cached('lbh', 0x111827), 0.04, 0.04, 0, 0.06, 0.06, 0.06);
		} else if (bug.kind === 'snail') {
			addMesh(group, sphere, cached('sn', 0xd6d3d1), 0, 0, 0, 0.14, 0.08, 0.1);
			addMesh(group, sphere, cached('sns', 0xc45c6a), 0.03, 0.05, 0, 0.1, 0.1, 0.1);
		} else if (bug.kind === 'caterpillar') {
			addMesh(group, sphere, cached('cat1', 0x65a30d), -0.08, 0, 0, 0.1, 0.08, 0.08);
			addMesh(group, sphere, cached('cat2', 0x4d7c0f), 0, 0, 0, 0.1, 0.08, 0.08);
			addMesh(group, sphere, cached('cat3', 0x65a30d), 0.08, 0, 0, 0.1, 0.08, 0.08);
		} else {
			addMesh(group, sphere, cached('aph', 0x86efac), 0, 0, 0, 0.08, 0.06, 0.08);
			addMesh(group, sphere, cached('aph2', 0x4ade80), 0.05, 0, 0, 0.06, 0.05, 0.06);
		}
		bugsRoot.add(group);
		return group;
	}

	function placeBug(group: ReturnType<typeof THREE.Group>, bug: Bug) {
		const pot = potPos(bug.bedId);
		const windowFrom = { x: 0, y: 2.35, z: -2.35 };
		const rest = { x: pot.x + 0.18, y: 1.05, z: pot.z };
		const t =
			bug.phase === 'arrive'
				? Math.min(1, bug.age / 8)
				: bug.phase === 'leave'
					? Math.max(0, 1 - bug.age / 8)
					: 1;
		const src = bug.phase === 'leave' ? rest : windowFrom;
		const dst = bug.phase === 'leave' ? windowFrom : rest;
		group.position.set(
			src.x + (dst.x - src.x) * t,
			src.y + (dst.y - src.y) * t,
			src.z + (dst.z - src.z) * t
		);
		group.userData.phase = bug.phase;
		group.userData.kind = bug.kind;
		group.userData.age = bug.age;
	}

	buildRoom();
	for (let i = 0; i < 12; i++) makePot(i);
	applyPalette();
	const observer = new MutationObserver(applyPalette);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
	const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	reduceMotion = Boolean(motion?.matches);
	const onMotion = () => {
		reduceMotion = Boolean(motion?.matches);
	};
	motion?.addEventListener?.('change', onMotion);

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();

	function resize() {
		const parent = canvas.parentElement ?? canvas;
		const w = Math.max(1, parent.clientWidth);
		const h = Math.max(1, parent.clientHeight);
		camera.aspect = w / h;
		placeCamera(w / h);
		const maxRatio = h < 700 ? 1.35 : 1.75;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
		renderer.setSize(w, h, false);
	}

	function sync(garden: GardenState, selected: number) {
		for (const bed of garden.beds) {
			const key = `${bed.plantId}:${bed.stage}:${bed.health}:${bed.potSize}:${bed.shade}`;
			if (plantKey[bed.id] !== key) {
				plantKey[bed.id] = key;
				const plant = plantGroups[bed.id];
				if (plant) fillPlant(plant, bed);
				const pot = potGroups[bed.id];
				if (pot) pot.scale.setScalar(bed.potSize >= 2 ? 1.14 : 1);
				const cloth = shadeCloths[bed.id];
				if (cloth) cloth.visible = bed.shade;
			}
			const nkey = `${bed.water}:${bed.nutrient}:${bed.health}:${bed.stage}`;
			if (needKey[bed.id] !== nkey) {
				needKey[bed.id] = nkey;
				const needs = needGroups[bed.id];
				if (needs) fillNeeds(needs, bed);
			}
			const ring = rings[bed.id];
			if (ring) ring.visible = selected === bed.id;
		}
		const seen = new Set<number>();
		for (const bug of garden.bugs) {
			seen.add(bug.id);
			let group = bugMap.get(bug.id);
			if (!group) {
				group = bugMesh(bug);
				bugMap.set(bug.id, group);
			}
			placeBug(group, bug);
		}
		for (const [id, group] of bugMap) {
			if (seen.has(id)) continue;
			bugsRoot.remove(group);
			bugMap.delete(id);
		}
	}

	function pick(clientX: number, clientY: number): number | null {
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		const hits = raycaster.intersectObjects(pickables, false);
		const id = hits[0]?.object.userData.bedId;
		return typeof id === 'number' ? id : null;
	}

	function render(now: number) {
		windowLight.intensity = 0.78 + Math.sin(now * 0.0012) * 0.1;
		if (!reduceMotion) {
			for (const [id, group] of bugMap) {
				group.position.y += Math.sin(now * 0.01 + id) * 0.006;
				group.rotation.y = Math.sin(now * 0.006 + id) * 0.35;
				const wingL = group.getObjectByName('wingL');
				const wingR = group.getObjectByName('wingR');
				const flap = Math.sin(now * 0.024 + id) * 0.55;
				if (wingL) wingL.rotation.z = flap;
				if (wingR) wingR.rotation.z = -flap;
				const wing = group.getObjectByName('wing');
				if (wing) wing.rotation.z = flap * 0.4;
			}
			for (const plant of plantGroups) {
				if (plant && plant.children.length) plant.rotation.y = Math.sin(now * 0.0006) * 0.05;
			}
		}
		renderer.render(scene, camera);
	}

	function dispose() {
		observer.disconnect();
		motion?.removeEventListener?.('change', onMotion);
		renderer.dispose();
		box.dispose();
		sphere.dispose();
		cyl.dispose();
		cone.dispose();
		potBody.dispose();
		for (const material of materials) material.dispose();
	}

	resize();
	return { sync, render, resize, dispose, pick };
}
