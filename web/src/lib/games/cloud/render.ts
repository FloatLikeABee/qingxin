import * as THREE from 'three';
import { WIND_TUBE, type FragKind, type Island, type SkyMode, type SkyWorld } from './sim';

export interface CloudScene {
	sync(world: SkyWorld, opts?: { reducedMotion?: boolean }): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	hitWalk(clientX: number, clientY: number): { x: number; z: number } | null;
}

type CloudGroup = InstanceType<typeof THREE.Group>;
type CloudMesh = InstanceType<typeof THREE.Mesh>;
type CloudGeo = InstanceType<typeof THREE.BufferGeometry>;
type CloudRenderer = InstanceType<typeof THREE.WebGLRenderer>;
type CloudPoints = InstanceType<typeof THREE.Points>;

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
	vec3 col = mix(uHor, uMid, smoothstep(-0.2, 0.22, h));
	col = mix(col, uTop, smoothstep(0.12, 0.82, h));
	float sun = pow(max(0.0, dot(n, normalize(uSunDir))), 42.0);
	float halo = pow(max(0.0, dot(n, normalize(uSunDir))), 6.0);
	col += uSunColor * (sun * 0.95 + halo * 0.18);
	gl_FragColor = vec4(col, 1.0);
}
`;

type Palette = {
	top: number;
	mid: number;
	hor: number;
	fog: number;
	hemiSky: number;
	hemiGround: number;
	sun: number;
	sunPos: [number, number, number];
	exposure: number;
	fill: number;
};

const PALETTES: Record<SkyMode, Palette> = {
	dawn: {
		top: 0x8eb4e8,
		mid: 0xf3c9a8,
		hor: 0xffd6c0,
		fog: 0xd7c4b8,
		hemiSky: 0xffe2c8,
		hemiGround: 0x8aa88a,
		sun: 0xffc08a,
		sunPos: [18, 9, -8],
		exposure: 1.08,
		fill: 0xffb38a
	},
	sun: {
		top: 0x6eb4ff,
		mid: 0xb5d9ff,
		hor: 0xffecc0,
		fog: 0xc8ddf5,
		hemiSky: 0xfff1c8,
		hemiGround: 0x8fbe74,
		sun: 0xffe08a,
		sunPos: [10, 16, 4],
		exposure: 1.22,
		fill: 0xffd27a
	},
	rain: {
		top: 0x5b6d82,
		mid: 0x7f93a8,
		hor: 0xa8b8c6,
		fog: 0x8a9aaa,
		hemiSky: 0xb4c4d4,
		hemiGround: 0x4f6a5c,
		sun: 0xc5d4e0,
		sunPos: [-6, 14, 8],
		exposure: 0.88,
		fill: 0x9bb0c4
	},
	breeze: {
		top: 0x8fd4c4,
		mid: 0xc8f0dc,
		hor: 0xe8ffe8,
		fog: 0xc9eadc,
		hemiSky: 0xd8ffe8,
		hemiGround: 0x7ab08a,
		sun: 0xe8ffd0,
		sunPos: [12, 12, -10],
		exposure: 1.12,
		fill: 0xb8f0c8
	},
	night: {
		top: 0x0b1024,
		mid: 0x1a2450,
		hor: 0x3a2a58,
		fog: 0x151a32,
		hemiSky: 0x4a5a88,
		hemiGround: 0x1a3040,
		sun: 0x9aa8ff,
		sunPos: [-10, 11, -6],
		exposure: 0.72,
		fill: 0x7a8cff
	}
};

function col(hex: number) {
	return new THREE.Color(hex);
}

function mat(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.62,
		metalness: 0.06,
		...extras
	});
}

function displaceCylinder(geo: CloudGeo, seed: number) {
	const pos = geo.getAttribute('position');
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		const n =
			Math.sin(x * 1.6 + seed) * Math.cos(z * 1.35 + seed * 0.7) * 0.16 +
			Math.sin((x + z) * 0.9 + seed) * 0.07;
		if (y > 0.05) pos.setXYZ(i, x + n * 0.35, y + n * 0.22, z + n * 0.35);
		else pos.setXYZ(i, x * (0.82 + n * 0.08), y, z * (0.82 + n * 0.08));
	}
	geo.computeVertexNormals();
	return geo;
}

export function mountCloudScene(canvas: HTMLCanvasElement): CloudScene | null {
	let renderer: CloudRenderer;
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
	renderer.setClearColor(0xb8c8dc, 1);

	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0xd7c4b8, 0.011);
	const camera = new THREE.PerspectiveCamera(46, 1, 0.12, 220);
	camera.position.set(-2.4, 5.6, 11.2);
	camera.lookAt(2.5, 1.2, 0);

	const geos: CloudGeo[] = [];
	const mats: Array<{ dispose: () => void }> = [];
	const keepGeo = <T extends CloudGeo>(g: T) => {
		geos.push(g);
		return g;
	};
	const keepMat = <T extends { dispose: () => void }>(m: T) => {
		mats.push(m);
		return m;
	};

	const sphere = keepGeo(new THREE.SphereGeometry(1, 28, 20));
	const sphereLo = keepGeo(new THREE.SphereGeometry(1, 12, 10));
	const ico = keepGeo(new THREE.IcosahedronGeometry(1, 1));
	const icoHi = keepGeo(new THREE.IcosahedronGeometry(1, 2));
	const cyl = keepGeo(new THREE.CylinderGeometry(1, 1, 1, 10));
	const cone = keepGeo(new THREE.ConeGeometry(1, 1, 8));
	const box = keepGeo(new THREE.BoxGeometry(1, 1, 1));
	const cap = keepGeo(new THREE.CircleGeometry(1, 48));
	const octa = keepGeo(new THREE.OctahedronGeometry(1, 0));

	const skyUniforms = {
		uTop: { value: col(PALETTES.dawn.top) },
		uMid: { value: col(PALETTES.dawn.mid) },
		uHor: { value: col(PALETTES.dawn.hor) },
		uSunDir: { value: new THREE.Vector3(18, 9, -8).normalize() },
		uSunColor: { value: col(PALETTES.dawn.sun) }
	};
	const skyMat = keepMat(
		new THREE.ShaderMaterial({
			vertexShader: SKY_VERT,
			fragmentShader: SKY_FRAG,
			uniforms: skyUniforms,
			side: THREE.BackSide,
			depthWrite: false,
			fog: false
		})
	);
	const sky = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(1, 32, 24)), skyMat);
	sky.scale.setScalar(90);
	scene.add(sky);

	const hemi = new THREE.HemisphereLight(PALETTES.dawn.hemiSky, PALETTES.dawn.hemiGround, 0.72);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(PALETTES.dawn.sun, 1.55);
	sun.position.set(...PALETTES.dawn.sunPos);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.near = 2;
	sun.shadow.camera.far = 70;
	sun.shadow.camera.left = -28;
	sun.shadow.camera.right = 28;
	sun.shadow.camera.top = 22;
	sun.shadow.camera.bottom = -18;
	scene.add(sun);
	const fill = new THREE.PointLight(PALETTES.dawn.fill, 22, 40, 1.5);
	fill.position.set(4, 6, 6);
	scene.add(fill);
	const rim = new THREE.PointLight(0xa8d8ff, 16, 36, 1.7);
	rim.position.set(-8, 5, -4);
	scene.add(rim);

	const walkMeshes: CloudMesh[] = [];
	const camTarget = new THREE.Vector3(0, 1.2, 0);
	const camPos = new THREE.Vector3(-2.4, 5.6, 11.2);

	function addWalk(mesh: CloudMesh) {
		mesh.userData.walk = true;
		walkMeshes.push(mesh);
		return mesh;
	}

	function islandGroup(isle: Island, look: 'home' | 'sun' | 'rain' | 'wild') {
		const g = new THREE.Group();
		g.position.set(isle.x, isle.y, isle.z);
		const segs = 28;
		const rockGeo = keepGeo(
			displaceCylinder(
				new THREE.CylinderGeometry(isle.r, isle.r * 0.62, 1.7, segs, 4, true),
				isle.id * 2.1
			)
		);
		const grass: Record<typeof look, number> = {
			home: 0x6fbf6a,
			sun: 0xe2c45a,
			rain: 0x3f9a72,
			wild: 0x9dce6e
		};
		const stone: Record<typeof look, number> = {
			home: 0xcbb79a,
			sun: 0xd4a574,
			rain: 0x6a7b8c,
			wild: 0xb8a28c
		};
		const rock = new THREE.Mesh(rockGeo, keepMat(mat(stone[look], { roughness: 0.88 })));
		rock.position.y = -0.72;
		rock.castShadow = true;
		rock.receiveShadow = true;
		g.add(addWalk(rock));
		const top = new THREE.Mesh(
			cap,
			keepMat(
				mat(grass[look], {
					roughness: 0.78,
					polygonOffset: true,
					polygonOffsetFactor: -1,
					polygonOffsetUnits: -1
				})
			)
		);
		top.rotation.x = -Math.PI / 2;
		top.position.y = 0.08;
		top.scale.setScalar(isle.r * 1.04);
		top.receiveShadow = true;
		g.add(addWalk(top));
		const under = new THREE.Mesh(cone, keepMat(mat(stone[look], { roughness: 0.95 })));
		under.position.y = -1.85;
		under.scale.set(isle.r * 0.7, 1.7, isle.r * 0.7);
		under.rotation.x = Math.PI;
		g.add(under);
		if (look === 'home') {
			const hut = new THREE.Group();
			const wall = new THREE.Mesh(box, keepMat(mat(0xf3e6d0)));
			wall.scale.set(1.1, 0.85, 0.9);
			wall.position.y = 0.5;
			wall.castShadow = true;
			hut.add(wall);
			const roof = new THREE.Mesh(cone, keepMat(mat(0xd97a5a, { roughness: 0.55 })));
			roof.position.y = 1.18;
			roof.scale.set(1.05, 0.7, 1.05);
			roof.castShadow = true;
			hut.add(roof);
			hut.position.set(1.35, 0, 0.9);
			g.add(hut);
			for (let i = 0; i < 3; i++) {
				const tree = new THREE.Group();
				const trunk = new THREE.Mesh(cyl, keepMat(mat(0x8b5a3c)));
				trunk.scale.set(0.08, 0.55, 0.08);
				trunk.position.y = 0.28;
				tree.add(trunk);
				const leaf = new THREE.Mesh(ico, keepMat(mat(0x3f9a5a)));
				leaf.position.y = 0.7;
				leaf.scale.setScalar(0.38 + i * 0.05);
				leaf.castShadow = true;
				tree.add(leaf);
				tree.position.set(-1.6 + i * 0.55, 0, 1.7 - i * 0.35);
				g.add(tree);
			}
		}
		if (look === 'sun') {
			for (let i = 0; i < 4; i++) {
				const crystal = new THREE.Mesh(
					octa,
					keepMat(mat(0xfde68a, { emissive: 0xfbbf24, emissiveIntensity: 0.55, roughness: 0.22 }))
				);
				const a = (i / 4) * Math.PI * 2;
				crystal.position.set(Math.cos(a) * 1.4, 0.42, Math.sin(a) * 1.4);
				crystal.scale.set(0.16, 0.38, 0.16);
				crystal.castShadow = true;
				g.add(crystal);
			}
		}
		if (look === 'rain') {
			for (let i = 0; i < 5; i++) {
				const puddle = new THREE.Mesh(
					cap,
					keepMat(
						mat(0x7dd3fc, {
							transparent: true,
							opacity: 0.45,
							roughness: 0.12,
							metalness: 0.35
						})
					)
				);
				puddle.rotation.x = -Math.PI / 2;
				puddle.position.set((i - 2) * 0.7, 0.08, (i % 2) * 0.8 - 0.4);
				puddle.scale.setScalar(0.45);
				g.add(puddle);
			}
		}
		if (look === 'wild') {
			for (let i = 0; i < 6; i++) {
				const puff = new THREE.Mesh(
					sphereLo,
					keepMat(mat(i % 2 ? 0xf9a8d4 : 0xc4b5fd, { roughness: 0.5 }))
				);
				const a = (i / 6) * Math.PI * 2;
				puff.position.set(Math.cos(a) * 2.1, 0.22, Math.sin(a) * 2.1);
				puff.scale.set(0.22, 0.16, 0.22);
				g.add(puff);
			}
		}
		scene.add(g);
		return g;
	}

	const looks = ['home', 'sun', 'rain', 'wild'] as const;
	for (const isle of [
		{ id: 0, name: 'home', x: 0, z: 0, y: 0, r: 3.6 },
		{ id: 1, name: 'sun terrace', x: 12, z: 0.4, y: 1.15, r: 2.6 },
		{ id: 2, name: 'rain meadow', x: 22.5, z: 1.2, y: 0.45, r: 3.1 },
		{ id: 3, name: 'creature isle', x: 4.5, z: -12, y: 0.7, r: 3.4 }
	] satisfies Island[]) {
		islandGroup(isle, looks[isle.id] ?? 'home');
	}

	const farRoot = new THREE.Group();
	scene.add(farRoot);
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		const r = 32 + (i % 3) * 4;
		const isle: Island = {
			id: 10 + i,
			name: 'far',
			x: Math.cos(a) * r,
			z: Math.sin(a) * r * 0.86,
			y: 3.2 + Math.sin(i * 1.7) * 2.8,
			r: 2.4 + (i % 3)
		};
		const g = new THREE.Group();
		g.position.set(isle.x, isle.y, isle.z);
		const rock = new THREE.Mesh(
			keepGeo(new THREE.CylinderGeometry(isle.r, isle.r * 0.6, 1.2, 12, 2)),
			keepMat(mat(0xc2b6a4, { roughness: 0.92 }))
		);
		rock.position.y = -0.5;
		g.add(rock);
		const top = new THREE.Mesh(cap, keepMat(mat(i % 2 ? 0x8fce7a : 0xd6c48a)));
		top.rotation.x = -Math.PI / 2;
		top.scale.setScalar(isle.r);
		g.add(top);
		farRoot.add(g);
	}

	const cloudMat = keepMat(
		mat(0xf8fafc, {
			transparent: true,
			opacity: 0.72,
			roughness: 0.95,
			depthWrite: false
		})
	);
	const cloudField = new THREE.Group();
	scene.add(cloudField);
	for (let i = 0; i < 22; i++) {
		const puff = new THREE.Mesh(i % 3 ? ico : sphereLo, cloudMat);
		const a = (i / 22) * Math.PI * 2 + 0.4;
		const radius = 18 + (i % 5) * 3.4;
		puff.position.set(Math.cos(a) * radius, 6.2 + (i % 4) * 1.5, Math.sin(a) * radius * 0.88);
		const s = 1.8 + (i % 4) * 0.55;
		puff.scale.set(s * 1.6, s * 0.42, s);
		cloudField.add(puff);
	}

	function bounceCloud(x: number, y: number, z: number, r: number) {
		const g = new THREE.Group();
		g.position.set(x, y, z);
		for (let i = 0; i < 6; i++) {
			const puff = new THREE.Mesh(
				icoHi,
				keepMat(
					mat(0xffffff, {
						transparent: true,
						opacity: 0.78,
						roughness: 0.9,
						emissive: 0xdbeafe,
						emissiveIntensity: 0.12
					})
				)
			);
			const a = (i / 6) * Math.PI * 2;
			puff.position.set(Math.cos(a) * r * 0.35, (i % 2) * 0.18, Math.sin(a) * r * 0.28);
			puff.scale.set(r * 0.55, r * 0.32, r * 0.5);
			puff.castShadow = true;
			g.add(puff);
		}
		scene.add(g);
		return g;
	}
	const bounceA = bounceCloud(15.55, 0.88, 0.7, 1.58);
	const bounceB = bounceCloud(18.9, 1.12, 1.0, 1.48);

	const windGroup = new THREE.Group();
	const wa = new THREE.Vector3(WIND_TUBE.ax, WIND_TUBE.ay + 0.5, WIND_TUBE.az);
	const wb = new THREE.Vector3(WIND_TUBE.bx, WIND_TUBE.by + 0.5, WIND_TUBE.bz);
	const wdir = wb.clone().sub(wa);
	const wlen = wdir.length();
	const tube = new THREE.Mesh(
		keepGeo(new THREE.CylinderGeometry(WIND_TUBE.r, WIND_TUBE.r * 0.82, wlen, 20, 1, true)),
		keepMat(
			new THREE.MeshStandardMaterial({
				color: 0x7dd3fc,
				transparent: true,
				opacity: 0.18,
				emissive: 0x38bdf8,
				emissiveIntensity: 0.35,
				side: THREE.DoubleSide,
				depthWrite: false
			})
		)
	);
	tube.position.copy(wa.clone().add(wb).multiplyScalar(0.5));
	tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wdir.clone().normalize());
	windGroup.add(tube);
	const streakCount = 90;
	const streakGeo = keepGeo(new THREE.BufferGeometry());
	const streakPos = new Float32Array(streakCount * 3);
	for (let i = 0; i < streakCount; i++) {
		const t = i / streakCount;
		streakPos[i * 3] = THREE.MathUtils.lerp(WIND_TUBE.ax, WIND_TUBE.bx, t);
		streakPos[i * 3 + 1] = THREE.MathUtils.lerp(WIND_TUBE.ay, WIND_TUBE.by, t) + 0.45;
		streakPos[i * 3 + 2] = THREE.MathUtils.lerp(WIND_TUBE.az, WIND_TUBE.bz, t);
	}
	streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
	const streaks: CloudPoints = new THREE.Points(
		streakGeo,
		keepMat(
			new THREE.PointsMaterial({
				color: 0xe0f2fe,
				size: 0.12,
				transparent: true,
				opacity: 0.85,
				depthWrite: false
			})
		)
	);
	windGroup.add(streaks);
	scene.add(windGroup);

	const walker = new THREE.Group();
	const body = new THREE.Mesh(sphere, keepMat(mat(0xf8fafc)));
	body.scale.set(0.28, 0.38, 0.26);
	body.position.y = 0.62;
	body.castShadow = true;
	walker.add(body);
	const head = new THREE.Mesh(sphere, keepMat(mat(0xffe4d6)));
	head.scale.setScalar(0.2);
	head.position.y = 1.02;
	head.castShadow = true;
	walker.add(head);
	const scarf = new THREE.Mesh(box, keepMat(mat(0xfb7185, { roughness: 0.45 })));
	scarf.name = 'scarf';
	scarf.scale.set(0.08, 0.36, 0.04);
	scarf.position.set(0.12, 0.72, -0.12);
	walker.add(scarf);
	const pack = new THREE.Mesh(box, keepMat(mat(0x7dd3fc)));
	pack.scale.set(0.18, 0.22, 0.08);
	pack.position.set(0, 0.66, 0.16);
	walker.add(pack);
	scene.add(walker);

	const fragMeshes: CloudMesh[] = [];
	const fragGlow: InstanceType<typeof THREE.PointLight>[] = [];
	const fragColor: Record<FragKind, number> = {
		sun: 0xfbbf24,
		rain: 0x38bdf8,
		breeze: 0x34d399,
		night: 0xa78bfa
	};

	const plantRoot = new THREE.Group();
	scene.add(plantRoot);
	const plants = new Map<FragKind, CloudGroup>();

	function plantMesh(kind: FragKind) {
		const g = new THREE.Group();
		const stem = new THREE.Mesh(cyl, keepMat(mat(0x4d7c0f)));
		stem.scale.set(0.05, 0.7, 0.05);
		stem.position.y = 0.35;
		g.add(stem);
		if (kind === 'sun') {
			const bloom = new THREE.Mesh(
				octa,
				keepMat(mat(0xfde68a, { emissive: 0xf59e0b, emissiveIntensity: 0.7 }))
			);
			bloom.position.y = 0.78;
			bloom.scale.set(0.28, 0.22, 0.28);
			g.add(bloom);
		} else if (kind === 'rain') {
			for (let i = 0; i < 3; i++) {
				const drop = new THREE.Mesh(
					cone,
					keepMat(mat(0x38bdf8, { transparent: true, opacity: 0.8 }))
				);
				drop.position.set((i - 1) * 0.12, 0.62, 0);
				drop.scale.set(0.08, 0.22, 0.08);
				g.add(drop);
			}
		} else if (kind === 'breeze') {
			for (let i = 0; i < 5; i++) {
				const blade = new THREE.Mesh(box, keepMat(mat(0x86efac)));
				blade.position.set((i - 2) * 0.08, 0.45, 0);
				blade.scale.set(0.03, 0.55 + i * 0.04, 0.01);
				blade.rotation.z = (i - 2) * 0.18;
				g.add(blade);
			}
		} else {
			const orb = new THREE.Mesh(
				sphereLo,
				keepMat(mat(0xc4b5fd, { emissive: 0x7c3aed, emissiveIntensity: 0.85 }))
			);
			orb.position.y = 0.72;
			orb.scale.setScalar(0.16);
			g.add(orb);
			const glow = new THREE.PointLight(0xa78bfa, 4, 3.5, 2);
			glow.position.y = 0.8;
			g.add(glow);
		}
		return g;
	}

	const creatureRoot = new THREE.Group();
	scene.add(creatureRoot);
	const creatureMap = new Map<number, CloudGroup>();

	function rig(kind: SkyWorld['creatures'][number]['kind']) {
		const g = new THREE.Group();
		if (kind === 'puff') {
			for (let i = 0; i < 3; i++) {
				const p = new THREE.Mesh(sphere, keepMat(mat(0xf8fafc, { roughness: 0.9 })));
				p.scale.set(0.32 + i * 0.04, 0.24, 0.3);
				p.position.set((i - 1) * 0.18, 0.22, 0);
				p.castShadow = true;
				g.add(p);
			}
		} else if (kind === 'kite') {
			const bodyK = new THREE.Mesh(
				octa,
				keepMat(mat(0xfb7185, { emissive: 0xf43f5e, emissiveIntensity: 0.25 }))
			);
			bodyK.scale.set(0.22, 0.42, 0.08);
			bodyK.castShadow = true;
			g.add(bodyK);
			const wingL = new THREE.Mesh(cone, keepMat(mat(0xfda4af)));
			wingL.name = 'wingL';
			wingL.rotation.z = 0.9;
			wingL.position.set(-0.28, 0.05, 0);
			wingL.scale.set(0.16, 0.45, 0.08);
			g.add(wingL);
			const wingR = wingL.clone();
			wingR.name = 'wingR';
			wingR.rotation.z = -0.9;
			wingR.position.x = 0.28;
			g.add(wingR);
		} else {
			const torso = new THREE.Mesh(sphere, keepMat(mat(0xf1f5f9)));
			torso.scale.set(0.38, 0.28, 0.3);
			torso.position.y = 0.32;
			torso.castShadow = true;
			g.add(torso);
			const face = new THREE.Mesh(sphereLo, keepMat(mat(0xffe4e6)));
			face.scale.setScalar(0.16);
			face.position.set(0.22, 0.38, 0.12);
			g.add(face);
			for (let i = 0; i < 4; i++) {
				const leg = new THREE.Mesh(cyl, keepMat(mat(0xe2e8f0)));
				leg.scale.set(0.04, 0.18, 0.04);
				leg.position.set(i < 2 ? -0.12 : 0.12, 0.1, i % 2 ? 0.1 : -0.1);
				g.add(leg);
			}
		}
		return g;
	}

	const starGeo = keepGeo(new THREE.BufferGeometry());
	const starCount = 120;
	const starPos = new Float32Array(starCount * 3);
	for (let i = 0; i < starCount; i++) {
		const a = Math.random() * Math.PI * 2;
		const h = 12 + Math.random() * 40;
		starPos[i * 3] = Math.cos(a) * (20 + Math.random() * 50);
		starPos[i * 3 + 1] = h;
		starPos[i * 3 + 2] = Math.sin(a) * (20 + Math.random() * 50);
	}
	starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
	const stars = new THREE.Points(
		starGeo,
		keepMat(
			new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.18, transparent: true, opacity: 0.85 })
		)
	);
	stars.visible = false;
	scene.add(stars);

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const hit = new THREE.Vector3();

	let reduceMotion = false;
	let lowDetail = false;
	let skyMode: SkyMode = 'dawn';

	function applyPalette(mode: SkyMode) {
		const p = PALETTES[mode];
		skyUniforms.uTop.value.set(p.top);
		skyUniforms.uMid.value.set(p.mid);
		skyUniforms.uHor.value.set(p.hor);
		skyUniforms.uSunColor.value.set(p.sun);
		skyUniforms.uSunDir.value.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]).normalize();
		(scene.fog as InstanceType<typeof THREE.FogExp2>).color.set(p.fog);
		hemi.color.set(p.hemiSky);
		hemi.groundColor.set(p.hemiGround);
		sun.color.set(p.sun);
		sun.position.set(...p.sunPos);
		fill.color.set(p.fill);
		renderer.toneMappingExposure = p.exposure;
		renderer.setClearColor(p.fog, 1);
		stars.visible = mode === 'night' || mode === 'dawn';
		skyMode = mode;
	}

	function applyDetail(world: SkyWorld) {
		const next = world.lowDetail || reduceMotion;
		if (next === lowDetail) return;
		lowDetail = next;
		renderer.shadowMap.enabled = !lowDetail;
		sun.castShadow = !lowDetail;
		farRoot.visible = !lowDetail;
		cloudField.visible = true;
		cloudField.children.forEach((child: InstanceType<typeof THREE.Object3D>, i: number) => {
			child.visible = !lowDetail || i % 3 === 0;
		});
		(streaks.material as InstanceType<typeof THREE.PointsMaterial>).size = lowDetail ? 0.08 : 0.12;
	}

	function ensureFrags(world: SkyWorld) {
		while (fragMeshes.length < world.fragments.length) {
			const i = fragMeshes.length;
			const kind = world.fragments[i]!.kind;
			const mesh = new THREE.Mesh(
				icoHi,
				keepMat(
					mat(fragColor[kind], {
						emissive: fragColor[kind],
						emissiveIntensity: 0.85,
						roughness: 0.22
					})
				)
			);
			mesh.scale.setScalar(0.22);
			mesh.castShadow = true;
			scene.add(mesh);
			fragMeshes.push(mesh);
			const light = new THREE.PointLight(fragColor[kind], 8, 6, 2);
			scene.add(light);
			fragGlow.push(light);
		}
		for (let i = 0; i < world.fragments.length; i++) {
			const frag = world.fragments[i]!;
			const mesh = fragMeshes[i]!;
			const light = fragGlow[i]!;
			mesh.visible = !frag.collected;
			light.visible = !frag.collected && !lowDetail;
			const bob = reduceMotion ? 0 : Math.sin(world.t / 380 + i) * 0.12;
			mesh.position.set(frag.x, frag.y + bob, frag.z);
			light.position.copy(mesh.position);
			mesh.rotation.y = world.t / 700 + i;
		}
	}

	function ensurePlants(world: SkyWorld) {
		for (const plant of world.garden) {
			let g = plants.get(plant.kind);
			if (!g) {
				g = plantMesh(plant.kind);
				plants.set(plant.kind, g);
				plantRoot.add(g);
			}
			g.visible = true;
			g.position.set(plant.x, 0.02, plant.z);
			const s = 0.35 + plant.grown * 0.9;
			g.scale.setScalar(s);
		}
	}

	function ensureCreatures(world: SkyWorld) {
		for (const c of world.creatures) {
			let g = creatureMap.get(c.id);
			if (!g) {
				g = rig(c.kind);
				creatureMap.set(c.id, g);
				creatureRoot.add(g);
			}
			const bob = reduceMotion ? 0 : Math.sin(world.t / 420 + c.id) * 0.08;
			g.position.set(c.x, 0.7 + bob + (c.kind === 'kite' ? 0.55 : 0), c.z);
			g.rotation.y = c.heading;
			g.scale.setScalar(c.discovered ? 1 : 0.92);
		}
	}

	function follow(world: SkyWorld) {
		const dist = 8.2;
		const height = 4.9;
		camPos.set(
			world.x - Math.sin(world.yaw || 0.15) * dist,
			world.y + height,
			world.z - Math.cos(world.yaw || 0.15) * dist
		);
		camTarget.set(world.x, world.y + 1.05, world.z);
		if (reduceMotion) {
			camera.position.copy(camPos);
		} else {
			camera.position.lerp(camPos, 0.085);
		}
		camera.lookAt(camTarget);
	}

	function sync(world: SkyWorld, opts?: { reducedMotion?: boolean }) {
		if (opts?.reducedMotion != null) reduceMotion = opts.reducedMotion;
		applyDetail(world);
		if (world.skyMode !== skyMode) applyPalette(world.skyMode);
		walker.position.set(world.x, world.y + 0.08, world.z);
		walker.rotation.y = world.yaw;
		const scarfMesh = walker.getObjectByName('scarf');
		if (scarfMesh) {
			scarfMesh.rotation.z = reduceMotion ? 0.2 : Math.sin(world.t / 180) * 0.35;
		}
		ensureFrags(world);
		ensurePlants(world);
		ensureCreatures(world);
		follow(world);
		bounceA.position.y = 0.88 + (reduceMotion ? 0 : Math.sin(world.t / 520) * 0.08);
		bounceB.position.y = 1.12 + (reduceMotion ? 0 : Math.cos(world.t / 480) * 0.08);
		windGroup.visible = true;
		(tube.material as InstanceType<typeof THREE.MeshStandardMaterial>).opacity = world.inWind
			? 0.32
			: 0.16;
	}

	function render(now: number) {
		const t = now / 1000;
		if (!reduceMotion) {
			cloudField.rotation.y = t * 0.012;
			const pos = streakGeo.getAttribute('position');
			for (let i = 0; i < streakCount; i++) {
				let u = (((i / streakCount + t * 0.18) % 1) + 1) % 1;
				const wob = Math.sin(t * 2.1 + i) * 0.22;
				pos.setXYZ(
					i,
					THREE.MathUtils.lerp(WIND_TUBE.ax, WIND_TUBE.bx, u) + wob * 0.15,
					THREE.MathUtils.lerp(WIND_TUBE.ay, WIND_TUBE.by, u) + 0.45 + Math.cos(t + i) * 0.12,
					THREE.MathUtils.lerp(WIND_TUBE.az, WIND_TUBE.bz, u) + wob
				);
			}
			pos.needsUpdate = true;
			for (const [, g] of creatureMap) {
				const wingL = g.getObjectByName('wingL');
				const wingR = g.getObjectByName('wingR');
				const flap = Math.sin(t * 3.2) * 0.35;
				if (wingL) wingL.rotation.z = 0.9 + flap;
				if (wingR) wingR.rotation.z = -0.9 - flap;
			}
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

	function hitWalk(clientX: number, clientY: number) {
		if (!setPointer(clientX, clientY)) return null;
		const hits = raycaster.intersectObjects(walkMeshes, false);
		if (hits[0]) return { x: hits[0].point.x, z: hits[0].point.z };
		const point = raycaster.ray.intersectPlane(walkPlane, hit);
		if (!point) return null;
		return { x: point.x, z: point.z };
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
		creatureMap.clear();
		plants.clear();
	}

	applyPalette('dawn');
	resize();
	return { sync, render, resize, dispose, hitWalk };
}
