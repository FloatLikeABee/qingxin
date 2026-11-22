import * as THREE from 'three';
import {
	bowlWorld,
	FOOD_KINDS,
	kitchenSteaming,
	pieceColor,
	pieceFlatten,
	plateWorld,
	type FoodKind,
	type KitchenWorld
} from './sim';

export type KitchenHit =
	| { zone: 'bowl'; kind: FoodKind }
	| { zone: 'pan'; x: number; z: number }
	| { zone: 'piece'; id: string; x: number; z: number }
	| { zone: 'plate'; slot: number };

export interface KitchenScene {
	sync(world: KitchenWorld, opts?: { reducedMotion?: boolean }): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	hit(clientX: number, clientY: number): KitchenHit | null;
	projectBowl(kind: FoodKind): { x: number; y: number } | null;
	projectPan(): { x: number; y: number } | null;
	projectPlate(slot: number): { x: number; y: number } | null;
	projectPiece(id: string): { x: number; y: number } | null;
}

type Geo = InstanceType<typeof THREE.BufferGeometry>;
type Renderer = InstanceType<typeof THREE.WebGLRenderer>;
type Obj = InstanceType<typeof THREE.Object3D>;
type Mesh = InstanceType<typeof THREE.Mesh>;

function mat(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.62,
		metalness: 0.08,
		...extras
	});
}

