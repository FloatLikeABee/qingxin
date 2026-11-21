import * as THREE from 'three';
import { dummyCarPose, type Biome, type HaulWorld, type RoadPiece, type SceneryBit } from './sim';

export interface CargoScene {
	sync(world: HaulWorld, opts?: { reducedMotion?: boolean }): void;
	render(now: number): void;
	resize(opts?: { lowDetail?: boolean }): void;
	dispose(): void;
}

type Mesh = InstanceType<typeof THREE.Mesh>;
type Geo = InstanceType<typeof THREE.BufferGeometry>;
type Group = InstanceType<typeof THREE.Group>;
type Mat = InstanceType<typeof THREE.Material>;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
	vDir = position;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
	vec3 n = normalize(vDir);
	float h = n.y;
	vec3 col = mix(uHor, uMid, smoothstep(-0.15, 0.22, h));
	col = mix(col, uTop, smoothstep(0.08, 0.78, h));
	float sun = pow(max(0.0, dot(n, normalize(uSunDir))), 48.0);
	float halo = pow(max(0.0, dot(n, normalize(uSunDir))), 5.0);
	col += uSunColor * (sun * 1.1 + halo * 0.22);
	gl_FragColor = vec4(col, 1.0);
}
`;

function col(hex: number) {
	return new THREE.Color(hex);
}

function std(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08, ...extras });
}

function ribbon(piece: RoadPiece, y = 0.05, halfWidth?: number, overlap = 2.8) {
	const hw = halfWidth ?? piece.width / 2;
	const raw = piece.samples;
	const first = raw[0];
	const last = raw[raw.length - 1];
	const samples =
		first && last
			? [
					{
						x: first.x - Math.sin(first.yaw) * overlap,
						z: first.z - Math.cos(first.yaw) * overlap,
						yaw: first.yaw,
						s: first.s - overlap
					},
					...raw,
					{
						x: last.x + Math.sin(last.yaw) * overlap,
						z: last.z + Math.cos(last.yaw) * overlap,
						yaw: last.yaw,
						s: last.s + overlap
					}
				]
			: raw;
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const index: number[] = [];
	for (let i = 0; i < samples.length; i++) {
		const s = samples[i]!;
		const rx = Math.cos(s.yaw);
		const rz = -Math.sin(s.yaw);
		positions.push(s.x + rx * hw, y, s.z + rz * hw, s.x - rx * hw, y, s.z - rz * hw);
		normals.push(0, 1, 0, 0, 1, 0);
		uvs.push(0, s.s * 0.12, 1, s.s * 0.12);
		if (i > 0) {
			const a = (i - 1) * 2;
			index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geo.setIndex(index);
	return geo;
}

function makeTruck(geos: Geo[], mats: Mat[]) {
	const keepG = <T extends Geo>(g: T) => {
		geos.push(g);
		return g;
	};
	const keepM = <T extends Mat>(m: T) => {
		mats.push(m);
		return m;
	};
	const root = new THREE.Group();
	const cab = new THREE.Group();
	const body = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(2.55, 1.55, 3.35)),
		keepM(std(0x3b82f6, { metalness: 0.22, roughness: 0.42 }))
	);
	body.position.set(0, 1.35, 0.55);
	body.castShadow = true;
	const cabin = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(2.4, 1.35, 1.7)),
		keepM(std(0x2563eb, { metalness: 0.18, roughness: 0.38 }))
	);
	cabin.position.set(0, 2.55, 1.15);
	cabin.castShadow = true;
	const glass = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(2.18, 0.85, 0.12)),
		keepM(std(0x9ec9ff, { metalness: 0.4, roughness: 0.12, transparent: true, opacity: 0.78 }))
	);
	glass.position.set(0, 2.62, 2.02);
	const bumper = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(2.7, 0.38, 0.42)),
		keepM(std(0x1e293b))
	);
	bumper.position.set(0, 0.62, 2.28);
	const grille = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(1.4, 0.55, 0.12)),
		keepM(std(0x0f172a))
	);
	grille.position.set(0, 1.12, 2.28);
	const lamp = keepM(
		new THREE.MeshStandardMaterial({
			color: 0xffe08a,
			emissive: 0xffc46a,
			emissiveIntensity: 1.4,
			roughness: 0.3
		})
	);
	const hl = new THREE.Mesh(keepG(new THREE.BoxGeometry(0.38, 0.22, 0.12)), lamp);
	const hr = hl.clone();
	hl.position.set(-0.82, 1.18, 2.3);
	hr.position.set(0.82, 1.18, 2.3);
	const stack = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.09, 0.11, 1.8, 8)),
		keepM(std(0x334155))
	);
	stack.position.set(-1.15, 2.6, 0.1);
	const sleeper = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(2.45, 1.7, 1.4)),
		keepM(std(0x1d4ed8))
	);
	sleeper.position.set(0, 2.15, -0.85);
	sleeper.castShadow = true;
	cab.add(body, cabin, glass, bumper, grille, hl, hr, stack, sleeper);
	for (const x of [-0.95, 0.95]) {
		const wheel = new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.52, 0.52, 0.38, 12)),
			keepM(std(0x111827, { roughness: 0.85 }))
		);
		wheel.rotation.z = Math.PI / 2;
		wheel.position.set(x, 0.52, 1.35);
		cab.add(wheel);
	}
	root.add(cab);

	const trailer = new THREE.Group();
	const hitch = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8)),
		keepM(std(0x475569))
	);
	hitch.rotation.x = Math.PI / 2;
	hitch.position.set(0, 1.05, -2.15);
	const deck = new THREE.Mesh(keepG(new THREE.BoxGeometry(2.5, 0.28, 9.4)), keepM(std(0x334155)));
	deck.position.set(0, 1.12, -7.1);
	deck.castShadow = true;
	const box = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(2.42, 2.55, 8.6)),
		keepM(std(0xf8fafc, { roughness: 0.55 }))
	);
	box.position.set(0, 2.52, -7.2);
	box.castShadow = true;
	const stripe = new THREE.Mesh(
		keepG(new THREE.BoxGeometry(2.44, 0.18, 8.62)),
		keepM(std(0x14b8a6))
	);
	stripe.position.set(0, 2.05, -7.2);
	const coral = keepM(
		new THREE.MeshStandardMaterial({
			color: 0xfb7185,
			emissive: 0xf43f5e,
			emissiveIntensity: 0.9
		})
	);
	const tl = new THREE.Mesh(keepG(new THREE.BoxGeometry(0.28, 0.18, 0.1)), coral);
	const tr = tl.clone();
	tl.position.set(-0.9, 1.35, -11.82);
	tr.position.set(0.9, 1.35, -11.82);
	for (let i = 0; i < 3; i++) {
		const crate = new THREE.Mesh(
			keepG(new THREE.BoxGeometry(0.9, 0.7, 1.1)),
			keepM(std(i === 1 ? 0xf59e0b : 0xd97706))
		);
		crate.position.set(i === 1 ? 0.55 : -0.55, 3.95, -4.8 - i * 2.2);
		crate.castShadow = true;
		trailer.add(crate);
	}
	for (const z of [-4.4, -8.6]) {
		for (const x of [-0.95, 0.95]) {
			const wheel = new THREE.Mesh(
				keepG(new THREE.CylinderGeometry(0.5, 0.5, 0.38, 12)),
				keepM(std(0x111827))
			);
			wheel.rotation.z = Math.PI / 2;
			wheel.position.set(x, 0.5, z);
			trailer.add(wheel);
		}
	}
	trailer.add(hitch, deck, box, stripe, tl, tr);
	root.add(trailer);
	return { root, cab, trailer };
}

function makeTree() {
	const g = new THREE.Group();
	const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6), std(0x6b4f32));
	trunk.position.y = 0.8;
	const crown = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 6), std(0x3f8f6a));
	crown.position.y = 2.15;
	g.add(trunk, crown);
	return g;
}

function makeField() {
	const g = new THREE.Group();
	const pad = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.12, 4.2), std(0xc6b06a));
	pad.position.y = 0.04;
	g.add(pad);
	return g;
}

function makeBuilding(tall: boolean) {
	const g = new THREE.Group();
	const h = tall ? 8 + Math.random() * 6 : 4.5;
	const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, h, 3.4), std(tall ? 0x94a3b8 : 0xcbd5e1));
	body.position.y = h / 2;
	const windowMat = new THREE.MeshStandardMaterial({
		color: 0xfde68a,
		emissive: 0xfbbf24,
		emissiveIntensity: 0.35
	});
	for (let y = 1.2; y < h - 0.8; y += 1.4) {
		const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.08), windowMat);
		win.position.set(0, y, 1.74);
		g.add(win);
	}
	g.add(body);
	return g;
}

function makeSign() {
	const g = new THREE.Group();
	const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), std(0x64748b));
	pole.position.y = 1.6;
	const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.1), std(0x16a34a));
	board.position.y = 3.2;
	g.add(pole, board);
	return g;
}

function makeDummy() {
	const g = new THREE.Group();
	const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 3.6), std(0xf8fafc));
	body.position.y = 0.9;
	const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.2), std(0x60a5fa));
	cabin.position.set(0, 1.55, 0.7);
	g.add(body, cabin);
	return g;
}

export function mountCargoScene(canvas: HTMLCanvasElement): CargoScene | null {
	let renderer: InstanceType<typeof THREE.WebGLRenderer>;
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
	renderer.setClearColor(0xf0c49a, 1);

	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0xe7c9a8, 40, 220);
	const camera = new THREE.PerspectiveCamera(52, 1, 0.2, 420);
	const geos: Geo[] = [];
	const mats: Mat[] = [];

	const skyMat = new THREE.ShaderMaterial({
		vertexShader: SKY_VERT,
		fragmentShader: SKY_FRAG,
		side: THREE.BackSide,
		depthWrite: false,
		uniforms: {
			uTop: { value: col(0x6ea0d8) },
			uMid: { value: col(0xf3c49a) },
			uHor: { value: col(0xffd7b0) },
			uSunDir: { value: new THREE.Vector3(0.55, 0.28, -0.78).normalize() },
			uSunColor: { value: col(0xffd08a) }
		}
	});
	const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), skyMat);
	scene.add(sky);

	const hemi = new THREE.HemisphereLight(0xffe2c4, 0x6b8f6a, 0.78);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xffd19a, 1.35);
	sun.position.set(48, 32, -28);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.near = 4;
	sun.shadow.camera.far = 160;
	sun.shadow.camera.left = -40;
	sun.shadow.camera.right = 40;
	sun.shadow.camera.top = 40;
	sun.shadow.camera.bottom = -40;
	scene.add(sun);

	const ground = new THREE.Mesh(new THREE.CircleGeometry(180, 40), std(0x7f9b72, { roughness: 1 }));
	ground.rotation.x = -Math.PI / 2;
	ground.receiveShadow = true;
	scene.add(ground);

	const hills = new THREE.Group();
	for (let i = 0; i < 7; i++) {
		const hill = new THREE.Mesh(
			new THREE.SphereGeometry(28 + (i % 3) * 8, 12, 8),
			std(0x4f8f86, { roughness: 1 })
		);
		hill.scale.y = 0.38;
		hills.add(hill);
	}
	scene.add(hills);

	const roadGroup = new THREE.Group();
	scene.add(roadGroup);
	const roadMats: Record<Biome, Mat> = {
		highway: std(0x6d7178, { roughness: 0.92 }),
		city: std(0x5b616c, { roughness: 0.9 }),
		country: std(0x6a655c, { roughness: 0.95 })
	};
	const shoulderMat = std(0xd6d3c4, { roughness: 1 });
	const dashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
	mats.push(roadMats.highway, roadMats.city, roadMats.country, shoulderMat, dashMat);

	const roadMap = new Map<string, Group>();

	function syncRoads(world: HaulWorld) {
		const live = new Set(world.pieces.map((p) => p.id));
		for (const [id, group] of roadMap) {
			if (live.has(id)) continue;
			roadGroup.remove(group);
			group.traverse((obj: InstanceType<typeof THREE.Object3D>) => {
				const mesh = obj as Mesh;
				mesh.geometry?.dispose?.();
			});
			roadMap.delete(id);
		}
		for (const piece of world.pieces) {
			if (roadMap.has(piece.id)) continue;
			const g = new THREE.Group();
			const pavement = new THREE.Mesh(ribbon(piece, 0.06), roadMats[piece.biome]);
			pavement.receiveShadow = true;
			const shoulder = new THREE.Mesh(ribbon(piece, 0.03, piece.width / 2 + 1.7), shoulderMat);
			shoulder.receiveShadow = true;
			const line = new THREE.Mesh(ribbon(piece, 0.08, 0.08), dashMat);
			g.add(shoulder, pavement, line);
			roadGroup.add(g);
			roadMap.set(piece.id, g);
		}
	}

	const treePool: Group[] = Array.from({ length: 80 }, makeTree);
	const fieldPool: Group[] = Array.from({ length: 24 }, makeField);
	const buildPool: Group[] = Array.from({ length: 40 }, () => makeBuilding(true));
	const signPool: Group[] = Array.from({ length: 16 }, makeSign);
	const carPool: Group[] = Array.from({ length: 6 }, makeDummy);
	for (const g of [...treePool, ...fieldPool, ...buildPool, ...signPool, ...carPool]) {
		g.visible = false;
		scene.add(g);
	}

	function placeScenery(bits: SceneryBit[], pool: Group[], pred: (b: SceneryBit) => boolean) {
		let i = 0;
		for (const bit of bits) {
			if (!pred(bit) || i >= pool.length) continue;
			const g = pool[i++]!;
			g.visible = true;
			g.position.set(bit.x, 0, bit.z);
			g.rotation.y = bit.yaw;
		}
		for (; i < pool.length; i++) pool[i]!.visible = false;
	}

	const truck = makeTruck(geos, mats);
	scene.add(truck.root);

	const camPos = new THREE.Vector3(0, 8, -14);
	const look = new THREE.Vector3();
	let bob = 0;

	function sync(world: HaulWorld, opts?: { reducedMotion?: boolean }) {
		syncRoads(world);
		ground.position.set(world.x, 0, world.z);
		ground.material = ground.material as InstanceType<typeof THREE.MeshStandardMaterial>;
		(ground.material as InstanceType<typeof THREE.MeshStandardMaterial>).color.setHex(
			world.biome === 'city' ? 0x8b93a1 : world.biome === 'country' ? 0x7a9b62 : 0x7f9b72
		);
		hills.children.forEach((hill: InstanceType<typeof THREE.Object3D>, i: number) => {
			const a = (i / hills.children.length) * Math.PI * 2 + world.yaw;
			hill.position.set(world.x + Math.sin(a) * 150, -6, world.z + Math.cos(a) * 150);
		});
		sky.position.set(world.x, 0, world.z);
		placeScenery(
			world.trees,
			treePool,
			(b) => b.kind === 'tree' && (!world.lowDetail || world.trees.indexOf(b) % 2 === 0)
		);
		placeScenery(world.trees, fieldPool, (b) => b.kind === 'field');
		placeScenery(
			world.buildings,
			buildPool,
			(b) => b.kind === 'building' && (!world.lowDetail || world.buildings.indexOf(b) % 2 === 0)
		);
		placeScenery(world.buildings, signPool, (b) => b.kind === 'sign');
		carPool.forEach((g, i) => {
			const car = world.cars[i];
			if (!car) {
				g.visible = false;
				return;
			}
			const pose = dummyCarPose(world, car);
			if (!pose) {
				g.visible = false;
				return;
			}
			g.visible = true;
			g.position.set(pose.x, 0, pose.z);
			g.rotation.y = pose.yaw;
		});

		truck.root.position.set(world.x, world.onRoad ? 0 : -0.12, world.z);
		truck.cab.rotation.y = world.yaw;
		truck.trailer.position.set(world.x, 0, world.z);
		truck.trailer.rotation.y = world.trailerYaw;
		// keep trailer in the cab group space: actually both in root which is at truck xz
		truck.cab.position.set(0, 0, 0);
		truck.trailer.position.set(0, 0, 0);

		const aheadX = Math.sin(world.yaw);
		const aheadZ = Math.cos(world.yaw);
		const rightX = Math.cos(world.yaw);
		const rightZ = -Math.sin(world.yaw);
		const back = 16.8 + Math.min(5, Math.abs(world.speed) * 0.14);
		const height = 7.2 + Math.min(2.2, Math.abs(world.speed) * 0.06);
		bob += opts?.reducedMotion ? 0 : Math.abs(world.speed) * 0.002;
		const want = new THREE.Vector3(
			world.x - aheadX * back + rightX * 2.4,
			height + (opts?.reducedMotion ? 0 : Math.sin(bob) * 0.12),
			world.z - aheadZ * back + rightZ * 2.4
		);
		camPos.lerp(want, 0.12);
		look.set(world.x + aheadX * 12, 2.1, world.z + aheadZ * 12);
		camera.position.copy(camPos);
		camera.lookAt(look);
		sun.position.set(world.x + 48, 34, world.z - 28);
		sun.target.position.set(world.x, 0, world.z);
		sun.target.updateMatrixWorld();
		renderer.shadowMap.enabled = !world.lowDetail;
		scene.fog = new THREE.Fog(
			world.biome === 'city' ? 0xc5cdd8 : world.biome === 'country' ? 0xd5e4c4 : 0xe7c9a8,
			38,
			world.lowDetail ? 140 : 230
		);
	}

	function render(_now: number) {
		renderer.render(scene, camera);
	}

	function resize(opts?: { lowDetail?: boolean }) {
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		const dpr = opts?.lowDetail ? 1 : Math.min(window.devicePixelRatio || 1, w < 500 ? 1.15 : 1.6);
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.fov = camera.aspect < 0.8 ? 60 : 52;
		camera.updateProjectionMatrix();
	}

	function dispose() {
		renderer.dispose();
		sky.geometry.dispose();
		skyMat.dispose();
		ground.geometry.dispose();
		(ground.material as Mat).dispose();
		for (const g of geos) g.dispose();
		for (const m of mats) m.dispose();
		for (const [, group] of roadMap) {
			group.traverse((obj: InstanceType<typeof THREE.Object3D>) => {
				const mesh = obj as Mesh;
				mesh.geometry?.dispose?.();
			});
		}
	}

	resize();
	return { sync, render, resize, dispose };
}
