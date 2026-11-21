import * as THREE from 'three';
import { PROP_INFO, type PropKind, type StudyWorld } from './sim';

export interface ShelfScene {
	sync(world: StudyWorld, opts?: { reducedMotion?: boolean }): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	hit(
		clientX: number,
		clientY: number
	): { kind?: PropKind; slot?: number; table?: { x: number; z: number } } | null;
}

type G = InstanceType<typeof THREE.Group>;
type M = InstanceType<typeof THREE.Mesh>;
type Geo = InstanceType<typeof THREE.BufferGeometry>;
type Renderer = InstanceType<typeof THREE.WebGLRenderer>;

const STUDY_CAM = new THREE.Vector3(0.12, 1.62, 3.45);
const STUDY_LOOK = new THREE.Vector3(0, 1.22, -2.05);
const ROOM_CAM = new THREE.Vector3(8.55, 1.55, 2.55);
const ROOM_LOOK = new THREE.Vector3(8.5, 1.15, -0.35);
const TABLE = { x: 8.5, y: 0.74, z: 0 };

export function slotWorld(i: number, n: number) {
	const span = 0.62;
	return { x: (i - (n - 1) / 2) * span, y: 1.22, z: -2.02 };
}

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
	return tex;
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
	renderer.setClearColor(0x1a120c, 1);

	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x2a1c14, 0.045);
	const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 60);
	camera.position.copy(STUDY_CAM);
	camera.lookAt(STUDY_LOOK);

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
	const sphere = keepGeo(new THREE.SphereGeometry(1, 28, 20));
	const sphereLo = keepGeo(new THREE.SphereGeometry(1, 12, 10));
	const cyl = keepGeo(new THREE.CylinderGeometry(1, 1, 1, 16));
	const cone = keepGeo(new THREE.ConeGeometry(1, 1, 12));
	const torus = keepGeo(new THREE.TorusGeometry(1, 0.12, 8, 24));
	const plane = keepGeo(new THREE.PlaneGeometry(1, 1));
	const ico = keepGeo(new THREE.IcosahedronGeometry(1, 0));
	const paper = keepMat(
		new THREE.MeshStandardMaterial({
			map: canvasTex(256, 256, (ctx) => {
				ctx.fillStyle = '#e7d3b0';
				ctx.fillRect(0, 0, 256, 256);
				for (let i = 0; i < 12; i++) {
					ctx.fillStyle = i % 2 ? '#d9c19a' : '#ecd9b6';
					ctx.fillRect(i * 22, 0, 10, 256);
				}
				ctx.fillStyle = 'rgba(120,80,40,0.08)';
				for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 8, 2);
			}),
			roughness: 0.92
		})
	);
	const wood = keepMat(mat(0x6b3f24, { roughness: 0.78 }));
	const woodDark = keepMat(mat(0x3d2416, { roughness: 0.82 }));
	const brass = keepMat(mat(0xc9a227, { metalness: 0.72, roughness: 0.32 }));

	const hemi = new THREE.HemisphereLight(0xffe2c4, 0x3a2418, 0.55);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xffd7a8, 1.35);
	sun.position.set(-4.5, 5.2, 2.2);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.near = 1;
	sun.shadow.camera.far = 22;
	sun.shadow.camera.left = -8;
	sun.shadow.camera.right = 10;
	sun.shadow.camera.top = 6;
	sun.shadow.camera.bottom = -4;
	scene.add(sun);
	const lamp = new THREE.PointLight(0xffb066, 22, 12, 1.6);
	lamp.position.set(-1.6, 2.15, 0.4);
	scene.add(lamp);
	const hearth = new THREE.PointLight(0xff7a3a, 16, 9, 1.8);
	hearth.position.set(2.4, 0.8, 0.2);
	scene.add(hearth);
	const roomLamp = new THREE.PointLight(0xc4d4ff, 18, 10, 1.5);
	roomLamp.position.set(8.5, 2.4, 0.6);
	scene.add(roomLamp);

	function mesh(geo: Geo, material: InstanceType<typeof THREE.Material>, extra?: Partial<M>) {
		const m = new THREE.Mesh(geo, material);
		m.castShadow = true;
		m.receiveShadow = true;
		if (extra) Object.assign(m, extra);
		return m;
	}

	const floor = mesh(box, keepMat(mat(0x5a341c, { roughness: 0.86 })));
	floor.scale.set(18, 0.12, 10);
	floor.position.set(3.5, -0.06, 0.4);
	scene.add(floor);

	const rug = mesh(
		keepGeo(new THREE.CircleGeometry(1.7, 32)),
		keepMat(mat(0x7a1f1f, { roughness: 0.9 }))
	);
	rug.rotation.x = -Math.PI / 2;
	rug.position.set(0, 0.02, 0.4);
	scene.add(rug);

	const back = mesh(box, paper);
	back.scale.set(6.4, 3.4, 0.12);
	back.position.set(0, 1.7, -2.55);
	scene.add(back);

	const left = mesh(box, paper);
	left.scale.set(0.12, 3.4, 6.2);
	left.position.set(-3.15, 1.7, 0.2);
	scene.add(left);

	const ceil = mesh(box, woodDark);
	ceil.scale.set(18, 0.16, 10);
	ceil.position.set(3.5, 3.35, 0.4);
	scene.add(ceil);

	const beam = mesh(box, wood);
	beam.scale.set(6.6, 0.16, 0.22);
	beam.position.set(0, 3.18, -0.4);
	scene.add(beam);

	function windowPane() {
		const g = new THREE.Group();
		const frame = mesh(box, woodDark);
		frame.scale.set(1.35, 1.9, 0.1);
		g.add(frame);
		const glass = mesh(
			plane,
			keepMat(
				mat(0xffd19a, {
					emissive: 0xffc07a,
					emissiveIntensity: 0.55,
					transparent: true,
					opacity: 0.92
				})
			)
		);
		glass.position.z = 0.06;
		glass.scale.set(1.1, 1.6, 1);
		g.add(glass);
		const barH = mesh(box, wood);
		barH.scale.set(1.2, 0.06, 0.08);
		g.add(barH);
		const barV = mesh(box, wood);
		barV.scale.set(0.06, 1.7, 0.08);
		g.add(barV);
		g.position.set(-3.05, 1.75, -0.35);
		g.rotation.y = Math.PI / 2;
		scene.add(g);
		const curtain = mesh(plane, keepMat(mat(0x7b2d3b, { roughness: 0.7, side: THREE.DoubleSide })));
		curtain.position.set(-2.85, 1.7, -1.35);
		curtain.scale.set(0.7, 2.5, 1);
		scene.add(curtain);
		const curtain2 = curtain.clone();
		curtain2.position.z = 0.65;
		scene.add(curtain2);
	}
	windowPane();

	function bookcase() {
		const g = new THREE.Group();
		const backP = mesh(box, wood);
		backP.scale.set(2.6, 2.55, 0.08);
		backP.position.set(0, 1.28, -2.44);
		g.add(backP);
		for (const y of [0.42, 1.12, 1.82, 2.48]) {
			const board = mesh(box, woodDark);
			board.scale.set(2.5, 0.08, 0.52);
			board.position.set(0, y, -2.18);
			g.add(board);
		}
		const leftP = mesh(box, wood);
		leftP.scale.set(0.1, 2.55, 0.52);
		leftP.position.set(-1.3, 1.28, -2.18);
		g.add(leftP);
		const rightP = leftP.clone();
		rightP.position.x = 1.3;
		g.add(rightP);
		const crown = mesh(box, wood);
		crown.scale.set(2.7, 0.1, 0.56);
		crown.position.set(0, 2.58, -2.18);
		g.add(crown);
		scene.add(g);
	}
	bookcase();

	const slotMeshes: M[] = [];
	for (let i = 0; i < 6; i++) {
		const plate = mesh(
			box,
			keepMat(mat(0x8a5a32, { emissive: 0x5a3418, emissiveIntensity: 0.08 }))
		);
		plate.scale.set(0.5, 0.03, 0.36);
		plate.userData.slot = i;
		scene.add(plate);
		slotMeshes.push(plate);
	}

	function decoBook(x: number, y: number, z: number, color: number, h = 0.22) {
		const b = mesh(box, keepMat(mat(color, { roughness: 0.7 })));
		b.scale.set(0.1, h, 0.17);
		b.position.set(x, y, z);
		b.rotation.y = (Math.random() - 0.5) * 0.1;
		scene.add(b);
	}
	for (let i = 0; i < 9; i++) {
		const h = 0.2 + (i % 3) * 0.04;
		decoBook(
			-0.95 + i * 0.22,
			1.82 + 0.04 + h / 2,
			-2.06,
			[0x7f1d1d, 0x1e3a5f, 0x3f6212, 0x44403c][i % 4]!,
			h
		);
	}
	for (let i = 0; i < 7; i++) {
		decoBook(-0.85 + i * 0.24, 0.42 + 0.13, -2.06, [0x4c1d95, 0x9a3412, 0x164e63][i % 3]!, 0.18);
	}

	const desk = mesh(box, wood);
	desk.scale.set(1.8, 0.08, 0.7);
	desk.position.set(0.2, 0.74, 1.15);
	scene.add(desk);
	const leg = mesh(cyl, woodDark);
	leg.scale.set(0.04, 0.74, 0.04);
	leg.position.set(-0.55, 0.37, 1.35);
	scene.add(leg);
	const leg2 = leg.clone();
	leg2.position.x = 0.9;
	scene.add(leg2);

	const blotter = mesh(box, keepMat(mat(0x3f2a1a)));
	blotter.scale.set(0.7, 0.02, 0.42);
	blotter.position.set(0.15, 0.8, 1.12);
	scene.add(blotter);

	const candle = mesh(cyl, keepMat(mat(0xf5e6c8)));
	candle.scale.set(0.03, 0.16, 0.03);
	candle.position.set(0.72, 0.9, 1.05);
	scene.add(candle);
	const flame = new THREE.PointLight(0xffcc66, 4, 2.4, 2);
	flame.position.set(0.72, 1.02, 1.05);
	scene.add(flame);

	const picture = mesh(
		box,
		keepMat(
			new THREE.MeshStandardMaterial({
				map: canvasTex(128, 160, (ctx) => {
					ctx.fillStyle = '#2b2118';
					ctx.fillRect(0, 0, 128, 160);
					ctx.fillStyle = '#c4a574';
					ctx.fillRect(10, 10, 108, 140);
					ctx.fillStyle = '#6d4c2f';
					ctx.beginPath();
					ctx.arc(64, 78, 28, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = '#3f6b4a';
					ctx.fillRect(18, 108, 92, 32);
				})
			})
		)
	);
	picture.scale.set(0.55, 0.7, 0.04);
	picture.position.set(2.05, 1.85, -2.46);
	scene.add(picture);

	const stove = mesh(box, keepMat(mat(0x2a211c, { metalness: 0.4, roughness: 0.5 })));
	stove.scale.set(0.7, 1.1, 0.5);
	stove.position.set(2.45, 0.55, -0.2);
	scene.add(stove);
	const glow = mesh(box, keepMat(mat(0xff6a22, { emissive: 0xff5410, emissiveIntensity: 0.9 })));
	glow.scale.set(0.35, 0.22, 0.04);
	glow.position.set(2.45, 0.42, 0.06);
	scene.add(glow);

	function spine(title: string, color: string) {
		return canvasTex(64, 256, (ctx) => {
			ctx.fillStyle = color;
			ctx.fillRect(0, 0, 64, 256);
			ctx.fillStyle = '#e8d5a3';
			ctx.fillRect(8, 18, 48, 6);
			ctx.fillRect(8, 232, 48, 6);
			ctx.save();
			ctx.translate(38, 210);
			ctx.rotate(-Math.PI / 2);
			ctx.font = '22px serif';
			ctx.fillText(title, 0, 0);
			ctx.restore();
		});
	}

	function rig(kind: PropKind) {
		const g = new THREE.Group();
		g.userData.kind = kind;
		if (kind === 'globe') {
			const ball = mesh(
				sphere,
				keepMat(
					new THREE.MeshStandardMaterial({
						map: canvasTex(256, 128, (ctx) => {
							ctx.fillStyle = '#1d4f7a';
							ctx.fillRect(0, 0, 256, 128);
							ctx.fillStyle = '#3f7a46';
							for (const [x, y, r] of [
								[70, 50, 28],
								[120, 40, 22],
								[180, 70, 30],
								[40, 90, 16]
							] as const) {
								ctx.beginPath();
								ctx.arc(x, y, r, 0, Math.PI * 2);
								ctx.fill();
							}
						}),
						roughness: 0.45
					})
				)
			);
			ball.scale.setScalar(0.2);
			ball.position.y = 0.26;
			g.add(ball);
			const ring = mesh(torus, brass);
			ring.scale.set(0.18, 0.18, 0.18);
			ring.rotation.x = Math.PI / 2.4;
			ring.position.y = 0.22;
			g.add(ring);
			const stand = mesh(cone, brass);
			stand.scale.set(0.08, 0.12, 0.08);
			stand.position.y = 0.05;
			g.add(stand);
		} else if (kind === 'cup') {
			const bowl = mesh(cyl, keepMat(mat(0xf3efe6, { roughness: 0.35 })));
			bowl.scale.set(0.1, 0.1, 0.1);
			bowl.position.y = 0.12;
			g.add(bowl);
			const handle = mesh(torus, keepMat(mat(0xf3efe6, { roughness: 0.35 })));
			handle.scale.set(0.07, 0.07, 0.07);
			handle.position.set(0.11, 0.13, 0);
			handle.rotation.y = Math.PI / 2;
			g.add(handle);
			const saucer = mesh(keepGeo(new THREE.CircleGeometry(0.15, 20)), keepMat(mat(0xe7dcc8)));
			saucer.rotation.x = -Math.PI / 2;
			saucer.position.y = 0.02;
			g.add(saucer);
			const tea = mesh(keepGeo(new THREE.CircleGeometry(0.08, 16)), keepMat(mat(0x6b3a1f)));
			tea.rotation.x = -Math.PI / 2;
			tea.position.y = 0.175;
			g.add(tea);
		} else if (kind === 'moth') {
			const body = mesh(sphereLo, keepMat(mat(0x4a3728)));
			body.scale.set(0.055, 0.04, 0.11);
			body.position.y = 0.12;
			g.add(body);
			const wingTex = keepMat(
				new THREE.MeshStandardMaterial({
					map: canvasTex(128, 96, (ctx) => {
						ctx.fillStyle = '#c4a574';
						ctx.fillRect(0, 0, 128, 96);
						ctx.fillStyle = '#6b3a2a';
						ctx.beginPath();
						ctx.arc(40, 40, 16, 0, Math.PI * 2);
						ctx.fill();
						ctx.fillStyle = '#1f2937';
						ctx.beginPath();
						ctx.arc(88, 36, 10, 0, Math.PI * 2);
						ctx.fill();
					}),
					side: THREE.DoubleSide,
					roughness: 0.8
				})
			);
			const wingL = mesh(plane, wingTex);
			wingL.scale.set(0.24, 0.16, 1);
			wingL.position.set(-0.1, 0.14, 0);
			wingL.rotation.y = 0.4;
			g.add(wingL);
			const wingR = wingL.clone();
			wingR.position.x = 0.08;
			wingR.rotation.y = -0.4;
			g.add(wingR);
			const pin = mesh(cyl, brass);
			pin.scale.set(0.008, 0.16, 0.008);
			pin.position.y = 0.08;
			g.add(pin);
		} else if (kind === 'book') {
			const cover = mesh(
				box,
				keepMat(new THREE.MeshStandardMaterial({ map: spine('星图', '#6b1d1d'), roughness: 0.7 }))
			);
			cover.scale.set(0.07, 0.28, 0.2);
			cover.position.y = 0.16;
			g.add(cover);
			const pages = mesh(box, keepMat(mat(0xf5ecd6)));
			pages.scale.set(0.04, 0.26, 0.18);
			pages.position.set(0.015, 0.16, 0);
			g.add(pages);
		} else if (kind === 'bottle') {
			const body = mesh(
				cyl,
				keepMat(
					mat(0x2f6b4f, { transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.15 })
				)
			);
			body.scale.set(0.055, 0.14, 0.055);
			body.position.y = 0.12;
			g.add(body);
			const neck = mesh(cyl, keepMat(mat(0x2f6b4f, { transparent: true, opacity: 0.5 })));
			neck.scale.set(0.022, 0.07, 0.022);
			neck.position.y = 0.22;
			g.add(neck);
			const cork = mesh(cyl, keepMat(mat(0xb08968)));
			cork.scale.set(0.02, 0.03, 0.02);
			cork.position.y = 0.27;
			g.add(cork);
			const liquid = mesh(
				cyl,
				keepMat(mat(0x4ade80, { emissive: 0x166534, emissiveIntensity: 0.3 }))
			);
			liquid.scale.set(0.045, 0.07, 0.045);
			liquid.position.y = 0.09;
			g.add(liquid);
		} else if (kind === 'lamp') {
			const base = mesh(cyl, brass);
			base.scale.set(0.07, 0.04, 0.07);
			base.position.y = 0.03;
			g.add(base);
			const stem = mesh(cyl, brass);
			stem.scale.set(0.015, 0.18, 0.015);
			stem.position.y = 0.13;
			g.add(stem);
			const shade = mesh(
				cone,
				keepMat(mat(0xfde68a, { emissive: 0xfbbf24, emissiveIntensity: 0.35 }))
			);
			shade.scale.set(0.12, 0.1, 0.12);
			shade.position.y = 0.26;
			shade.rotation.x = Math.PI;
			g.add(shade);
			const bulb = new THREE.PointLight(0xffe0a0, 5, 2.8, 2);
			bulb.position.y = 0.22;
			g.add(bulb);
		} else if (kind === 'plant') {
			const pot = mesh(cyl, keepMat(mat(0x9a3412, { roughness: 0.8 })));
			pot.scale.set(0.07, 0.08, 0.07);
			pot.position.y = 0.05;
			g.add(pot);
			const dirt = mesh(keepGeo(new THREE.CircleGeometry(0.065, 12)), keepMat(mat(0x3f2a14)));
			dirt.rotation.x = -Math.PI / 2;
			dirt.position.y = 0.095;
			g.add(dirt);
			for (let i = 0; i < 5; i++) {
				const leaf = mesh(ico, keepMat(mat(i % 2 ? 0x3f7a46 : 0x65a30d)));
				const a = (i / 5) * Math.PI * 2;
				leaf.position.set(Math.cos(a) * 0.06, 0.16 + (i % 2) * 0.05, Math.sin(a) * 0.05);
				leaf.scale.set(0.05, 0.07, 0.03);
				leaf.rotation.set(0.4, a, 0.3);
				g.add(leaf);
			}
		} else {
			const body = mesh(sphere, keepMat(mat(0x92400e, { roughness: 0.55 })));
			body.scale.set(0.12, 0.05, 0.16);
			body.position.y = 0.08;
			g.add(body);
			const neck = mesh(box, keepMat(mat(0x78350f)));
			neck.scale.set(0.03, 0.04, 0.22);
			neck.position.set(0, 0.1, -0.16);
			g.add(neck);
			const hole = mesh(torus, keepMat(mat(0x1c1917)));
			hole.scale.set(0.04, 0.04, 0.04);
			hole.position.set(0, 0.09, 0.04);
			hole.rotation.x = Math.PI / 2;
			g.add(hole);
		}
		g.traverse((obj: InstanceType<typeof THREE.Object3D>) => {
			obj.userData.kind = kind;
		});
		return g;
	}

	const studyProps = new Map<PropKind, G>();
	const roomProps = new Map<PropKind, G>();
	const pickables: InstanceType<typeof THREE.Object3D>[] = [];
	for (const kind of Object.keys(PROP_INFO) as PropKind[]) {
		const a = rig(kind);
		const b = rig(kind);
		studyProps.set(kind, a);
		roomProps.set(kind, b);
		scene.add(a);
		scene.add(b);
		a.traverse((o: InstanceType<typeof THREE.Object3D>) => pickables.push(o));
		b.traverse((o: InstanceType<typeof THREE.Object3D>) => {
			o.userData.room = true;
			pickables.push(o);
		});
	}

	function collectionAlcove() {
		const night = keepMat(
			new THREE.MeshStandardMaterial({
				map: canvasTex(256, 256, (ctx) => {
					ctx.fillStyle = '#0b1228';
					ctx.fillRect(0, 0, 256, 256);
					ctx.fillStyle = '#1a2748';
					ctx.beginPath();
					ctx.arc(196, 64, 42, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = '#f4e7c3';
					ctx.beginPath();
					ctx.arc(188, 58, 22, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = '#fff8e8';
					for (let i = 0; i < 48; i++) {
						ctx.globalAlpha = 0.45 + (i % 5) * 0.1;
						ctx.fillRect((i * 37) % 256, (i * 53) % 256, 1.6, 1.6);
					}
					ctx.globalAlpha = 1;
				}),
				emissive: 0x93c5fd,
				emissiveIntensity: 0.28,
				roughness: 1
			})
		);
		const velvet = keepMat(mat(0x3b1d4a, { roughness: 0.72 }));
		const alcovePaper = keepMat(
			new THREE.MeshStandardMaterial({
				map: canvasTex(256, 256, (ctx) => {
					ctx.fillStyle = '#3a241c';
					ctx.fillRect(0, 0, 256, 256);
					ctx.fillStyle = '#4a3124';
					for (let i = 0; i < 10; i++) ctx.fillRect(i * 26, 0, 8, 256);
					ctx.fillStyle = 'rgba(180,120,60,0.12)';
					for (let i = 0; i < 18; i++) ctx.fillRect(12, i * 14, 232, 3);
				}),
				roughness: 0.9
			})
		);

		const back = mesh(box, alcovePaper);
		back.scale.set(4.4, 3.4, 0.12);
		back.position.set(TABLE.x, 1.7, -2.55);
		scene.add(back);
		const right = mesh(box, alcovePaper);
		right.scale.set(0.12, 3.4, 5.4);
		right.position.set(10.65, 1.7, 0.05);
		scene.add(right);
		const door = mesh(box, alcovePaper);
		door.scale.set(0.16, 3.2, 4.6);
		door.position.set(6.35, 1.6, -0.15);
		scene.add(door);
		const jamb = mesh(box, wood);
		jamb.scale.set(0.18, 3.2, 0.22);
		jamb.position.set(6.28, 1.6, 2.05);
		scene.add(jamb);

		const rug = mesh(
			keepGeo(new THREE.CircleGeometry(1.55, 36)),
			keepMat(mat(0x4c1d4a, { roughness: 0.92 }))
		);
		rug.rotation.x = -Math.PI / 2;
		rug.position.set(TABLE.x, 0.02, TABLE.z + 0.15);
		scene.add(rug);
		const rugRing = mesh(
			keepGeo(new THREE.TorusGeometry(1.18, 0.05, 8, 36)),
			keepMat(mat(0xc9a227, { metalness: 0.35, roughness: 0.45 }))
		);
		rugRing.rotation.x = Math.PI / 2;
		rugRing.position.set(TABLE.x, 0.03, TABLE.z + 0.15);
		scene.add(rugRing);

		const table = mesh(keepGeo(new THREE.CylinderGeometry(1.12, 1.18, 0.09, 32)), wood);
		table.position.set(TABLE.x, TABLE.y, TABLE.z);
		table.userData.table = true;
		scene.add(table);
		pickables.push(table);
		const cloth = mesh(
			keepGeo(new THREE.CircleGeometry(1.08, 32)),
			keepMat(mat(0x5b2a4a, { roughness: 0.78 }))
		);
		cloth.rotation.x = -Math.PI / 2;
		cloth.position.set(TABLE.x, TABLE.y + 0.05, TABLE.z);
		scene.add(cloth);
		const pedestal = mesh(cyl, woodDark);
		pedestal.scale.set(0.2, 0.7, 0.2);
		pedestal.position.set(TABLE.x, 0.35, TABLE.z);
		scene.add(pedestal);

		const frame = mesh(box, woodDark);
		frame.scale.set(1.55, 1.85, 0.1);
		frame.position.set(TABLE.x, 2.05, -2.42);
		scene.add(frame);
		const glass = mesh(plane, night);
		glass.position.set(TABLE.x, 2.05, -2.35);
		glass.scale.set(1.32, 1.62, 1);
		scene.add(glass);
		const barH = mesh(box, wood);
		barH.scale.set(1.4, 0.05, 0.08);
		barH.position.set(TABLE.x, 2.05, -2.36);
		scene.add(barH);
		const barV = mesh(box, wood);
		barV.scale.set(0.05, 1.7, 0.08);
		barV.position.set(TABLE.x, 2.05, -2.36);
		scene.add(barV);
		const moonGlow = new THREE.PointLight(0xc4d4ff, 12, 8, 1.6);
		moonGlow.position.set(TABLE.x, 2.15, -1.6);
		scene.add(moonGlow);

		const curtainL = mesh(plane, velvet);
		curtainL.position.set(TABLE.x - 0.95, 1.85, -2.28);
		curtainL.scale.set(0.55, 2.4, 1);
		scene.add(curtainL);
		const curtainR = curtainL.clone();
		curtainR.position.x = TABLE.x + 0.95;
		scene.add(curtainR);
		const rail = mesh(cyl, brass);
		rail.scale.set(0.025, 1.15, 0.025);
		rail.rotation.z = Math.PI / 2;
		rail.position.set(TABLE.x, 3.02, -2.3);
		scene.add(rail);

		const sideboard = mesh(box, wood);
		sideboard.scale.set(1.35, 0.72, 0.38);
		sideboard.position.set(10.05, 0.38, -1.7);
		scene.add(sideboard);
		for (let i = 0; i < 5; i++) {
			decoBook(
				9.55 + i * 0.14,
				0.78 + 0.1,
				-1.62,
				[0x7f1d1d, 0x1e3a5f, 0x854d0e, 0x3f6212, 0x4c1d95][i]!,
				0.2
			);
		}
		const vase = mesh(cyl, keepMat(mat(0x1e3a5f, { metalness: 0.2, roughness: 0.4 })));
		vase.scale.set(0.05, 0.14, 0.05);
		vase.position.set(10.35, 0.9, -1.62);
		scene.add(vase);
		const bloom = mesh(ico, keepMat(mat(0xc084fc, { emissive: 0x7e22ce, emissiveIntensity: 0.25 })));
		bloom.scale.set(0.07, 0.07, 0.07);
		bloom.position.set(10.35, 1.02, -1.62);
		scene.add(bloom);

		const chart = mesh(
			box,
			keepMat(
				new THREE.MeshStandardMaterial({
					map: canvasTex(160, 160, (ctx) => {
						ctx.fillStyle = '#1c1520';
						ctx.fillRect(0, 0, 160, 160);
						ctx.strokeStyle = '#e8d5a3';
						ctx.lineWidth = 8;
						ctx.strokeRect(6, 6, 148, 148);
						ctx.fillStyle = '#93c5fd';
						ctx.beginPath();
						ctx.arc(80, 72, 22, 0, Math.PI * 2);
						ctx.fill();
						ctx.fillStyle = '#fde68a';
						for (const [x, y] of [
							[36, 40],
							[118, 48],
							[52, 118],
							[124, 110],
							[80, 28]
						] as const) {
							ctx.fillRect(x, y, 3, 3);
						}
					}),
					roughness: 0.7
				})
			)
		);
		chart.scale.set(0.62, 0.62, 0.04);
		chart.position.set(10.52, 1.95, -0.4);
		chart.rotation.y = -Math.PI / 2;
		scene.add(chart);

		const lantern = mesh(cyl, brass);
		lantern.scale.set(0.08, 0.04, 0.08);
		lantern.position.set(TABLE.x, 3.05, 0.2);
		scene.add(lantern);
		const shade = mesh(
			cyl,
			keepMat(mat(0xfde68a, { emissive: 0xfbbf24, emissiveIntensity: 0.45, transparent: true, opacity: 0.7 }))
		);
		shade.scale.set(0.14, 0.18, 0.14);
		shade.position.set(TABLE.x, 2.86, 0.2);
		scene.add(shade);
		const hang = mesh(cyl, brass);
		hang.scale.set(0.012, 0.28, 0.012);
		hang.position.set(TABLE.x, 3.18, 0.2);
		scene.add(hang);

		const cornerPot = mesh(cyl, keepMat(mat(0x9a3412, { roughness: 0.8 })));
		cornerPot.scale.set(0.12, 0.16, 0.12);
		cornerPot.position.set(6.85, 0.1, -1.9);
		scene.add(cornerPot);
		for (let i = 0; i < 4; i++) {
			const leaf = mesh(ico, keepMat(mat(i % 2 ? 0x3f7a46 : 0x65a30d)));
			const a = (i / 4) * Math.PI * 2;
			leaf.position.set(6.85 + Math.cos(a) * 0.08, 0.28 + (i % 2) * 0.06, -1.9 + Math.sin(a) * 0.08);
			leaf.scale.set(0.08, 0.1, 0.04);
			leaf.rotation.set(0.3, a, 0.2);
			scene.add(leaf);
		}
	}
	collectionAlcove();

	const veil = mesh(
		plane,
		keepMat(
			mat(0x4a1c28, {
				transparent: true,
				opacity: 0.0,
				side: THREE.DoubleSide,
				depthWrite: false
			})
		)
	);
	veil.position.set(0, 1.45, -1.55);
	veil.scale.set(2.6, 1.7, 1);
	scene.add(veil);

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const camPos = STUDY_CAM.clone();
	const look = STUDY_LOOK.clone();
	let lastRoom: StudyWorld['room'] = 'study';

	let reduceMotion = false;
	let lowDetail = false;

	function applyDetail(world: StudyWorld) {
		const next = world.lowDetail || reduceMotion;
		if (next === lowDetail) return;
		lowDetail = next;
		renderer.shadowMap.enabled = !lowDetail;
		sun.castShadow = !lowDetail;
		candle.visible = !lowDetail;
		flame.intensity = lowDetail ? 0 : 4;
	}

	function sync(world: StudyWorld, opts?: { reducedMotion?: boolean }) {
		if (opts?.reducedMotion != null) reduceMotion = opts.reducedMotion;
		applyDetail(world);
		const n = world.slots.length;
		for (let i = 0; i < slotMeshes.length; i++) {
			const plate = slotMeshes[i]!;
			if (i >= n) {
				plate.visible = false;
				continue;
			}
			const p = slotWorld(i, n);
			plate.visible = world.room === 'study';
			plate.position.set(p.x, p.y - 0.12, p.z);
			const matl = plate.material as InstanceType<typeof THREE.MeshStandardMaterial>;
			matl.emissiveIntensity = world.hintSlot === i || world.focus === i ? 0.45 : 0.08;
		}
		for (const [kind, group] of studyProps) {
			const slot = world.slots.indexOf(kind);
			const used = slot >= 0 || world.held === kind;
			group.visible = world.room === 'study' && (used || world.inspecting === kind);
			if (!group.visible) continue;
			if (world.inspecting === kind) {
				const cam = world.room === 'study' ? STUDY_CAM : ROOM_CAM;
				group.position.set(cam.x + 0.15, 1.35, cam.z - 1.15);
				group.rotation.set(world.inspectPitch, world.inspectYaw, 0);
				group.scale.setScalar(1.35);
			} else if (world.held === kind) {
				group.position.set(0.15, 1.55, -1.15);
				group.rotation.y = world.t / 400;
				group.scale.setScalar(1.1);
			} else if (slot >= 0) {
				const p = slotWorld(slot, n);
				group.position.set(p.x, p.y, p.z);
				group.rotation.set(0, 0, 0);
				group.scale.setScalar(1);
			}
		}
		for (const [kind, group] of roomProps) {
			const put = world.placements.find((p) => p.kind === kind);
			group.visible = world.room === 'collection' && !!put;
			if (!put || !group.visible) continue;
			if (world.inspecting === kind) {
				group.position.set(ROOM_CAM.x + 0.1, 1.32, ROOM_CAM.z - 1.2);
				group.rotation.set(world.inspectPitch, world.inspectYaw, 0);
				group.scale.setScalar(1.4);
			} else {
				group.position.set(TABLE.x + put.x, TABLE.y + 0.18, TABLE.z + put.z);
				group.rotation.y = put.yaw;
				group.scale.setScalar(1);
			}
		}
		const veilMat = veil.material as InstanceType<typeof THREE.MeshStandardMaterial>;
		if (world.phase === 'veil' && world.room === 'study') {
			veil.visible = true;
			veilMat.opacity = reduceMotion ? 0.82 : Math.min(0.88, world.veilT / 180);
			veil.position.y = reduceMotion ? 1.45 : 2.2 - Math.min(1, world.veilT / 400) * 0.75;
		} else {
			veilMat.opacity = 0;
			veil.visible = false;
		}
		const wantCam = world.room === 'collection' ? ROOM_CAM : STUDY_CAM;
		const wantLook = world.room === 'collection' ? ROOM_LOOK : STUDY_LOOK;
		if (reduceMotion || world.room !== lastRoom) {
			camPos.copy(wantCam);
			look.copy(wantLook);
			camera.position.copy(wantCam);
		} else {
			camPos.lerp(wantCam, 0.08);
			look.lerp(wantLook, 0.08);
			camera.position.copy(camPos);
		}
		lastRoom = world.room;
		camera.lookAt(look);
		lamp.intensity = 20 + Math.sin(world.t / 260) * (reduceMotion ? 0 : 1.5);
	}

	function render(now: number) {
		if (!reduceMotion) {
			flame.intensity = 3.4 + Math.sin(now / 140) * 0.8;
			hearth.intensity = 14 + Math.sin(now / 220) * 2;
		}
		renderer.render(scene, camera);
	}

	function setPointer(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return false;
		pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		return true;
	}

	function hit(clientX: number, clientY: number) {
		if (!setPointer(clientX, clientY)) return null;
		const hits = raycaster.intersectObjects([...pickables, ...slotMeshes], false);
		for (const h of hits) {
			const kind = h.object.userData.kind as PropKind | undefined;
			if (kind && PROP_INFO[kind]) return { kind };
			if (typeof h.object.userData.slot === 'number') return { slot: h.object.userData.slot };
			if (h.object.userData.table) {
				return { table: { x: h.point.x - TABLE.x, z: h.point.z - TABLE.z } };
			}
		}
		return null;
	}

	function resize() {
		const parent = canvas.parentElement ?? canvas;
		const w = Math.max(1, parent.clientWidth);
		const h = Math.max(1, parent.clientHeight);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		const narrow = w < 500 || h < 700;
		const cap = lowDetail || narrow ? 1 : 1.5;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
		renderer.setSize(w, h, false);
	}

	function dispose() {
		renderer.dispose();
		for (const g of geos) g.dispose();
		for (const m of mats) m.dispose();
		studyProps.clear();
		roomProps.clear();
	}

	resize();
	return { sync, render, resize, dispose, hit };
}
