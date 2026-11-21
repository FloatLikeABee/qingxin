import * as THREE from 'three';
import { fieldLayout, type OpWorld, type RegionId, type ToolId } from './sim';

export type OpScene = {
	sync(world: OpWorld): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
};

type Mesh = InstanceType<typeof THREE.Mesh>;
type Group = InstanceType<typeof THREE.Group>;
type Geo = InstanceType<typeof THREE.BufferGeometry>;
type Mat = InstanceType<typeof THREE.Material>;
type Renderer = InstanceType<typeof THREE.WebGLRenderer>;

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
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	return tex;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amp: number) {
	const img = ctx.getImageData(0, 0, w, h);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) {
		const n = (Math.random() - 0.5) * amp;
		d[i] = Math.max(0, Math.min(255, d[i] + n));
		d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.8));
		d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.6));
	}
	ctx.putImageData(img, 0, 0);
}

const texSkin = canvasTex(256, 256, (ctx) => {
	ctx.fillStyle = '#c48b7a';
	ctx.fillRect(0, 0, 256, 256);
	const g = ctx.createRadialGradient(128, 80, 20, 128, 128, 180);
	g.addColorStop(0, 'rgba(232,176,160,0.55)');
	g.addColorStop(1, 'rgba(110,48,42,0.25)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 256, 256);
	ctx.strokeStyle = 'rgba(132,48,64,0.28)';
	ctx.lineWidth = 1.2;
	for (let i = 0; i < 18; i++) {
		ctx.beginPath();
		ctx.moveTo(Math.random() * 256, Math.random() * 256);
		ctx.bezierCurveTo(
			Math.random() * 256,
			Math.random() * 256,
			Math.random() * 256,
			Math.random() * 256,
			Math.random() * 256,
			Math.random() * 256
		);
		ctx.stroke();
	}
	noise(ctx, 256, 256, 22);
});

const texMuscle = canvasTex(256, 128, (ctx) => {
	ctx.fillStyle = '#6b1418';
	ctx.fillRect(0, 0, 256, 128);
	for (let y = 0; y < 128; y += 3) {
		ctx.fillStyle = y % 6 === 0 ? '#8a1c22' : '#541014';
		ctx.fillRect(0, y, 256, 2);
	}
	noise(ctx, 256, 128, 18);
});

const texFat = canvasTex(128, 128, (ctx) => {
	ctx.fillStyle = '#e8d39a';
	ctx.fillRect(0, 0, 128, 128);
	for (let i = 0; i < 40; i++) {
		ctx.fillStyle = i % 2 ? 'rgba(255,236,180,0.7)' : 'rgba(196,150,70,0.45)';
		ctx.beginPath();
		ctx.ellipse(Math.random() * 128, Math.random() * 128, 8 + Math.random() * 10, 6, 0, 0, Math.PI * 2);
		ctx.fill();
	}
});

const texDrape = canvasTex(256, 256, (ctx) => {
	ctx.fillStyle = '#1f6b4a';
	ctx.fillRect(0, 0, 256, 256);
	ctx.fillStyle = '#165a3e';
	for (let x = 0; x < 256; x += 18) ctx.fillRect(x, 0, 8, 256);
	noise(ctx, 256, 256, 14);
});

const texBlood = canvasTex(128, 128, (ctx) => {
	const g = ctx.createRadialGradient(64, 48, 8, 64, 64, 70);
	g.addColorStop(0, '#8b1018');
	g.addColorStop(0.45, '#5a040c');
	g.addColorStop(1, '#2a0106');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 128, 128);
	noise(ctx, 128, 128, 16);
});

const texGum = canvasTex(128, 128, (ctx) => {
	ctx.fillStyle = '#b45662';
	ctx.fillRect(0, 0, 128, 128);
	noise(ctx, 128, 128, 20);
});

function std(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.55,
		metalness: 0.06,
		...extras
	});
}

function wet(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.22,
		metalness: 0.12,
		...extras
	});
}