export function mountKitchenScene(canvas: HTMLCanvasElement): KitchenScene | null {
	let renderer: Renderer;
	try {
		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
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
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.08;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor(0xf3e4c8, 1);

	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0xf3e4c8, 9, 16);
	const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 40);
	camera.position.set(0, 5.15, 4.35);
	camera.lookAt(0, 0.15, 0.1);

	const geos: Geo[] = [];
	const mats: Array<{ dispose: () => void }> = [];
	const keepGeo = <T extends Geo>(g: T) => {
		geos.push(g);
		return g;
	};
	const keepMat = <T extends { dispose: () => void }>(m: T) => {
		mats.push(m);
		return m;
	};

	const box = keepGeo(new THREE.BoxGeometry(1, 1, 1));
	const sphere = keepGeo(new THREE.SphereGeometry(1, 22, 16));
	const sphereLo = keepGeo(new THREE.SphereGeometry(1, 10, 8));
	const cyl = keepGeo(new THREE.CylinderGeometry(1, 1, 1, 20));
	const cone = keepGeo(new THREE.ConeGeometry(1, 1, 10));
	const torus = keepGeo(new THREE.TorusGeometry(1, 0.12, 10, 28));

	const wood = keepMat(mat(0x8b5a32, { roughness: 0.82 }));
	const woodDark = keepMat(mat(0x5a341c, { roughness: 0.88 }));
	const tile = keepMat(mat(0xe8d9c0, { roughness: 0.9 }));
	const wall = keepMat(mat(0xf7ead2, { roughness: 0.92 }));
	const iron = keepMat(mat(0x2b2b2e, { metalness: 0.55, roughness: 0.38 }));
	const copper = keepMat(mat(0xb87333, { metalness: 0.62, roughness: 0.32 }));
	const ceramic = keepMat(mat(0xf4f1ea, { roughness: 0.45 }));
	const flameMat = keepMat(
		new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.85 })
	);
	const steamMat = keepMat(
		new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 })
	);
	const bowlMats = FOOD_KINDS.map((kind) => keepMat(mat(pieceColor(kind, 0))));
	const panMats = Array.from({ length: 12 }, () => keepMat(mat(0xffffff)));
	const plateMats = Array.from({ length: 8 }, () => keepMat(mat(0xffffff)));

	const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
	sun.position.set(-2.4, 6.2, 3.2);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.near = 0.5;
	sun.shadow.camera.far = 18;
	sun.shadow.camera.left = -6;
	sun.shadow.camera.right = 6;
	sun.shadow.camera.top = 6;
	sun.shadow.camera.bottom = -6;
	scene.add(sun);
	scene.add(new THREE.HemisphereLight(0xfff6e8, 0x7a5a3a, 0.72));
	scene.add(new THREE.AmbientLight(0xffe8c8, 0.28));

	const floor = new THREE.Mesh(box, tile);
	floor.scale.set(12, 0.08, 10);
	floor.position.set(0, -0.84, 0.2);
	floor.receiveShadow = true;
	scene.add(floor);

	const back = new THREE.Mesh(box, wall);
	back.scale.set(10, 4.2, 0.18);
	back.position.set(0, 1.2, -2.55);
	scene.add(back);

	const counter = new THREE.Mesh(box, wood);
	counter.scale.set(7.2, 0.18, 4.1);
	counter.position.set(0, 0, 0.05);
	counter.receiveShadow = true;
	counter.castShadow = true;
	scene.add(counter);

	const apron = new THREE.Mesh(box, woodDark);
	apron.scale.set(7.2, 0.85, 0.18);
	apron.position.set(0, -0.5, 2.05);
	scene.add(apron);

	const bowls: Mesh[] = [];
	const bowlFood: Mesh[] = [];
	FOOD_KINDS.forEach((kind, i) => {
		const pos = bowlWorld(kind);
		const bowl = new THREE.Mesh(cyl, ceramic);
		bowl.scale.set(0.34, 0.14, 0.34);
		bowl.position.set(pos.x, 0.16, pos.z);
		bowl.castShadow = true;
		bowl.userData = { zone: 'bowl', kind };
		scene.add(bowl);
		bowls.push(bowl);
		const food = new THREE.Mesh(sphere, bowlMats[i]);
		food.scale.set(0.22, 0.1, 0.22);
		food.position.set(pos.x, 0.26, pos.z);
		food.userData = { zone: 'bowl', kind };
		scene.add(food);
		bowlFood.push(food);
	});

	const panGroup = new THREE.Group();
	panGroup.position.set(0, 0.16, 0.08);
	const wok = new THREE.Mesh(sphere, iron);
	wok.scale.set(0.92, 0.22, 0.92);
	wok.position.y = 0.02;
	wok.castShadow = true;
	wok.userData = { zone: 'pan' };
	const rim = new THREE.Mesh(torus, copper);
	rim.scale.set(0.78, 0.78, 0.78);
	rim.rotation.x = Math.PI / 2;
	rim.position.y = 0.16;
	rim.userData = { zone: 'pan' };
	const handle = new THREE.Mesh(cyl, woodDark);
	handle.scale.set(0.05, 0.55, 0.05);
	handle.rotation.z = Math.PI / 2;
	handle.position.set(1.05, 0.12, 0);
	const panHit = new THREE.Mesh(cyl, keepMat(mat(0x222, { transparent: true, opacity: 0 })));
	panHit.scale.set(0.82, 0.08, 0.82);
	panHit.position.y = 0.12;
	panHit.userData = { zone: 'pan' };
	panGroup.add(wok, rim, handle, panHit);
	scene.add(panGroup);

	const flameGroup = new THREE.Group();
	flameGroup.position.set(0, 0.02, 0.08);
	for (let i = 0; i < 5; i++) {
		const f = new THREE.Mesh(cone, flameMat);
		f.scale.set(0.12 + i * 0.02, 0.22 + (i % 2) * 0.08, 0.12 + i * 0.02);
		f.position.set((i - 2) * 0.1, 0.1, (i % 2) * 0.06);
		flameGroup.add(f);
	}
	scene.add(flameGroup);

	const steamGroup = new THREE.Group();
	const steams: Mesh[] = [];
	for (let i = 0; i < 10; i++) {
		const puff = new THREE.Mesh(sphereLo, steamMat);
		puff.scale.setScalar(0.08);
		steamGroup.add(puff);
		steams.push(puff);
	}
	scene.add(steamGroup);

	const plates: Mesh[] = [];
	const platedFood: Mesh[] = [];
	for (let i = 0; i < 8; i++) {
		const pos = plateWorld(i);
		const plate = new THREE.Mesh(cyl, ceramic);
		plate.scale.set(0.28, 0.04, 0.28);
		plate.position.set(pos.x, 0.12, pos.z);
		plate.castShadow = true;
		plate.userData = { zone: 'plate', slot: i };
		scene.add(plate);
		plates.push(plate);
		const food = new THREE.Mesh(sphere, plateMats[i]);
		food.scale.set(0.16, 0.07, 0.16);
		food.position.set(pos.x, 0.2, pos.z);
		food.visible = false;
		food.userData = { zone: 'plate', slot: i };
		scene.add(food);
		platedFood.push(food);
	}

	const pieces: Mesh[] = [];
	for (let i = 0; i < 12; i++) {
		const mesh = new THREE.Mesh(sphere, panMats[i]);
		mesh.visible = false;
		mesh.castShadow = true;
		panGroup.add(mesh);
		pieces.push(mesh);
	}

	const ray = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	const hitList: Obj[] = [
		...bowls,
		...bowlFood,
		panHit,
		wok,
		rim,
		...pieces,
		...plates,
		...platedFood
	];

	function project(obj: Obj): { x: number; y: number } | null {
		if (!obj.visible) return null;
		const v = obj.getWorldPosition(new THREE.Vector3());
		v.project(camera);
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
	}

	function applyDpr(world: KitchenWorld) {
		const narrow = (canvas.clientWidth || window.innerWidth) < 500;
		const dpr = world.lowDetail || narrow ? 1 : Math.min(2, window.devicePixelRatio || 1);
		renderer.setPixelRatio(dpr);
		renderer.shadowMap.enabled = !world.lowDetail;
		sun.castShadow = !world.lowDetail;
	}

	function resize() {
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}

	let reduced = false;

	return {
		sync(world, opts) {
			reduced = opts?.reducedMotion === true;
			applyDpr(world);
			flameGroup.visible = world.heat !== 'off';
			flameGroup.scale.setScalar(world.heat === 'high' ? 1.25 : 0.85);
			const steaming = kitchenSteaming(world) && !reduced;
			steamGroup.visible = steaming;
			world.pan.forEach((piece, i) => {
				const mesh = pieces[i];
				if (!mesh) return;
				mesh.visible = true;
				mesh.position.set(piece.x, 0.18, piece.z);
				const flat = pieceFlatten(piece.doneness);
				const color = pieceColor(piece.kind, piece.doneness);
				const m = panMats[i]!;
				mesh.material = m;
				(m as InstanceType<typeof THREE.MeshStandardMaterial>).color.setHex(color);
				if (piece.kind === 'veg' || piece.kind === 'dough') mesh.scale.set(0.14, 0.07 * flat, 0.14);
				else if (piece.kind === 'tofu' || piece.kind === 'meat')
					mesh.scale.set(0.12, 0.08 * flat, 0.16);
				else mesh.scale.set(0.11, 0.11 * flat, 0.11);
				mesh.userData = { zone: 'piece', id: piece.id };
			});
			for (let i = world.pan.length; i < pieces.length; i++) pieces[i]!.visible = false;
			platedFood.forEach((mesh) => {
				mesh.visible = false;
			});
			for (const dish of world.plated) {
				const mesh = platedFood[dish.slot];
				if (!mesh) continue;
				mesh.visible = true;
				const kind = dish.kinds[dish.kinds.length - 1] ?? 'veg';
				const m = plateMats[dish.slot]!;
				mesh.material = m;
				(m as InstanceType<typeof THREE.MeshStandardMaterial>).color.setHex(
					pieceColor(kind, dish.doneness)
				);
			}
			bowlFood.forEach((mesh) => {
				mesh.visible = true;
			});
		},
		render(now) {
			if (flameGroup.visible) {
				flameGroup.children.forEach((child: Obj, i: number) => {
					child.scale.y = 0.22 + Math.sin(now / 90 + i) * 0.06;
				});
			}
			if (steamGroup.visible) {
				steams.forEach((puff, i) => {
					const t = (now / 700 + i * 0.13) % 1;
					puff.position.set(((i % 5) - 2) * 0.12, 0.45 + t * 0.7, 0.08 + (i % 3) * 0.05);
					puff.scale.setScalar(0.06 + t * 0.1);
					(steamMat as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = 0.32 * (1 - t);
				});
			}
			renderer.render(scene, camera);
		},
		resize,
		dispose() {
			cancelAnimationFrame(0);
			renderer.dispose();
			geos.forEach((g) => g.dispose());
			mats.forEach((m) => m.dispose());
		},
		hit(clientX, clientY) {
			const rect = canvas.getBoundingClientRect();
			ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
			ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
			ray.setFromCamera(ndc, camera);
			const hits = ray.intersectObjects(hitList, false);
			for (const hit of hits) {
				let node: Obj | null = hit.object;
				while (node) {
					const data = node.userData as {
						zone?: string;
						kind?: FoodKind;
						id?: string;
						slot?: number;
					};
					if (data.zone === 'bowl' && data.kind) return { zone: 'bowl', kind: data.kind };
					if (data.zone === 'plate' && data.slot != null) return { zone: 'plate', slot: data.slot };
					if (data.zone === 'piece' && data.id) {
						const local = panGroup.worldToLocal(hit.point.clone());
						return { zone: 'piece', id: data.id, x: local.x, z: local.z };
					}
					if (data.zone === 'pan') {
						const local = panGroup.worldToLocal(hit.point.clone());
						return { zone: 'pan', x: local.x, z: local.z };
					}
					node = node.parent;
				}
			}
			return null;
		},
		projectBowl(kind) {
			const i = FOOD_KINDS.indexOf(kind);
			return i < 0 ? null : project(bowls[i]!);
		},
		projectPan() {
			return project(panHit);
		},
		projectPlate(slot) {
			return plates[slot] ? project(plates[slot]!) : null;
		},
		projectPiece(id) {
			const mesh = pieces.find((item) => item.visible && item.userData.id === id);
			return mesh ? project(mesh) : null;
		}
	};
}
