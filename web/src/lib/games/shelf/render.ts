import * as THREE from 'three';
import {
	ROWS,
	SLOTS,
	findItem,
	hauntProgress,
	isHaunting,
	slotWorld,
	type ShelfItem,
	type ShelfWorld
} from './sim';

export interface ShelfScene {
	sync(world: ShelfWorld, opts?: { reducedMotion?: boolean }): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	hit(
		clientX: number,
		clientY: number,
		ignoreId?: string | null
	): { id?: string; row?: number; slot?: number } | null;
	project(id: string): { x: number; y: number } | null;
	projectGhost(): { x: number; y: number } | null;
}

type G = InstanceType<typeof THREE.Group>;
type M = InstanceType<typeof THREE.Mesh>;
type Geo = InstanceType<typeof THREE.BufferGeometry>;
type Renderer = InstanceType<typeof THREE.WebGLRenderer>;

function mat(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.58,
		metalness: 0.08,
		...extras
	});
}

function canvasTex(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d');
	if (ctx) paint(ctx);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	tex.needsUpdate = true;
	return tex;
}

function shown(obj: InstanceType<typeof THREE.Object3D>) {
	let node: InstanceType<typeof THREE.Object3D> | null = obj;
	while (node) {
		if (!node.visible) return false;
		node = node.parent;
	}
	return true;
}

function inLod(item: ShelfItem, lowDetail: boolean) {
	if (!lowDetail) return true;
	return item.row > 0 && item.slot > 0 && item.slot < SLOTS - 1;
}

