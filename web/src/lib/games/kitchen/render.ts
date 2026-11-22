import * as THREE from 'three';
import {
	bowlWorld,
	FOOD_KINDS,
	isCompactKitchen,
	kitchenSteaming,
	pickKitchenHit,
	pieceColor,
	pieceFlatten,
	plateWorld,
	yolkColor,
	type FoodKind,
	type KitchenHitMode,
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
	hit(clientX: number, clientY: number, mode?: KitchenHitMode): KitchenHit | null;
	projectBowl(kind: FoodKind): { x: number; y: number } | null;
	projectPan(): { x: number; y: number } | null;
	projectPlate(slot: number): { x: number; y: number } | null;
	projectPiece(id: string): { x: number; y: number } | null;
}

type Geo = InstanceType<typeof THREE.BufferGeometry>;
type Renderer = InstanceType<typeof THREE.WebGLRenderer>;
type Obj = InstanceType<typeof THREE.Object3D>;
type Mesh = InstanceType<typeof THREE.Mesh>;
type Group = InstanceType<typeof THREE.Group>;
type StdMat = InstanceType<typeof THREE.MeshStandardMaterial>;

function mat(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.62,
		metalness: 0.08,
		...extras
	});
}

function shown(obj: Obj) {
	let node: Obj | null = obj;
	while (node) {
		if (!node.visible) return false;
		node = node.parent;
	}
	return true;
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
	const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 40);
	camera.position.set(0, 5.5, 4);
	camera.lookAt(0, 0.1, 0.05);

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
	const ico = keepGeo(new THREE.IcosahedronGeometry(1, 0));

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
	const ghost = keepMat(mat(0x222, { transparent: true, opacity: 0 }));

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

	const hitList: Obj[] = [];

	function forgetHits(group: Group) {
		group.traverse((node: Obj) => {
			const at = hitList.indexOf(node);
			if (at >= 0) hitList.splice(at, 1);
		});
	}

	function paintFood(
		group: Group,
		kind: FoodKind,
		body: StdMat,
		yolk: StdMat | null,
		zone: object
	) {
		forgetHits(group);
		group.clear();
		const add = (mesh: Mesh, part?: string) => {
			mesh.castShadow = true;
			mesh.userData = { ...zone, part };
			group.add(mesh);
			hitList.push(mesh);
		};
		if (kind === 'veg') {
			for (let i = 0; i < 3; i++) {
				const leaf = new THREE.Mesh(sphere, body);
				leaf.scale.set(0.15, 0.03, 0.08);
				leaf.rotation.set(0.15, i * 0.85 - 0.7, 0.35);
				leaf.position.set((i - 1) * 0.05, 0.02, (i % 2) * 0.04 - 0.02);
				add(leaf);
			}
		} else if (kind === 'meat') {
			const a = new THREE.Mesh(box, body);
			a.scale.set(0.2, 0.045, 0.13);
			a.rotation.y = 0.35;
			add(a);
			const b = new THREE.Mesh(box, body);
			b.scale.set(0.18, 0.04, 0.11);
			b.position.set(0.04, 0.045, -0.02);
			b.rotation.y = -0.25;
			add(b);
		} else if (kind === 'egg') {
			const white = new THREE.Mesh(sphere, body);
			white.scale.set(0.13, 0.07, 0.15);
			add(white);
			const yolkMesh = new THREE.Mesh(sphere, yolk ?? body);
			yolkMesh.scale.set(0.055, 0.035, 0.055);
			yolkMesh.position.y = 0.055;
			add(yolkMesh, 'yolk');
		} else if (kind === 'dough') {
			const lump = new THREE.Mesh(ico, body);
			lump.scale.set(0.13, 0.08, 0.13);
			add(lump);
		} else if (kind === 'tofu') {
			const cube = new THREE.Mesh(box, body);
			cube.scale.set(0.15, 0.13, 0.15);
			add(cube);
		} else {
			for (let i = 0; i < 5; i++) {
				const a = -0.15 + i * 0.52;
				const seg = new THREE.Mesh(sphere, body);
				const r = 0.05 - i * 0.005;
				seg.scale.set(r, r * 0.72, r * 1.15);
				seg.position.set(Math.cos(a) * 0.14, 0.03, Math.sin(a) * 0.14);
				add(seg);
			}
			const tail = new THREE.Mesh(cone, body);
			tail.scale.set(0.03, 0.09, 0.03);
			tail.rotation.z = 1.2;
			tail.position.set(-0.14, 0.03, 0.09);
			add(tail);
		}
		const pad = new THREE.Mesh(sphere, ghost);
		pad.scale.set(0.2, 0.12, 0.2);
		pad.position.y = 0.05;
		add(pad, 'hit');
		group.userData = zone;
	}

	function tint(group: Group, kind: FoodKind, doneness: number, body: StdMat, yolk: StdMat | null) {
		body.color.setHex(pieceColor(kind, doneness));
		if (yolk) yolk.color.setHex(yolkColor(doneness));
		group.scale.set(1, pieceFlatten(doneness), 1);
	}

	const bowls: Mesh[] = [];
	const bowlFood: Group[] = [];
	const bowlHits: Mesh[] = [];
	FOOD_KINDS.forEach((kind) => {
		const pos = bowlWorld(kind);
		const bowl = new THREE.Mesh(cyl, ceramic);
		bowl.scale.set(0.34, 0.12, 0.34);
		bowl.position.set(pos.x, 0.16, pos.z);
		bowl.castShadow = true;
		bowl.userData = { zone: 'bowl', kind };
		scene.add(bowl);
		bowls.push(bowl);
		hitList.push(bowl);
		const body = keepMat(mat(pieceColor(kind, 0)));
		const yolk = kind === 'egg' ? keepMat(mat(yolkColor(0))) : null;
		const food = new THREE.Group();
		paintFood(food, kind, body, yolk, { zone: 'bowl', kind });
		food.position.set(pos.x, 0.26, pos.z);
		scene.add(food);
		bowlFood.push(food);
		const bowlHit = new THREE.Mesh(cyl, keepMat(mat(0x222, { transparent: true, opacity: 0 })));
		bowlHit.scale.set(0.46, 0.2, 0.46);
		bowlHit.position.set(pos.x, 0.2, pos.z);
		bowlHit.userData = { zone: 'bowl', kind };
		scene.add(bowlHit);
		bowlHits.push(bowlHit);
		hitList.push(bowlHit);
	});

	const panGroup = new THREE.Group();
	panGroup.position.set(0, 0.16, 0.08);
	const wok = new THREE.Mesh(cyl, iron);
	wok.scale.set(0.72, 0.08, 0.72);
	wok.position.y = 0.04;
	wok.castShadow = true;
	wok.userData = { zone: 'pan' };
	const rim = new THREE.Mesh(torus, copper);
	rim.scale.set(0.66, 0.66, 0.66);
	rim.rotation.x = Math.PI / 2;
	rim.position.y = 0.1;
	rim.userData = { zone: 'pan' };
	const handle = new THREE.Mesh(cyl, woodDark);
	handle.scale.set(0.05, 0.5, 0.05);
	handle.rotation.z = Math.PI / 2;
	handle.position.set(0.95, 0.1, 0);
	const panHit = new THREE.Mesh(cyl, keepMat(mat(0x222, { transparent: true, opacity: 0 })));
	panHit.scale.set(0.82, 0.16, 0.82);
	panHit.position.y = 0.16;
	panHit.userData = { zone: 'pan' };
	panGroup.add(wok, rim, handle, panHit);
	scene.add(panGroup);
	hitList.push(wok, rim, panHit);

	const flameGroup = new THREE.Group();
	flameGroup.position.set(0, 0.1, 0.08);
	for (let i = 0; i < 8; i++) {
		const f = new THREE.Mesh(cone, flameMat);
		const a = (i / 8) * Math.PI * 2;
		f.scale.set(0.08, 0.2, 0.08);
		f.position.set(Math.cos(a) * 0.5, 0.02, Math.sin(a) * 0.5);
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
	const plateHits: Mesh[] = [];
	const platedFood: Group[] = [];
	const plateBody: StdMat[] = [];
	const plateYolk: Array<StdMat | null> = [];
	const platedKind: Array<FoodKind | null> = [];
	for (let i = 0; i < 8; i++) {
		const pos = plateWorld(i);
		const plate = new THREE.Mesh(cyl, ceramic);
		plate.scale.set(0.24, 0.04, 0.24);
		plate.position.set(pos.x, 0.12, pos.z);
		plate.castShadow = true;
		plate.userData = { zone: 'plate', slot: i };
		scene.add(plate);
		plates.push(plate);
		hitList.push(plate);
		const plateHit = new THREE.Mesh(cyl, keepMat(mat(0x222, { transparent: true, opacity: 0 })));
		plateHit.scale.set(0.34, 0.22, 0.34);
		plateHit.position.set(pos.x, 0.22, pos.z);
		plateHit.userData = { zone: 'plate', slot: i };
		scene.add(plateHit);
		plateHits.push(plateHit);
		hitList.push(plateHit);
		const body = keepMat(mat(0xffffff));
		const yolk = keepMat(mat(yolkColor(0)));
		plateBody.push(body);
		plateYolk.push(yolk);
		const food = new THREE.Group();
		food.visible = false;
		food.position.set(pos.x, 0.2, pos.z);
		scene.add(food);
		platedFood.push(food);
		platedKind.push(null);
	}

	const pieces: Group[] = [];
	const pieceBody: StdMat[] = [];
	const pieceYolk: Array<StdMat | null> = [];
	const pieceKind: Array<FoodKind | null> = [];
	for (let i = 0; i < 12; i++) {
		const body = keepMat(mat(0xffffff));
		const yolk = keepMat(mat(yolkColor(0)));
		pieceBody.push(body);
		pieceYolk.push(yolk);
		pieceKind.push(null);
		const group = new THREE.Group();
		group.visible = false;
		panGroup.add(group);
		pieces.push(group);
	}

	const ray = new THREE.Raycaster();
	const ndc = new THREE.Vector2();

	function compactNow() {
		return isCompactKitchen(canvas.clientWidth || window.innerWidth);
	}

	function applyLayout() {
		const compact = compactNow();
		panGroup.scale.setScalar(compact ? 0.88 : 1);
		const bowlScale = compact ? 0.26 : 0.34;
		FOOD_KINDS.forEach((kind, i) => {
			const pos = bowlWorld(kind, compact);
			bowls[i]!.scale.set(bowlScale, compact ? 0.1 : 0.12, bowlScale);
			bowls[i]!.position.set(pos.x, 0.16, pos.z);
			bowlFood[i]!.position.set(pos.x, 0.24, pos.z);
			bowlHits[i]!.scale.set(compact ? 0.38 : 0.46, 0.2, compact ? 0.38 : 0.46);
			bowlHits[i]!.position.set(pos.x, 0.2, pos.z);
		});
		const plateScale = compact ? 0.22 : 0.24;
		const hitScale = compact ? 0.32 : 0.34;
		for (let i = 0; i < 8; i++) {
			const pos = plateWorld(i, compact);
			plates[i]!.scale.set(plateScale, 0.04, plateScale);
			plates[i]!.position.set(pos.x, 0.12, pos.z);
			plateHits[i]!.scale.set(hitScale, 0.22, hitScale);
			plateHits[i]!.position.set(pos.x, 0.22, pos.z);
			platedFood[i]!.position.set(pos.x, 0.2, pos.z);
		}
	}

	function project(obj: Obj): { x: number; y: number } | null {
		if (!shown(obj)) return null;
		const v = obj.getWorldPosition(new THREE.Vector3());
		v.project(camera);
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
	}

	function applyDpr(world: KitchenWorld) {
		const narrow = compactNow();
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
		if (compactNow()) {
			camera.fov = 36;
			camera.position.set(0, 7.2, 2.6);
			camera.lookAt(0, 0.08, 0.05);
		} else {
			camera.fov = 40;
			camera.position.set(0, 5.45, 3.85);
			camera.lookAt(0, 0.1, 0.05);
		}
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
		applyLayout();
	}

	let reduced = false;

	return {
		sync(world, opts) {
			reduced = opts?.reducedMotion === true;
			applyDpr(world);
			applyLayout();
			flameGroup.visible = world.heat !== 'off';
			flameGroup.scale.setScalar(world.heat === 'high' ? 1.25 : 0.85);
			steamGroup.visible = kitchenSteaming(world) && !reduced;
			world.pan.forEach((piece, i) => {
				const group = pieces[i];
				const body = pieceBody[i]!;
				if (!group) return;
				group.visible = true;
				group.position.set(piece.x, 0.2, piece.z);
				if (pieceKind[i] !== piece.kind) {
					const yolk = piece.kind === 'egg' ? pieceYolk[i]! : null;
					paintFood(group, piece.kind, body, yolk, { zone: 'piece', id: piece.id });
					pieceKind[i] = piece.kind;
				} else {
					group.traverse((node: Obj) => {
						node.userData = { ...node.userData, zone: 'piece', id: piece.id };
					});
				}
				tint(group, piece.kind, piece.doneness, body, piece.kind === 'egg' ? pieceYolk[i]! : null);
				group.userData = { zone: 'piece', id: piece.id };
			});
			for (let i = world.pan.length; i < pieces.length; i++) {
				pieces[i]!.visible = false;
				pieceKind[i] = null;
			}
			const used = new Set(world.plated.map((dish) => dish.slot));
			platedFood.forEach((group, slot) => {
				if (!used.has(slot)) {
					group.visible = false;
					platedKind[slot] = null;
				}
			});
			for (const dish of world.plated) {
				const group = platedFood[dish.slot];
				const body = plateBody[dish.slot];
				if (!group || !body) continue;
				const kind = dish.kinds[dish.kinds.length - 1] ?? 'veg';
				const yolk = kind === 'egg' ? plateYolk[dish.slot]! : null;
				if (platedKind[dish.slot] !== kind) {
					paintFood(group, kind, body, yolk, { zone: 'plate', slot: dish.slot });
					platedKind[dish.slot] = kind;
				}
				tint(group, kind, dish.doneness, body, yolk);
				group.visible = true;
			}
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
			renderer.dispose();
			geos.forEach((g) => g.dispose());
			mats.forEach((m) => m.dispose());
		},
		hit(clientX, clientY, mode = 'pick') {
			const rect = canvas.getBoundingClientRect();
			ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
			ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
			ray.setFromCamera(ndc, camera);
			const hits = ray.intersectObjects(hitList, false);
			const ranked: KitchenHit[] = [];
			for (const hit of hits) {
				if (!shown(hit.object)) continue;
				let node: Obj | null = hit.object;
				while (node) {
					const data = node.userData as {
						zone?: string;
						kind?: FoodKind;
						id?: string;
						slot?: number;
					};
					if (data.zone === 'piece' && data.id) {
						const local = panGroup.worldToLocal(hit.point.clone());
						ranked.push({ zone: 'piece', id: data.id, x: local.x, z: local.z });
						break;
					}
					if (data.zone === 'bowl' && data.kind) {
						ranked.push({ zone: 'bowl', kind: data.kind });
						break;
					}
					if (data.zone === 'plate' && data.slot != null) {
						ranked.push({ zone: 'plate', slot: data.slot });
						break;
					}
					if (data.zone === 'pan') {
						const local = panGroup.worldToLocal(hit.point.clone());
						ranked.push({ zone: 'pan', x: local.x, z: local.z });
						break;
					}
					node = node.parent;
				}
			}
			return pickKitchenHit(ranked, mode);
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
			const group = pieces.find((item) => item.visible && item.userData.id === id);
			if (group) return project(group);
			const mesh = pieces.find((item) => {
				let found = false;
				item.traverse((node: Obj) => {
					if (node.userData.id === id) found = true;
				});
				return item.visible && found;
			});
			return mesh ? project(mesh) : null;
		}
	};
}