export function mountOpScene(canvas: HTMLCanvasElement): OpScene | null {
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

	const geos: Geo[] = [];
	const mats: Mat[] = [];
	const keepG = <T extends Geo>(g: T) => {
		geos.push(g);
		return g;
	};
	const keepM = <T extends Mat>(m: T) => {
		mats.push(m);
		return m;
	};

	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.setClearColor(0x14181c, 1);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0x14181c, 6, 14);
	const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 40);
	camera.position.set(0, 1.35, 4.6);
	camera.lookAt(0, 0.85, 0);

	const hemi = new THREE.HemisphereLight(0xf2efe8, 0x3a2a28, 0.7);
	scene.add(hemi);
	const lamp = new THREE.SpotLight(0xfff3dd, 38, 12, 0.42, 0.45, 1.1);
	lamp.position.set(0.4, 4.2, 2.2);
	lamp.castShadow = true;
	lamp.shadow.mapSize.set(1024, 1024);
	scene.add(lamp);
	const fill = new THREE.DirectionalLight(0x9ad4c2, 0.45);
	fill.position.set(-3, 2.4, 1.5);
	scene.add(fill);
	const rim = new THREE.DirectionalLight(0xffc4b0, 0.25);
	rim.position.set(2.4, 1.2, -2);
	scene.add(rim);

	const room = new THREE.Group();
	const floor = new THREE.Mesh(
		keepG(new THREE.PlaneGeometry(16, 16)),
		keepM(std(0x8a9096, { roughness: 0.85, map: texDrape }))
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -0.02;
	floor.receiveShadow = true;
	room.add(floor);
	const wall = new THREE.Mesh(keepG(new THREE.BoxGeometry(16, 7, 0.4)), keepM(std(0xd8ddd8)));
	wall.position.set(0, 3.4, -6);
	room.add(wall);
	const table = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(3.4, 0.12, 2.1)),
		keepM(std(0x1f6b4a, { map: texDrape, roughness: 0.7 }))
	);
	table.position.set(0, 0.72, 0);
	table.receiveShadow = true;
	room.add(table);
	const lampHead = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.55, 0.7, 0.18, 24)),
		keepM(std(0xe8eef2, { metalness: 0.6, roughness: 0.25 }))
	);
	lampHead.position.set(0.4, 3.85, 1.4);
	lampHead.rotation.x = 0.4;
	room.add(lampHead);
	scene.add(room);

	const hubRoot = new THREE.Group();
	const fieldRoot = new THREE.Group();
	scene.add(hubRoot);
	scene.add(fieldRoot);

	const skinM = keepM(
		std(0xc48b7a, { map: texSkin, roughness: 0.48, metalness: 0.04 })
	);
	const makeLimb = (w: number, h: number) => {
		const m = new THREE.Mesh(keepG(new THREE.CapsuleGeometry(w, h, 6, 10)), skinM);
		m.castShadow = true;
		m.receiveShadow = true;
		return m;
	};
	const torso = new THREE.Mesh(keepG(new THREE.CapsuleGeometry(0.38, 0.95, 8, 12)), skinM);
	torso.position.set(0, 1.35, 0);
	torso.castShadow = true;
	const head = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.28, 18, 14)), skinM);
	head.position.set(0, 2.12, 0.02);
	const mouth = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.07, 10, 8)),
		keepM(std(0x4a1820, { roughness: 0.35 }))
	);
	mouth.position.set(0, 2.02, 0.24);
	const bellyMark = new THREE.Mesh(
		keepG(new THREE.CircleGeometry(0.16, 16)),
		keepM(std(0xd7a090, { emissive: 0x3a2018, emissiveIntensity: 0.2 }))
	);
	bellyMark.position.set(0, 1.18, 0.38);
	const armL = makeLimb(0.1, 0.55);
	armL.position.set(-0.58, 1.45, 0);
	armL.rotation.z = 0.35;
	const forearm = makeLimb(0.09, 0.5);
	forearm.position.set(-0.92, 1.05, 0.05);
	forearm.rotation.z = 0.9;
	const forearmGlow = new THREE.Mesh(
		keepG(new THREE.CapsuleGeometry(0.1, 0.42, 6, 10)),
		keepM(std(0xe8b2a4, { emissive: 0x5a2018, emissiveIntensity: 0.35 }))
	);
	forearmGlow.position.copy(forearm.position);
	forearmGlow.rotation.copy(forearm.rotation);
	const armR = makeLimb(0.1, 0.55);
	armR.position.set(0.58, 1.45, 0);
	armR.rotation.z = -0.35;
	const legL = makeLimb(0.13, 0.7);
	legL.position.set(-0.2, 0.55, 0);
	const legR = makeLimb(0.13, 0.7);
	legR.position.set(0.2, 0.55, 0);
	const kneeGlow = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.14, 12, 10)),
		keepM(std(0xe0a898, { emissive: 0x5a2018, emissiveIntensity: 0.35 }))
	);
	kneeGlow.position.set(0.2, 0.72, 0.12);
	hubRoot.add(torso, head, mouth, bellyMark, armL, forearm, forearmGlow, armR, legL, legR, kneeGlow);

	const tissue = new THREE.Group();
	const tools = new THREE.Group();
	const blood = new THREE.Group();
	fieldRoot.add(tissue, tools, blood);
	fieldRoot.visible = false;

	const muscleM = keepM(wet(0x7a1c22, { map: texMuscle, roughness: 0.4 }));
	const fatM = keepM(std(0xe6d08a, { map: texFat, roughness: 0.45 }));
	const boneM = keepM(std(0xf0e6d2, { roughness: 0.4 }));
	const bloodM = keepM(
		wet(0x5c0610, {
			map: texBlood,
			transparent: true,
			opacity: 0,
			roughness: 0.08,
			metalness: 0.18,
			depthWrite: false
		})
	);
	const poolM = keepM(
		wet(0x4a030c, { map: texBlood, transparent: true, opacity: 0, roughness: 0.06, metalness: 0.2 })
	);
	const gauzeM = keepM(std(0xf4f1ea, { roughness: 0.85 }));

	const drapeWin = new THREE.Mesh(
		keepG(new THREE.RingGeometry(0.72, 2.4, 32)),
		keepM(std(0x1f6b4a, { map: texDrape, roughness: 0.78, side: THREE.DoubleSide }))
	);
	drapeWin.rotation.x = -Math.PI / 2;
	drapeWin.position.set(0, 1.21, 0);
	const slab = new THREE.Mesh(keepG(new THREE.BoxGeometry(2.6, 0.28, 1.9)), skinM);
	slab.position.set(0, 1.06, 0);
	slab.castShadow = true;
	slab.receiveShadow = true;
	const fat = new THREE.Mesh(keepG(new THREE.BoxGeometry(1.55, 0.05, 0.42)), fatM);
	fat.position.set(0, 1.2, 0);
	const muscle = new THREE.Mesh(keepG(new THREE.BoxGeometry(1.5, 0.12, 0.38)), muscleM);
	muscle.position.set(0, 1.12, 0);
	const lipL = new THREE.Mesh(keepG(new THREE.BoxGeometry(1.55, 0.07, 0.38)), skinM);
	const lipR = new THREE.Mesh(keepG(new THREE.BoxGeometry(1.55, 0.07, 0.38)), skinM);
	lipL.position.set(0, 1.24, 0.22);
	lipR.position.set(0, 1.24, -0.22);
	const cavity = new THREE.Mesh(keepG(new THREE.BoxGeometry(1.5, 0.16, 0.34)), muscleM);
	cavity.position.set(0, 1.14, 0);
	const film = new THREE.Mesh(keepG(new THREE.PlaneGeometry(1.48, 0.3)), bloodM);
	film.rotation.x = -Math.PI / 2;
	film.position.set(0, 1.21, 0);
	const pool = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.18, 0.28, 0.035, 20)), poolM);
	pool.position.set(0.42, 1.2, 0.28);
	const foreign = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(0.18, 0.04, 0.08)),
		keepM(std(0x4b5563, { metalness: 0.7, roughness: 0.3 }))
	);
	foreign.position.set(0.05, 1.16, 0.01);
	foreign.rotation.z = 0.5;
	const stones = new THREE.Group();
	for (let i = 0; i < 3; i++) {
		const s = new THREE.Mesh(
			keepG(new THREE.SphereGeometry(0.07, 10, 8)),
			keepM(std(0xb7a078, { roughness: 0.55 }))
		);
		s.position.set(-0.2 + i * 0.2, 1.12, 0.02);
		stones.add(s);
	}
	const teeth = new THREE.Group();
	const gum = new THREE.Mesh(
		keepG(new THREE.TorusGeometry(0.55, 0.16, 10, 24, Math.PI)),
		keepM(std(0xb45662, { map: texGum, roughness: 0.5 }))
	);
	gum.rotation.x = Math.PI / 2;
	gum.position.set(0, 1.15, 0.1);
	teeth.add(gum);
	for (let i = 0; i < 7; i++) {
		const t = new THREE.Mesh(
			keepG(new THREE.BoxGeometry(0.11, 0.22, 0.1)),
			keepM(std(i === 3 ? 0xf4e27a : 0xf7f1e4, { roughness: 0.35 }))
		);
		const a = -0.9 + i * 0.3;
		t.position.set(Math.sin(a) * 0.5, 1.28, 0.18 + Math.cos(a) * 0.18);
		t.rotation.y = -a;
		t.userData.marked = i === 3;
		teeth.add(t);
	}
	const socket = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10)),
		keepM(wet(0x6b1418, { map: texBlood }))
	);
	socket.position.set(0, 1.2, 0.32);
	socket.visible = false;
	teeth.add(socket);
	const kneeCap = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.32, 16, 12)), skinM);
	kneeCap.position.set(0, 1.15, 0);
	const bone = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 12)), boneM);
	bone.rotation.z = Math.PI / 2;
	bone.position.set(0, 0.95, -0.05);
	const wrap = new THREE.Mesh(
		keepG(new THREE.TorusGeometry(0.38, 0.07, 8, 18)),
		keepM(std(0xd9d3c4, { roughness: 0.8 }))
	);
	wrap.rotation.x = Math.PI / 2;
	wrap.position.set(0, 1.12, 0);
	wrap.visible = false;

	tissue.add(drapeWin, slab, fat, muscle, lipL, lipR, cavity, foreign, stones, teeth, kneeCap, bone, wrap);

	blood.add(film, pool);
	const sprayGeo = keepG(new THREE.BufferGeometry());
	const sprayPos = new Float32Array(80 * 3);
	sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
	const spray = new THREE.Points(
		sprayGeo,
		keepM(
			new THREE.PointsMaterial({
				color: 0x7a0810,
				size: 0.035,
				transparent: true,
				opacity: 0.85,
				depthWrite: false
			})
		)
	);
	blood.add(spray);

	const gauze = new THREE.Mesh(keepG(new THREE.BoxGeometry(0.28, 0.06, 0.22)), gauzeM);
	const scalpel = new THREE.Group();
	const blade = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(0.28, 0.01, 0.05)),
		keepM(std(0xdbe4ee, { metalness: 0.85, roughness: 0.15 }))
	);
	blade.position.x = 0.16;
	const handle = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.02, 0.025, 0.34, 8)),
		keepM(std(0x1f2937, { metalness: 0.4, roughness: 0.4 }))
	);
	handle.rotation.z = Math.PI / 2;
	handle.position.x = -0.08;
	scalpel.add(blade, handle);
	const forceps = new THREE.Group();
	for (const s of [-1, 1]) {
		const arm = new THREE.Mesh(
			keepG(new THREE.BoxGeometry(0.34, 0.012, 0.02)),
			keepM(std(0xcfd8e3, { metalness: 0.8, roughness: 0.2 }))
		);
		arm.position.set(0.02, s * 0.02, 0);
		arm.rotation.z = s * 0.12;
		forceps.add(arm);
	}
	const suction = new THREE.Group();
	suction.add(
		new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 8)),
			keepM(std(0x9ca3af, { metalness: 0.7, roughness: 0.25 }))
		)
	);
	const suctionTip = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.04, 8, 8)),
		keepM(std(0x111827, { metalness: 0.5 }))
	);
	suctionTip.position.y = -0.22;
	suction.add(suctionTip);
	suction.rotation.z = 0.9;
	const irrigator = new THREE.Group();
	irrigator.add(
		new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 8)),
			keepM(std(0xe0f2fe, { roughness: 0.3, transparent: true, opacity: 0.7 }))
		)
	);
	const needle = new THREE.Group();
	needle.add(
		new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6)),
			keepM(std(0xe5e7eb, { metalness: 0.9, roughness: 0.12 }))
		)
	);
	needle.rotation.z = 0.7;
	const bandage = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12)),
		keepM(std(0xf5f0e6, { roughness: 0.8 }))
	);
	const elevator = new THREE.Group();
	elevator.add(
		new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.018, 0.02, 0.3, 8)),
			keepM(std(0xd1d5db, { metalness: 0.75 }))
		)
	);
	const elevTip = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(0.08, 0.01, 0.03)),
		keepM(std(0xe5e7eb, { metalness: 0.85 }))
	);
	elevTip.position.set(0.05, -0.16, 0);
	elevator.add(elevTip);
	const grasper = new THREE.Group();
	grasper.add(
		new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8)),
			keepM(std(0x6b7280, { metalness: 0.6 }))
		)
	);
	const bag = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.09, 10, 8)),
		keepM(std(0x38bdf8, { roughness: 0.4, transparent: true, opacity: 0.55 }))
	);
	const toolMap: Record<ToolId, Group | Mesh> = {
		gauze,
		scalpel,
		forceps,
		suction,
		irrigator,
		needle,
		bandage,
		elevator,
		grasper,
		bag
	};
	for (const t of Object.values(toolMap)) {
		t.visible = false;
		t.castShadow = true;
		tools.add(t);
	}

	const sutures = new THREE.Group();
	for (let i = 0; i < 6; i++) {
		const s = new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 5)),
			keepM(std(0x111827, { roughness: 0.4 }))
		);
		s.rotation.z = Math.PI / 2;
		s.position.set(-0.4 + i * 0.16, 1.29, 0.02);
		sutures.add(s);
	}
	tissue.add(sutures);

	let mode: 'hub' | 'field' | '' = '';
	let region: RegionId | null = null;
	let camZ = 4.6;
	const clock = { last: 0 };

	function layoutField(id: RegionId) {
		teeth.visible = id === 'tooth';
		kneeCap.visible = id === 'knee';
		bone.visible = false;
		slab.visible = id !== 'tooth';
		fat.visible = false;
		muscle.visible = false;
		stones.visible = id === 'belly';
		foreign.visible = id === 'forearm';
		wrap.visible = false;
		lipL.visible = id !== 'tooth';
		lipR.visible = id !== 'tooth';
		cavity.visible = id !== 'tooth';
		camera.position.set(0, 2.28, 0.92);
		camera.lookAt(0, 1.2, 0.02);
		camZ = 0.92;
		if (id === 'tooth') {
			camera.position.set(0, 2.05, 1.05);
			camera.lookAt(0, 1.22, 0.18);
			camZ = 1.05;
		}
	}

	function uvWorld(x: number, y: number) {
		return new THREE.Vector3((x - 0.5) * 1.7, 1.42, (0.5 - y) * 0.9);
	}

	function sync(world: OpWorld) {
		const want = world.view === 'field' ? 'field' : 'hub';
		if (want !== mode || (want === 'field' && world.region !== region)) {
			mode = want;
			region = world.region;
			hubRoot.visible = want === 'hub';
			fieldRoot.visible = want === 'field';
			table.visible = want === 'hub';
			if (want === 'hub') {
				camera.position.set(0.35, 1.7, 3.8);
				camera.lookAt(0, 1.15, 0);
				camZ = 3.8;
			} else if (world.region) {
				layoutField(world.region);
				if (!world.reducedMotion) {
					camera.position.z = camZ + 0.35;
				}
			}
		}

		renderer.shadowMap.enabled = !world.lowDetail;
		const open =
			world.phase === 'prepare'
				? 0
				: world.phase === 'expose'
					? world.progress
					: world.phase === 'done' || world.phase === 'close'
						? Math.max(0.15, 1 - world.progress * 0.85)
						: 1;
		const closeAmt = world.phase === 'close' ? world.progress : world.phase === 'done' ? 1 : 0;
		lipL.rotation.x = -open * 0.55;
		lipR.rotation.x = open * 0.55;
		lipL.position.z = 0.16 + open * 0.16;
		lipR.position.z = -0.16 - open * 0.16;
		cavity.scale.set(1, 0.55 + open * 0.7, 1);
		fat.visible = world.view === 'field' && world.region !== 'tooth' && open > 0.12;
		muscle.visible = fat.visible;
		foreign.visible = world.region === 'forearm' && !world.extracted && world.phase !== 'prepare';
		socket.visible = world.region === 'tooth' && world.extracted;
		if (world.region === 'tooth') {
			for (const ch of teeth.children) {
				if (ch.userData.marked) ch.visible = !world.extracted;
			}
		}
		stones.children.forEach((ch: InstanceType<typeof THREE.Object3D>, i: number) => {
			ch.visible = world.region === 'belly' && i >= world.stoneIndex;
			if (world.heldStone && i === world.stoneIndex) ch.visible = false;
		});
		wrap.visible = world.region === 'knee' && closeAmt > 0.55;
		sutures.visible = closeAmt > 0.2;
		sutures.children.forEach((ch: InstanceType<typeof THREE.Object3D>, i: number) => {
			ch.visible = closeAmt > (i + 1) / 8;
		});

		bloodM.opacity =
			world.view === 'field' ? Math.max(world.film * 0.95, open > 0.18 ? 0.55 : 0) : 0;
		poolM.opacity = world.view === 'field' ? Math.max(world.pool * 0.9, open > 0.35 ? 0.35 : 0) : 0;
		film.visible = world.view === 'field' && (world.film > 0.04 || open > 0.18);
		pool.visible = world.view === 'field' && (world.pool > 0.04 || open > 0.35);
		pool.scale.setScalar(0.6 + world.pool * 1.4);
		gauzeM.color.setHex(world.stain > 20 ? 0xb08a86 : 0xf4f1ea);

		const cap = world.sprayCap;
		const n = Math.min(cap, Math.floor(world.spray));
		for (let i = 0; i < 80; i++) {
			if (i < n) {
				sprayPos[i * 3] = (Math.random() - 0.5) * 0.7;
				sprayPos[i * 3 + 1] = 1.25 + Math.random() * 0.25;
				sprayPos[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
			} else {
				sprayPos[i * 3 + 1] = -10;
			}
		}
		sprayGeo.attributes.position.needsUpdate = true;
		spray.visible = n > 0;

		for (const [id, obj] of Object.entries(toolMap)) {
			obj.visible = world.view === 'field' && world.tool === (id as ToolId);
		}
		const at = uvWorld(world.px, world.py);
		tools.position.copy(at);
		if (world.pointerDown) tools.rotation.z = -0.4;
		else tools.rotation.z = -0.15;
		if (world.heldStone) {
			bag.visible = world.tool === 'bag' || world.heldStone;
			bag.position.copy(at);
		}

		if (world.view === 'field' && !world.reducedMotion) {
			const goal = camZ;
			camera.position.z += (goal - camera.position.z) * 0.08;
		}

		forearmGlow.visible = true;
		kneeGlow.visible = true;
		bellyMark.visible = true;
		mouth.visible = true;
	}

	function render(now: number) {
		clock.last = now;
		renderer.render(scene, camera);
	}

	function resize() {
		const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 800;
		const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 480;
		const dpr = w < 500 ? 1 : Math.min(2, window.devicePixelRatio || 1);
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		camera.aspect = w / Math.max(1, h);
		camera.updateProjectionMatrix();
	}

	function dispose() {
		renderer.dispose();
		for (const g of geos) g.dispose();
		for (const m of mats) m.dispose();
	}

	resize();
	return { sync, render, resize, dispose };
}