export function mountShelfScene(canvas: HTMLCanvasElement): ShelfScene | null {
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
	renderer.toneMappingExposure = 1.12;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor(0x1c120c, 1);

	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x24160f, 0.032);
	const camera = new THREE.PerspectiveCamera(44, 1, 0.08, 40);
	camera.position.set(0.12, 1.52, 3.35);
	camera.lookAt(0, 1.38, -1.7);

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
	const sphere = keepGeo(new THREE.SphereGeometry(1, 24, 18));
	const sphereLo = keepGeo(new THREE.SphereGeometry(1, 12, 8));
	const cyl = keepGeo(new THREE.CylinderGeometry(1, 1, 1, 16));
	const cone = keepGeo(new THREE.ConeGeometry(1, 1, 12));
	const ico = keepGeo(new THREE.IcosahedronGeometry(1, 1));
	const torus = keepGeo(new THREE.TorusGeometry(1, 0.22, 10, 20));

	const paper = keepMat(
		new THREE.MeshStandardMaterial({
			map: canvasTex(256, 256, (ctx) => {
				ctx.fillStyle = '#e4d0ae';
				ctx.fillRect(0, 0, 256, 256);
				for (let i = 0; i < 12; i++) {
					ctx.fillStyle = i % 2 ? '#d7c094' : '#efe0c4';
					ctx.fillRect(i * 22, 0, 10, 256);
				}
			}),
			roughness: 0.9
		})
	);
	const floorMap = keepMat(
		new THREE.MeshStandardMaterial({
			map: canvasTex(512, 512, (ctx) => {
				ctx.fillStyle = '#5a341c';
				ctx.fillRect(0, 0, 512, 512);
				for (let i = 0; i < 10; i++) {
					ctx.fillStyle = i % 2 ? '#6b3f22' : '#4c2c16';
					ctx.fillRect(i * 52, 0, 48, 512);
					ctx.fillStyle = '#3a2112';
					ctx.fillRect(i * 52 + 48, 0, 4, 512);
				}
			}),
			roughness: 0.88
		})
	);
	const wood = keepMat(mat(0x6d4124, { roughness: 0.72 }));
	const woodDark = keepMat(mat(0x3a2316, { roughness: 0.84 }));
	const brass = keepMat(mat(0xc9a227, { metalness: 0.72, roughness: 0.28 }));
	const cloth = keepMat(mat(0x7a1f2b, { roughness: 0.86 }));

	const hemi = new THREE.HemisphereLight(0xffe2c4, 0x3a2418, 0.7);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xffd7a8, 1.32);
	sun.position.set(-3.8, 4.6, 3.2);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.near = 1;
	sun.shadow.camera.far = 18;
	sun.shadow.camera.left = -6;
	sun.shadow.camera.right = 6;
	sun.shadow.camera.top = 5;
	sun.shadow.camera.bottom = -3;
	scene.add(sun);
	const lamp = new THREE.PointLight(0xffb066, 18, 11, 1.65);
	lamp.position.set(-1.85, 2.05, 0.55);
	scene.add(lamp);
	const ghostLight = new THREE.PointLight(0xc4b5fd, 0, 3.2, 2);
	scene.add(ghostLight);

	function mesh(geo: Geo, material: InstanceType<typeof THREE.Material>) {
		const m = new THREE.Mesh(geo, material);
		m.castShadow = true;
		m.receiveShadow = true;
		return m;
	}

	const floor = mesh(box, floorMap);
	floor.scale.set(10, 0.1, 7);
	floor.position.set(0, -0.05, 0.4);
	scene.add(floor);
	const rug = mesh(cyl, cloth);
	rug.scale.set(1.55, 0.02, 1.15);
	rug.position.set(0.1, 0.02, 0.55);
	scene.add(rug);
	const back = mesh(box, paper);
	back.scale.set(6.2, 3.5, 0.1);
	back.position.set(0, 1.7, -2.35);
	scene.add(back);
	const left = mesh(box, paper);
	left.scale.set(0.1, 3.5, 5.2);
	left.position.set(-3.05, 1.7, 0.2);
	scene.add(left);

	const windowG = new THREE.Group();
	const winFrame = mesh(box, woodDark);
	winFrame.scale.set(0.12, 1.9, 1.25);
	windowG.add(winFrame);
	const glass = mesh(box, keepMat(mat(0xffd19a, { emissive: 0xffc07a, emissiveIntensity: 0.78 })));
	glass.scale.set(0.04, 1.55, 1.0);
	glass.position.x = 0.06;
	windowG.add(glass);
	windowG.position.set(-2.96, 1.72, -0.15);
	scene.add(windowG);
	const curtain = mesh(box, keepMat(mat(0x7b2d3b, { roughness: 0.7 })));
	curtain.scale.set(0.08, 2.3, 0.45);
	curtain.position.set(-2.88, 1.55, -0.85);
	scene.add(curtain);

	const caseG = new THREE.Group();
	caseG.name = 'case';
	const caseBack = mesh(box, wood);
	caseBack.scale.set(2.92, 2.62, 0.1);
	caseBack.position.set(0, 1.32, -1.96);
	caseG.add(caseBack);
	const caseLeft = mesh(box, wood);
	caseLeft.scale.set(0.12, 2.62, 0.52);
	caseLeft.position.set(-1.46, 1.32, -1.72);
	caseG.add(caseLeft);
	const caseRight = caseLeft.clone();
	caseRight.position.x = 1.46;
	caseG.add(caseRight);
	const crown = mesh(box, woodDark);
	crown.scale.set(3.08, 0.14, 0.58);
	crown.position.set(0, 2.7, -1.7);
	caseG.add(crown);
	const inlay = mesh(box, brass);
	inlay.scale.set(2.4, 0.03, 0.08);
	inlay.position.set(0, 2.7, -1.4);
	caseG.add(inlay);
	const plinth = mesh(box, woodDark);
	plinth.scale.set(3.02, 0.18, 0.56);
	plinth.position.set(0, 0.09, -1.7);
	caseG.add(plinth);
	for (let i = 0; i < ROWS; i++) {
		const board = mesh(box, woodDark);
		board.scale.set(2.82, 0.07, 0.5);
		board.position.set(0, 0.28 + i * 0.58, -1.72);
		caseG.add(board);
		const lip = mesh(box, brass);
		lip.scale.set(2.7, 0.012, 0.03);
		lip.position.set(0, 0.32 + i * 0.58, -1.48);
		caseG.add(lip);
	}
	for (const x of [-1.42, 1.42]) {
		const knob = mesh(sphereLo, brass);
		knob.scale.setScalar(0.048);
		knob.position.set(x, 1.92, -1.44);
		caseG.add(knob);
	}
	scene.add(caseG);

	const extras = new THREE.Group();
	const sideTable = mesh(box, wood);
	sideTable.scale.set(0.55, 0.08, 0.55);
	sideTable.position.set(-1.95, 0.62, 0.35);
	extras.add(sideTable);
	const lampBase = mesh(cyl, brass);
	lampBase.scale.set(0.06, 0.28, 0.06);
	lampBase.position.set(-1.95, 0.82, 0.35);
	extras.add(lampBase);
	const shade = mesh(
		cyl,
		keepMat(mat(0xf3d5a8, { roughness: 0.7, emissive: 0xffc07a, emissiveIntensity: 0.28 }))
	);
	shade.scale.set(0.16, 0.14, 0.16);
	shade.position.set(-1.95, 1.08, 0.35);
	extras.add(shade);
	const stack = mesh(box, keepMat(mat(0x7c2d12)));
	stack.scale.set(0.18, 0.06, 0.24);
	stack.position.set(-1.78, 0.7, 0.5);
	extras.add(stack);
	const clockBody = mesh(box, woodDark);
	clockBody.scale.set(0.22, 0.28, 0.1);
	clockBody.position.set(1.95, 0.86, 0.18);
	extras.add(clockBody);
	const clockFace = mesh(cyl, keepMat(mat(0xf5e6c8)));
	clockFace.scale.set(0.09, 0.03, 0.09);
	clockFace.rotation.x = Math.PI / 2;
	clockFace.position.set(1.95, 0.9, 0.24);
	extras.add(clockFace);
	const vase = mesh(cyl, keepMat(mat(0x365314)));
	vase.scale.set(0.07, 0.16, 0.07);
	vase.position.set(1.78, 0.78, 0.42);
	extras.add(vase);
	scene.add(extras);

	const itemRoot = new THREE.Group();
	scene.add(itemRoot);
	const itemMap = new Map<string, G>();
	const slotPads: M[] = [];
	for (let row = 0; row < ROWS; row++) {
		for (let slot = 0; slot < SLOTS; slot++) {
			const pad = mesh(
				box,
				keepMat(mat(0x000000, { transparent: true, opacity: 0, depthWrite: false }))
			);
			const p = slotWorld(row, slot);
			pad.position.set(p.x, p.y - 0.18, p.z);
			pad.scale.set(0.34, 0.06, 0.36);
			pad.userData.row = row;
			pad.userData.slot = slot;
			pad.castShadow = false;
			slotPads.push(pad);
			scene.add(pad);
		}
	}

	function spineMap(title: string, tone: number) {
		return keepMat(
			new THREE.MeshStandardMaterial({
				map: canvasTex(64, 256, (ctx) => {
					const h = (Math.floor(tone * 11) * 31 + 8) % 360;
					const l = 38 + Math.floor((tone * 9) % 10);
					ctx.fillStyle = `hsl(${h} 58% ${l}%)`;
					ctx.fillRect(0, 0, 64, 256);
					ctx.fillStyle = `hsl(${h} 40% ${Math.max(16, l - 10)}%)`;
					ctx.fillRect(0, 0, 9, 256);
					ctx.fillRect(55, 0, 9, 256);
					ctx.fillStyle = tone > 0.55 ? '#d4a017' : '#e8d5a3';
					ctx.fillRect(12, 16, 40, 7);
					ctx.fillRect(12, 230, 40, 7);
					if (tone > 0.3) {
						ctx.fillRect(14, 118, 36, 3);
					}
					ctx.save();
					ctx.translate(42, 128);
					ctx.rotate(-Math.PI / 2);
					ctx.fillStyle = '#f7ecd2';
					ctx.font = '700 22px serif';
					ctx.textAlign = 'center';
					ctx.fillText(title, 0, 0);
					ctx.restore();
				}),
				roughness: 0.58
			})
		);
	}

	function bookMesh(item: ShelfItem) {
		const g = new THREE.Group();
		const cover = mesh(box, spineMap(item.title, item.tone));
		cover.scale.set(item.thick, item.tall, 0.32);
		g.add(cover);
		const pages = mesh(box, keepMat(mat(0xf3e6c8, { roughness: 0.92 })));
		pages.scale.set(item.thick * 0.62, item.tall * 0.92, 0.3);
		pages.position.z = 0.02;
		g.add(pages);
		const band = mesh(box, brass);
		band.scale.set(item.thick + 0.01, 0.03, 0.33);
		band.position.y = item.tall * 0.18;
		g.add(band);
		return g;
	}

	function propMesh(item: ShelfItem) {
		const g = new THREE.Group();
		const kind = item.prop ?? 'cup';
		const lean = mesh(box, keepMat(mat(item.tone > 0.5 ? 0x7f1d1d : 0x1e3a5f)));
		lean.scale.set(0.08, 0.3, 0.2);
		lean.position.set(-0.12, 0.15, 0.02);
		lean.rotation.z = -0.12;
		g.add(lean);
		const stub = mesh(box, keepMat(mat(item.tone > 0.4 ? 0x365314 : 0x6b21a8)));
		stub.scale.set(0.07, 0.26, 0.18);
		stub.position.set(0.13, 0.13, 0.01);
		g.add(stub);
		if (kind === 'globe') {
			const ball = mesh(sphere, keepMat(mat(0x3b82c4, { roughness: 0.38, metalness: 0.22 })));
			ball.scale.setScalar(0.14);
			ball.position.y = 0.18;
			g.add(ball);
			const ring = mesh(torus, brass);
			ring.scale.set(0.15, 0.15, 0.15);
			ring.rotation.x = 1.15;
			ring.position.y = 0.16;
			g.add(ring);
			const stand = mesh(cyl, brass);
			stand.scale.set(0.04, 0.1, 0.04);
			stand.position.y = 0.05;
			g.add(stand);
		} else if (kind === 'cup') {
			const body = mesh(cyl, keepMat(mat(0xf2d2c2, { roughness: 0.32 })));
			body.scale.set(0.07, 0.08, 0.07);
			body.position.y = 0.08;
			g.add(body);
			const handle = mesh(torus, keepMat(mat(0xf2d2c2, { roughness: 0.32 })));
			handle.scale.set(0.05, 0.05, 0.05);
			handle.position.set(0.08, 0.08, 0);
			g.add(handle);
		} else if (kind === 'clock') {
			const body = mesh(box, woodDark);
			body.scale.set(0.16, 0.2, 0.08);
			body.position.y = 0.12;
			g.add(body);
			const face = mesh(cyl, keepMat(mat(0xf5e6c8, { metalness: 0.2 })));
			face.scale.set(0.11, 0.04, 0.11);
			face.rotation.x = Math.PI / 2;
			face.position.y = 0.14;
			g.add(face);
		} else if (kind === 'cat') {
			const body = mesh(sphereLo, keepMat(mat(0xe7e2da)));
			body.scale.set(0.1, 0.12, 0.14);
			body.position.y = 0.12;
			g.add(body);
			const ear = mesh(cone, keepMat(mat(0xe7e2da)));
			ear.scale.set(0.04, 0.08, 0.04);
			ear.position.set(-0.05, 0.24, 0);
			g.add(ear);
			const ear2 = ear.clone();
			ear2.position.x = 0.05;
			g.add(ear2);
		} else if (kind === 'candle') {
			const stick = mesh(cyl, brass);
			stick.scale.set(0.035, 0.16, 0.035);
			stick.position.y = 0.1;
			g.add(stick);
			const flame = mesh(
				cone,
				keepMat(mat(0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 0.9 }))
			);
			flame.scale.set(0.028, 0.07, 0.028);
			flame.position.y = 0.23;
			g.add(flame);
		} else if (kind === 'plant') {
			const pot = mesh(cyl, keepMat(mat(0x9a3412)));
			pot.scale.set(0.07, 0.08, 0.07);
			pot.position.y = 0.06;
			g.add(pot);
			const leaf = mesh(sphereLo, keepMat(mat(0x3f7a45, { roughness: 0.7 })));
			leaf.scale.set(0.1, 0.12, 0.08);
			leaf.position.y = 0.18;
			g.add(leaf);
		} else if (kind === 'frame') {
			const fr = mesh(box, wood);
			fr.scale.set(0.16, 0.2, 0.03);
			fr.position.y = 0.14;
			g.add(fr);
			const pic = mesh(
				box,
				keepMat(mat(0xf4e4c8, { emissive: 0xe8d5b5, emissiveIntensity: 0.18 }))
			);
			pic.scale.set(0.12, 0.15, 0.02);
			pic.position.set(0, 0.14, 0.012);
			g.add(pic);
		} else if (kind === 'ink') {
			const bottle = mesh(cyl, keepMat(mat(0x1e293b, { metalness: 0.3, roughness: 0.25 })));
			bottle.scale.set(0.05, 0.1, 0.05);
			bottle.position.y = 0.1;
			g.add(bottle);
			const cork = mesh(cyl, wood);
			cork.scale.set(0.03, 0.03, 0.03);
			cork.position.y = 0.17;
			g.add(cork);
		} else if (kind === 'teapot') {
			const pot = mesh(sphereLo, keepMat(mat(0xd9c4a3, { roughness: 0.4 })));
			pot.scale.set(0.11, 0.08, 0.11);
			pot.position.y = 0.1;
			g.add(pot);
			const spout = mesh(cone, keepMat(mat(0xd9c4a3)));
			spout.scale.set(0.03, 0.09, 0.03);
			spout.rotation.z = -1.1;
			spout.position.set(0.1, 0.1, 0);
			g.add(spout);
		} else {
			const dome = mesh(
				sphereLo,
				keepMat(mat(0xc4d4e0, { transparent: true, opacity: 0.38, roughness: 0.12 }))
			);
			dome.scale.setScalar(0.13);
			dome.position.y = 0.14;
			g.add(dome);
			const moth = mesh(ico, keepMat(mat(0x57534e)));
			moth.scale.set(0.05, 0.02, 0.08);
			moth.position.y = 0.1;
			g.add(moth);
		}
		return g;
	}

	function ensureItem(item: ShelfItem) {
		let g = itemMap.get(item.id);
		if (!g) {
			g = item.kind === 'book' ? bookMesh(item) : propMesh(item);
			g.name = item.id;
			g.userData.id = item.id;
			g.traverse((obj: InstanceType<typeof THREE.Object3D>) => {
				obj.userData.id = item.id;
			});
			itemMap.set(item.id, g);
			itemRoot.add(g);
		}
		return g;
	}

	const ghost = new THREE.Group();
	ghost.name = 'haunt-ghost';
	const veil = mesh(
		ico,
		keepMat(
			mat(0xe8f4ff, {
				transparent: true,
				opacity: 0.52,
				emissive: 0xc4b5fd,
				emissiveIntensity: 0.85,
				depthWrite: false,
				roughness: 0.32
			})
		)
	);
	veil.scale.set(0.34, 0.48, 0.3);
	veil.position.y = 0.22;
	ghost.add(veil);
	const core = new THREE.Mesh(
		sphere,
		keepMat(
			new THREE.MeshBasicMaterial({
				color: 0xf8fafc,
				transparent: true,
				opacity: 0.9
			})
		)
	);
	core.scale.setScalar(0.16);
	core.position.y = 0.3;
	ghost.add(core);
	const brow = mesh(box, keepMat(mat(0x1e1b4b)));
	brow.scale.set(0.2, 0.025, 0.04);
	brow.position.set(0, 0.42, 0.14);
	ghost.add(brow);
	for (const x of [-0.09, 0.09]) {
		const eye = mesh(sphere, keepMat(mat(0xf8fafc)));
		eye.scale.setScalar(0.08);
		eye.position.set(x, 0.34, 0.18);
		ghost.add(eye);
		const pupil = mesh(sphere, keepMat(mat(0x1e1b4b)));
		pupil.scale.setScalar(0.038);
		pupil.position.set(x, 0.32, 0.25);
		ghost.add(pupil);
	}
	const mouth = mesh(torus, keepMat(mat(0x6d28d9, { roughness: 0.35 })));
	mouth.scale.set(0.08, 0.05, 0.05);
	mouth.position.set(0, 0.18, 0.2);
	mouth.rotation.x = 1.15;
	ghost.add(mouth);
	const tears: G[] = [];
	for (const x of [-0.1, 0.1]) {
		const tear = new THREE.Group();
		const drop = mesh(
			cone,
			keepMat(
				mat(0x7dd3fc, {
					transparent: true,
					opacity: 0.92,
					emissive: 0x38bdf8,
					emissiveIntensity: 0.7
				})
			)
		);
		drop.scale.set(0.045, 0.14, 0.045);
		drop.rotation.x = Math.PI;
		tear.add(drop);
		const bead = mesh(
			sphereLo,
			keepMat(mat(0xbae6fd, { emissive: 0x7dd3fc, emissiveIntensity: 0.4 }))
		);
		bead.scale.setScalar(0.035);
		bead.position.y = -0.08;
		tear.add(bead);
		tear.position.set(x, 0.22, 0.22);
		ghost.add(tear);
		tears.push(tear);
	}
	ghost.visible = false;
	scene.add(ghost);

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const ndc = new THREE.Vector3();
	let reduceMotion = false;
	let lowDetail = false;

	function applyDetail(world: ShelfWorld) {
		const next = world.lowDetail;
		if (next === lowDetail) return;
		lowDetail = next;
		renderer.shadowMap.enabled = !lowDetail;
		sun.castShadow = !lowDetail;
		lamp.intensity = lowDetail ? 9 : 18;
		windowG.visible = !lowDetail;
		extras.visible = !lowDetail;
		curtain.visible = !lowDetail;
		inlay.visible = !lowDetail;
	}

	function poseItem(world: ShelfWorld, item: ShelfItem, g: G) {
		const home = slotWorld(item.row, item.slot);
		const held = world.heldId === item.id;
		const hauntNow = held && isHaunting(world);
		g.userData.row = item.row;
		g.userData.slot = item.slot;
		g.position.set(
			home.x,
			home.y + (held ? (hauntNow ? 0.1 : 0.08) : 0),
			home.z + (held ? 0.42 : item.kind === 'book' ? 0.04 : 0)
		);
		g.scale.setScalar(held ? 1.08 : 1);
		g.rotation.y = held ? 0.22 : item.kind === 'book' && item.slot % 5 === 1 ? 0.16 : 0;
		g.rotation.z = held || item.kind !== 'book' ? 0 : (item.tone - 0.5) * 0.02;
		g.visible = inLod(item, lowDetail) || item.id === world.hauntId || item.id === world.heldId;
	}

	function poseGhost(world: ShelfWorld) {
		const haunt = findItem(world, world.hauntId);
		if (!haunt || !isHaunting(world)) {
			ghost.visible = false;
			ghostLight.intensity = 0;
			return;
		}
		ghost.visible = true;
		const g = itemMap.get(haunt.id);
		const base = g ? g.position : new THREE.Vector3();
		const u = hauntProgress(world);
		let yOff = 0.16;
		let zOff = 0.32;
		let scale = 1;
		if (world.phase === 'emerge') {
			yOff = 0.04 + u * 0.14;
			zOff = 0.08 + u * 0.3;
			scale = 0.28 + u * 0.78;
		} else if (world.phase === 'retreat') {
			yOff = 0.18 - u * 0.14;
			zOff = 0.38 - u * 0.3;
			scale = 1.06 - u * 0.9;
		} else {
			yOff = 0.18;
			zOff = 0.38;
			scale = 1.06;
		}
		ghost.position.set(base.x, Math.min(2.08, Math.max(0.62, base.y + yOff)), base.z + zOff);
		ghost.scale.setScalar(Math.max(0.1, scale));
		ghost.rotation.set(0, 0, 0);
		const cry = world.phase === 'cry' || world.phase === 'sorry';
		tears.forEach((tear, i) => {
			tear.visible = cry;
			const fall = cry ? (world.t * 0.0024 + i * 0.14) % 0.26 : 0;
			tear.position.set(i === 0 ? -0.1 : 0.1, 0.12 - fall, 0.24);
			tear.scale.setScalar(cry ? 1.2 : 0.2);
		});
		mouth.scale.set(0.08, cry ? 0.09 : world.phase === 'face' ? 0.04 : 0.05, 0.05);
		brow.rotation.z = cry ? 0.18 : -0.08;
		ghostLight.position.copy(ghost.position);
		ghostLight.intensity = reduceMotion ? 1.6 : 2.8;
	}

	function sync(world: ShelfWorld, opts?: { reducedMotion?: boolean }) {
		if (opts?.reducedMotion != null) reduceMotion = opts.reducedMotion;
		applyDetail(world);
		for (const item of world.items) poseItem(world, item, ensureItem(item));
		poseGhost(world);
	}

	function hit(clientX: number, clientY: number, ignoreId?: string | null) {
		const rect = canvas.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return null;
		pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		const itemHits = raycaster
			.intersectObjects(itemRoot.children, true)
			.filter((h: { object: InstanceType<typeof THREE.Object3D> }) => {
				if (!shown(h.object)) return false;
				const id = String(h.object.userData.id ?? '');
				return !ignoreId || id !== ignoreId;
			});
		if (itemHits[0]) {
			const id = String(itemHits[0].object.userData.id ?? '');
			if (id) {
				const g = itemMap.get(id);
				return {
					id,
					row: Number(g?.userData.row),
					slot: Number(g?.userData.slot)
				};
			}
		}
		const pads = raycaster.intersectObjects(slotPads, false);
		if (pads[0]) {
			return {
				row: Number(pads[0].object.userData.row),
				slot: Number(pads[0].object.userData.slot)
			};
		}
		return null;
	}

	function toCanvas(vec: InstanceType<typeof THREE.Vector3>) {
		ndc.copy(vec);
		ndc.project(camera);
		const rect = canvas.getBoundingClientRect();
		return {
			x: ((ndc.x + 1) / 2) * rect.width,
			y: ((-ndc.y + 1) / 2) * rect.height
		};
	}

	function project(id: string) {
		const g = itemMap.get(id);
		if (!g) return null;
		return toCanvas(g.position);
	}

	function projectGhost() {
		if (!ghost.visible) return null;
		return toCanvas(ghost.position);
	}

	function render(now: number) {
		const t = now / 1000;
		if (!reduceMotion && ghost.visible) {
			veil.rotation.y = t * 1.35;
			veil.position.y = 0.22 + Math.sin(t * 3.1) * 0.02;
		}
		renderer.render(scene, camera);
	}

	function resize() {
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		if (camera.aspect < 0.9) {
			camera.fov = 50;
			camera.position.set(0.08, 1.58, 4.35);
		} else {
			camera.fov = 42;
			camera.position.set(0.12, 1.52, 3.28);
		}
		camera.lookAt(0, 1.38, -1.7);
		camera.updateProjectionMatrix();
	}

	function dispose() {
		renderer.dispose();
		for (const g of geos) g.dispose();
		for (const m of mats) m.dispose();
	}

	resize();
	return { sync, render, resize, dispose, hit, project, projectGhost };
}
