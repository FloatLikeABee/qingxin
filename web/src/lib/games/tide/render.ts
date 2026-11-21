import * as THREE from 'three';
import type { CoralPatch, Creature, HaulKind, TideWorld } from './sim';
import {
	CONSTELLATIONS,
	TIDE_CAMERA,
	TIDE_MOON,
	constellationLinePositions,
	fillSkyStarPositions,
	skyStarCount
} from './sky';

export interface TideScene {
	sync(world: TideWorld, opts?: { reducedMotion?: boolean }): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	hitWater(clientX: number, clientY: number): { x: number; z: number } | null;
	pickCreature(clientX: number, clientY: number): number | null;
}

const WATER_VERT = /* glsl */ `
uniform float uTime;
uniform float uSwell;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vPos;
varying float vCrest;
void main() {
	vUv = uv;
	vec3 p = position;
	float amp = 0.14 + uSwell * 0.78;
	float w1 = sin(p.x * 0.42 + uTime * 0.9) * amp;
	float w2 = sin(p.z * 0.31 + uTime * 0.58 + uPulse * 2.8) * (0.09 + uSwell * 0.42);
	float w3 = sin((p.x + p.z) * 0.52 + uTime * 1.12) * 0.07;
	p.y += w1 + w2 + w3;
	vCrest = w1 + w2;
	vPos = p;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const WATER_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uMoon;
varying vec2 vUv;
varying vec3 vPos;
varying float vCrest;
void main() {
	float foam = smoothstep(0.16, 0.46, vCrest);
	float depth = clamp(0.28 + vPos.y * 0.55, 0.0, 1.0);
	vec3 col = mix(uDeep, uShallow, depth);
	col = mix(col, vec3(0.78, 0.9, 1.0), foam * 0.62);
	float spec = pow(max(0.0, 0.35 + vCrest * 1.4), 5.0);
	col += vec3(0.62, 0.72, 0.98) * spec * 0.28;
	float sparkle = pow(max(0.0, sin(vPos.x * 2.4 + vPos.z * 1.7) * 0.5 + 0.5), 12.0);
	col += vec3(0.75, 0.84, 1.0) * sparkle * 0.14;
	gl_FragColor = vec4(col, 0.96);
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
	vDir = position;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
void main() {
	float h = normalize(vDir).y * 0.5 + 0.5;
	vec3 top = vec3(0.008, 0.012, 0.035);
	vec3 mid = vec3(0.03, 0.05, 0.12);
	vec3 hor = vec3(0.07, 0.11, 0.22);
	vec3 col = mix(hor, mix(mid, top, smoothstep(0.45, 0.95, h)), smoothstep(0.12, 0.68, h));
	gl_FragColor = vec4(col, 1.0);
}
`;

type TideGroup = InstanceType<typeof THREE.Group>;
type TideGeo = InstanceType<typeof THREE.BufferGeometry>;
type TideObj = InstanceType<typeof THREE.Object3D>;
type TideRenderer = InstanceType<typeof THREE.WebGLRenderer>;
type TidePointsMat = InstanceType<typeof THREE.PointsMaterial>;

function mat(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.55,
		metalness: 0.08,
		...extras
	});
}

export function mountTideScene(canvas: HTMLCanvasElement): TideScene | null {
	let renderer: TideRenderer;
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
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor(0x070b14, 1);

	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x0b1220, 0.01);
	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
	camera.position.set(...TIDE_CAMERA.position);
	camera.lookAt(...TIDE_CAMERA.lookAt);

	const geos: TideGeo[] = [];
	const mats: Array<{ dispose: () => void }> = [];
	const keepGeo = <T extends TideGeo>(g: T) => {
		geos.push(g);
		return g;
	};
	const keepMat = <T extends { dispose: () => void }>(m: T) => {
		mats.push(m);
		return m;
	};

	const sphere = keepGeo(new THREE.SphereGeometry(1, 24, 18));
	const sphereLo = keepGeo(new THREE.SphereGeometry(1, 12, 10));
	const cyl = keepGeo(new THREE.CylinderGeometry(1, 1, 1, 8));
	const cone = keepGeo(new THREE.ConeGeometry(1, 1, 8));
	const ico = keepGeo(new THREE.IcosahedronGeometry(1, 1));
	const torus = keepGeo(new THREE.TorusGeometry(1, 0.38, 8, 16));

	const hemi = new THREE.HemisphereLight(0x8ec9ff, 0x0b3a4a, 0.55);
	scene.add(hemi);
	const moon = new THREE.DirectionalLight(0xdbe7ff, 1.35);
	moon.position.set(...TIDE_MOON);
	moon.castShadow = true;
	moon.shadow.mapSize.set(1024, 1024);
	moon.shadow.camera.near = 1;
	moon.shadow.camera.far = 28;
	moon.shadow.camera.left = -12;
	moon.shadow.camera.right = 12;
	moon.shadow.camera.top = 10;
	moon.shadow.camera.bottom = -8;
	scene.add(moon);
	const fill = new THREE.PointLight(0x3b82f6, 18, 28, 1.6);
	fill.position.set(3.2, 2.4, 2);
	scene.add(fill);
	const bio = new THREE.PointLight(0x67e8f9, 10, 16, 1.8);
	bio.position.set(-2.4, 1.2, -1);
	scene.add(bio);

	const skyMat = keepMat(
		new THREE.ShaderMaterial({
			vertexShader: SKY_VERT,
			fragmentShader: SKY_FRAG,
			side: THREE.BackSide,
			depthWrite: false
		})
	);
	const sky = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(40, 24, 16)), skyMat);
	scene.add(sky);

	const moonBall = new THREE.Mesh(
		sphere,
		keepMat(mat(0xf8fafc, { emissive: 0xf8fafc, emissiveIntensity: 0.85, roughness: 0.35 }))
	);
	moonBall.position.copy(moon.position);
	moonBall.scale.setScalar(1.15);
	scene.add(moonBall);
	const moonGlow = new THREE.Mesh(
		sphere,
		keepMat(
			mat(0xbfdbfe, {
				emissive: 0x93c5fd,
				emissiveIntensity: 0.9,
				transparent: true,
				opacity: 0.18,
				roughness: 1
			})
		)
	);
	moonGlow.position.copy(moon.position);
	moonGlow.scale.setScalar(2.4);
	scene.add(moonGlow);

	const starGeo = keepGeo(new THREE.BufferGeometry());
	const starMax = skyStarCount(false);
	const starPos = new Float32Array(starMax * 3);
	fillSkyStarPositions(starMax, starPos);
	starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
	const stars = new THREE.Points(
		starGeo,
		keepMat(
			new THREE.PointsMaterial({
				color: 0xf8fbff,
				size: 2.4,
				transparent: true,
				opacity: 1,
				depthWrite: false,
				fog: false,
				sizeAttenuation: false
			})
		)
	);
	stars.frustumCulled = false;
	scene.add(stars);

	const constellationRoot = new THREE.Group();
	constellationRoot.name = 'constellations';
	for (const constellation of CONSTELLATIONS) {
		const geo = keepGeo(new THREE.BufferGeometry());
		geo.setAttribute(
			'position',
			new THREE.BufferAttribute(constellationLinePositions(constellation), 3)
		);
		const lines = new THREE.LineSegments(
			geo,
			keepMat(
				new THREE.LineBasicMaterial({
					color: 0xe9d5ff,
					transparent: true,
					opacity: 0.95,
					depthWrite: false,
					fog: false
				})
			)
		);
		lines.name = `constellation-${constellation.name}`;
		lines.frustumCulled = false;
		constellationRoot.add(lines);
		const dotGeo = keepGeo(new THREE.BufferGeometry());
		const dots = new Float32Array(constellation.points.length * 3);
		constellation.points.forEach((point, i) => {
			dots[i * 3] = point[0];
			dots[i * 3 + 1] = point[1];
			dots[i * 3 + 2] = point[2];
		});
		dotGeo.setAttribute('position', new THREE.BufferAttribute(dots, 3));
		constellationRoot.add(
			new THREE.Points(
				dotGeo,
				keepMat(
					new THREE.PointsMaterial({
						color: 0xf5f3ff,
						size: 5,
						transparent: true,
						opacity: 1,
						depthWrite: false,
						fog: false,
						sizeAttenuation: false
					})
				)
			)
		);
	}
	scene.add(constellationRoot);

	const waterSeg = 96;
	const waterUniforms = {
		uTime: { value: 0 },
		uSwell: { value: 0.08 },
		uPulse: { value: 0 },
		uDeep: { value: new THREE.Color(0x0b3a4c) },
		uShallow: { value: new THREE.Color(0x38bdf8) },
		uMoon: { value: new THREE.Vector3(-0.4, 0.86, 0.28) }
	};
	const waterMat = keepMat(
		new THREE.ShaderMaterial({
			uniforms: waterUniforms,
			vertexShader: WATER_VERT,
			fragmentShader: WATER_FRAG,
			transparent: true
		})
	);
	let waterGeo = keepGeo(new THREE.PlaneGeometry(36, 36, waterSeg, waterSeg));
	waterGeo.rotateX(-Math.PI / 2);
	const water = new THREE.Mesh(waterGeo, waterMat);
	water.receiveShadow = true;
	scene.add(water);

	const floor = new THREE.Mesh(
		keepGeo(new THREE.CircleGeometry(14, 48)),
		keepMat(mat(0x08222c, { roughness: 0.92 }))
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -2.35;
	floor.receiveShadow = true;
	scene.add(floor);

	const seabed = new THREE.Group();
	seabed.name = 'seabed';
	for (let i = 0; i < 28; i++) {
		const kelp = new THREE.Mesh(
			cone,
			keepMat(mat(0x14532d, { emissive: 0x22c55e, emissiveIntensity: 0.22, roughness: 0.8 }))
		);
		kelp.scale.set(0.07 + (i % 3) * 0.02, 0.55 + (i % 5) * 0.14, 0.07 + (i % 3) * 0.02);
		kelp.position.set(((i % 7) - 3) * 1.65, -2.08, (Math.floor(i / 7) - 2) * 1.7);
		kelp.rotation.z = (i % 2 ? 1 : -1) * 0.14;
		seabed.add(kelp);
	}
	for (let i = 0; i < 12; i++) {
		const shell = new THREE.Mesh(
			torus,
			keepMat(mat(0xf5d0c8, { emissive: 0xfb7185, emissiveIntensity: 0.28, roughness: 0.45 }))
		);
		shell.scale.set(0.12, 0.08, 0.14);
		shell.position.set(Math.sin(i * 1.1) * 4.6, -2.26, Math.cos(i * 1.7) * 4.1);
		shell.rotation.set(1.15, i, 0.2);
		seabed.add(shell);
	}
	for (let i = 0; i < 10; i++) {
		const rock = new THREE.Mesh(ico, keepMat(mat(0x1e293b, { roughness: 0.95 })));
		rock.scale.setScalar(0.14 + (i % 3) * 0.05);
		rock.position.set((i - 4.5) * 1.05, -2.28, 3.1 - (i % 4) * 1.35);
		seabed.add(rock);
	}
	scene.add(seabed);

	const planktonGeo = keepGeo(new THREE.BufferGeometry());
	const planktonMax = 400;
	const pPos = new Float32Array(planktonMax * 3);
	for (let i = 0; i < planktonMax; i++) {
		pPos[i * 3] = (Math.random() - 0.5) * 16;
		pPos[i * 3 + 1] = Math.random() * 2.2 + 0.15;
		pPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
	}
	planktonGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
	const plankton = new THREE.Points(
		planktonGeo,
		keepMat(
			new THREE.PointsMaterial({
				color: 0x7dd3fc,
				size: 0.045,
				transparent: true,
				opacity: 0.55,
				depthWrite: false
			})
		)
	);
	scene.add(plankton);

	const creatureRoot = new THREE.Group();
	scene.add(creatureRoot);
	const creatureMap = new Map<number, TideGroup>();
	const pickables: TideObj[] = [];

	function tentacle(len: number, color: number) {
		const g = new THREE.Group();
		const mesh = new THREE.Mesh(
			cyl,
			keepMat(
				mat(color, {
					emissive: color,
					emissiveIntensity: 0.35,
					transparent: true,
					opacity: 0.72
				})
			)
		);
		mesh.scale.set(0.03, len, 0.03);
		mesh.position.y = -len / 2;
		g.add(mesh);
		return g;
	}

	function makeJelly(): TideGroup {
		const g = new THREE.Group();
		const bell = new THREE.Mesh(
			sphere,
			keepMat(
				mat(0x67e8f9, {
					emissive: 0x22d3ee,
					emissiveIntensity: 0.7,
					transparent: true,
					opacity: 0.72,
					roughness: 0.2
				})
			)
		);
		bell.scale.set(0.42, 0.28, 0.42);
		g.add(bell);
		const cap = new THREE.Mesh(
			sphere,
			keepMat(
				mat(0xe0f2fe, {
					emissive: 0x7dd3fc,
					emissiveIntensity: 0.55,
					transparent: true,
					opacity: 0.4
				})
			)
		);
		cap.scale.set(0.22, 0.12, 0.22);
		cap.position.y = 0.08;
		g.add(cap);
		for (let i = 0; i < 6; i++) {
			const t = tentacle(0.85 + (i % 2) * 0.18, 0x22d3ee);
			const a = (i / 6) * Math.PI * 2;
			t.position.set(Math.cos(a) * 0.16, -0.12, Math.sin(a) * 0.16);
			t.name = `tent-${i}`;
			g.add(t);
		}
		const light = new THREE.PointLight(0x67e8f9, 3.2, 6.5, 2);
		g.add(light);
		return g;
	}

	function makeLantern(): TideGroup {
		const g = new THREE.Group();
		const body = new THREE.Mesh(
			sphere,
			keepMat(mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.55 }))
		);
		body.scale.set(0.22, 0.16, 0.48);
		g.add(body);
		const head = new THREE.Mesh(
			sphere,
			keepMat(mat(0xfde68a, { emissive: 0xfacc15, emissiveIntensity: 0.95 }))
		);
		head.scale.setScalar(0.12);
		head.position.set(0, 0.06, 0.42);
		g.add(head);
		const tail = new THREE.Mesh(
			cone,
			keepMat(mat(0x155e75, { emissive: 0x164e63, emissiveIntensity: 0.3 }))
		);
		tail.scale.set(0.12, 0.28, 0.04);
		tail.rotation.x = Math.PI / 2;
		tail.position.z = -0.48;
		g.add(tail);
		const light = new THREE.PointLight(0xfde68a, 2.4, 5, 2);
		light.position.copy(head.position);
		g.add(light);
		return g;
	}

	function makeManta(): TideGroup {
		const g = new THREE.Group();
		const body = new THREE.Mesh(
			sphere,
			keepMat(mat(0x1e3a5f, { emissive: 0x1d4ed8, emissiveIntensity: 0.28, roughness: 0.4 }))
		);
		body.scale.set(0.55, 0.1, 0.9);
		g.add(body);
		const stripe = new THREE.Mesh(
			sphere,
			keepMat(
				mat(0x38bdf8, {
					emissive: 0x38bdf8,
					emissiveIntensity: 0.45,
					transparent: true,
					opacity: 0.55
				})
			)
		);
		stripe.scale.set(0.18, 0.04, 0.7);
		stripe.position.y = 0.06;
		g.add(stripe);
		for (const side of [-1, 1]) {
			const wing = new THREE.Mesh(
				sphere,
				keepMat(mat(0x16324f, { emissive: 0x2563eb, emissiveIntensity: 0.22 }))
			);
			wing.scale.set(0.95, 0.05, 0.42);
			wing.position.set(side * 0.7, 0.02, 0.05);
			wing.name = side < 0 ? 'wingL' : 'wingR';
			g.add(wing);
		}
		return g;
	}

	function rigFor(kind: Creature['kind']) {
		if (kind === 'jelly') return makeJelly();
		if (kind === 'lantern') return makeLantern();
		return makeManta();
	}

	function coralMesh(patch: CoralPatch) {
		const g = new THREE.Group();
		const palette = [0xf472b6, 0xfb7185, 0x34d399, 0x22d3ee, 0xfbbf24];
		const addBranch = (parent: TideGroup, depth: number, len: number, thick: number) => {
			const mesh = new THREE.Mesh(
				cyl,
				keepMat(
					mat(palette[depth % palette.length]!, {
						emissive: palette[depth % palette.length]!,
						emissiveIntensity: 0.55 + depth * 0.12
					})
				)
			);
			mesh.castShadow = true;
			mesh.scale.set(thick, len, thick);
			mesh.position.y = len / 2;
			parent.add(mesh);
			if (depth >= 3) {
				const tip = new THREE.Mesh(
					sphereLo,
					keepMat(mat(0xf9a8d4, { emissive: 0xfb7185, emissiveIntensity: 0.85 }))
				);
				tip.scale.setScalar(thick * 1.6);
				tip.position.y = len;
				parent.add(tip);
				return;
			}
			for (let i = 0; i < 3; i++) {
				const child = new THREE.Group();
				child.position.y = len * 0.72;
				child.rotation.z = (i - 1) * 0.55;
				child.rotation.y = i * 0.9 + depth;
				parent.add(child);
				addBranch(child, depth + 1, len * 0.62, thick * 0.72);
			}
		};
		const trunk = new THREE.Group();
		addBranch(trunk, 0, 0.55, 0.07);
		g.add(trunk);
		const anemone = new THREE.Mesh(
			sphereLo,
			keepMat(mat(0xa78bfa, { emissive: 0x7c3aed, emissiveIntensity: 0.8 }))
		);
		anemone.scale.set(0.28, 0.16, 0.28);
		anemone.position.set(0.32, 0.12, 0.2);
		g.add(anemone);
		const glow = new THREE.PointLight(0xfb7185, 6.5, 5.5, 2);
		glow.position.set(0, 0.6, 0);
		g.add(glow);
		g.position.set(patch.x, -0.42, patch.z);
		g.scale.setScalar(0.01);
		g.visible = false;
		return g;
	}

	const coralGroups: TideGroup[] = [];
	const starMeshes: TideGroup[] = [];

	function glowMat(
		color: number,
		emissive: number,
		intensity: number,
		extras: Record<string, unknown> = {}
	) {
		return keepMat(
			mat(color, {
				emissive,
				emissiveIntensity: intensity,
				roughness: 0.28,
				...extras
			})
		);
	}

	function makeHaul(kind: HaulKind): TideGroup {
		const g = new THREE.Group();
		g.name = `haul-${kind}`;
		if (kind === '水母光') {
			const bell = new THREE.Mesh(
				sphere,
				glowMat(0x67e8f9, 0x22d3ee, 1.15, { transparent: true, opacity: 0.78 })
			);
			bell.scale.set(0.22, 0.14, 0.22);
			g.add(bell);
			for (let i = 0; i < 4; i++) {
				const tent = new THREE.Mesh(
					cyl,
					glowMat(0x22d3ee, 0x67e8f9, 0.7, { transparent: true, opacity: 0.7 })
				);
				tent.scale.set(0.018, 0.28, 0.018);
				const a = (i / 4) * Math.PI * 2;
				tent.position.set(Math.cos(a) * 0.08, -0.18, Math.sin(a) * 0.08);
				g.add(tent);
			}
			g.add(new THREE.PointLight(0x67e8f9, 1.6, 3.2, 2));
			return g;
		}
		if (kind === '灯笼') {
			const cage = new THREE.Mesh(cyl, glowMat(0x92400e, 0xf59e0b, 0.45));
			cage.scale.set(0.1, 0.22, 0.1);
			g.add(cage);
			const bulb = new THREE.Mesh(sphere, glowMat(0xfde68a, 0xfacc15, 1.4));
			bulb.scale.setScalar(0.12);
			bulb.position.y = 0.02;
			g.add(bulb);
			const cap = new THREE.Mesh(cone, glowMat(0xb45309, 0xf59e0b, 0.35));
			cap.scale.set(0.12, 0.1, 0.12);
			cap.position.y = 0.16;
			g.add(cap);
			g.add(new THREE.PointLight(0xfacc15, 1.8, 3.4, 2));
			return g;
		}
		if (kind === '月光水母盘') {
			const disc = new THREE.Mesh(
				sphere,
				glowMat(0xe0f2fe, 0x93c5fd, 1.2, { transparent: true, opacity: 0.62 })
			);
			disc.scale.set(0.32, 0.06, 0.32);
			g.add(disc);
			const rim = new THREE.Mesh(
				torus,
				glowMat(0xf8fafc, 0xbfdbfe, 0.9, { transparent: true, opacity: 0.7 })
			);
			rim.scale.set(0.18, 0.18, 0.05);
			rim.rotation.x = Math.PI / 2;
			g.add(rim);
			g.add(new THREE.PointLight(0xbfdbfe, 1.5, 3.2, 2));
			return g;
		}
		if (kind === '浮游团') {
			const colors = [0x4ade80, 0x22d3ee, 0xa3e635, 0x67e8f9, 0x86efac];
			for (let i = 0; i < 5; i++) {
				const bead = new THREE.Mesh(sphereLo, glowMat(colors[i]!, colors[i]!, 1.05));
				bead.scale.setScalar(0.07 + (i % 2) * 0.03);
				const a = (i / 5) * Math.PI * 2;
				bead.position.set(Math.cos(a) * 0.12, (i % 3) * 0.06 - 0.04, Math.sin(a) * 0.12);
				g.add(bead);
			}
			g.add(new THREE.PointLight(0x86efac, 1.4, 3, 2));
			return g;
		}
		if (kind === '夜光贝') {
			const lower = new THREE.Mesh(sphere, glowMat(0xfbcfe8, 0xf472b6, 0.85));
			lower.scale.set(0.2, 0.07, 0.16);
			lower.position.y = -0.04;
			g.add(lower);
			const upper = new THREE.Mesh(sphere, glowMat(0xfce7f3, 0xfb7185, 0.7));
			upper.scale.set(0.18, 0.06, 0.14);
			upper.position.set(0, 0.05, 0);
			upper.rotation.z = -0.45;
			g.add(upper);
			const pearl = new THREE.Mesh(sphereLo, glowMat(0xfefce8, 0xfde68a, 1.3));
			pearl.scale.setScalar(0.05);
			g.add(pearl);
			g.add(new THREE.PointLight(0xf9a8d4, 1.3, 2.8, 2));
			return g;
		}
		const blade = new THREE.Mesh(cone, glowMat(0x4d7c0f, 0xa3e635, 0.7));
		blade.scale.set(0.06, 0.42, 0.06);
		blade.position.y = 0.08;
		g.add(blade);
		for (const side of [-1, 1]) {
			const leaf = new THREE.Mesh(cone, glowMat(0x65a30d, 0x84cc16, 0.55));
			leaf.scale.set(0.04, 0.28, 0.04);
			leaf.position.set(side * 0.08, 0.02, 0);
			leaf.rotation.z = side * 0.45;
			g.add(leaf);
		}
		const tuft = new THREE.Mesh(sphereLo, glowMat(0xd9f99d, 0xbef264, 1.1));
		tuft.scale.set(0.08, 0.05, 0.08);
		tuft.position.y = 0.28;
		g.add(tuft);
		g.add(new THREE.PointLight(0xa3e635, 1.2, 2.8, 2));
		return g;
	}

	const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const hit = new THREE.Vector3();

	let reduceMotion = false;
	let lowDetail = false;
	let lastCollected = 0;

	function applyDetail(world: TideWorld) {
		const next = world.lowDetail || reduceMotion;
		if (next === lowDetail) return;
		lowDetail = next;
		renderer.shadowMap.enabled = !lowDetail;
		moon.castShadow = !lowDetail;
		plankton.visible = true;
		(plankton.material as TidePointsMat).size = lowDetail ? 0.03 : 0.045;
		const count = lowDetail ? 80 : planktonMax;
		planktonGeo.setDrawRange(0, count);
		stars.visible = true;
		const starCount = skyStarCount(lowDetail);
		starGeo.setDrawRange(0, starCount);
		(stars.material as TidePointsMat).size = lowDetail ? 3.2 : 2.4;
		constellationRoot.visible = true;
		seabed.visible = true;
	}

	function ensureCreatures(world: TideWorld) {
		for (const creature of world.creatures) {
			let group = creatureMap.get(creature.id);
			if (!group) {
				group = rigFor(creature.kind);
				group.userData.creatureId = creature.id;
				group.traverse((obj: TideObj) => {
					obj.userData.creatureId = creature.id;
					if (obj instanceof THREE.Mesh) {
						obj.castShadow = true;
						pickables.push(obj);
					}
				});
				creatureMap.set(creature.id, group);
				creatureRoot.add(group);
			}
			const bob = reduceMotion ? 0 : Math.sin(world.time / 420 + creature.id) * 0.08;
			group.position.set(creature.x, 0.35 + bob + world.swell * 0.12, creature.z);
			group.rotation.y = creature.heading;
			const ring = group.getObjectByName('select');
			if (!ring) {
				const halo = new THREE.Mesh(
					keepGeo(new THREE.TorusGeometry(0.55, 0.03, 8, 28)),
					keepMat(
						mat(0xfde68a, {
							emissive: 0xfacc15,
							emissiveIntensity: 0.8,
							transparent: true,
							opacity: 0.85
						})
					)
				);
				halo.rotation.x = Math.PI / 2;
				halo.position.y = 0.02;
				halo.name = 'select';
				group.add(halo);
			}
			const halo = group.getObjectByName('select');
			if (halo) halo.visible = world.selected === creature.id;
		}
	}

	function ensureStars(world: TideWorld) {
		while (starMeshes.length < world.stars.length) {
			const star = world.stars[starMeshes.length]!;
			const group = makeHaul(star.kind);
			group.traverse((obj: TideObj) => {
				if (obj instanceof THREE.Mesh) obj.castShadow = true;
			});
			scene.add(group);
			starMeshes.push(group);
		}
		for (let i = 0; i < world.stars.length; i++) {
			const star = world.stars[i]!;
			const mesh = starMeshes[i]!;
			mesh.visible = !star.collected;
			mesh.position.set(
				star.x,
				0.55 + Math.sin(world.time / 380 + i) * (reduceMotion ? 0 : 0.12),
				star.z
			);
			mesh.rotation.y = world.time / 900 + i;
		}
	}

	function ensureCoral(world: TideWorld) {
		while (coralGroups.length < world.coral.length) {
			const patch = world.coral[coralGroups.length]!;
			const group = coralMesh(patch);
			scene.add(group);
			coralGroups.push(group);
		}
		for (let i = 0; i < world.coral.length; i++) {
			const patch = world.coral[i]!;
			const group = coralGroups[i]!;
			group.visible = patch.unlocked && patch.growth > 0.02;
			const s = 0.55 + patch.growth * 0.7;
			group.scale.setScalar(patch.unlocked ? s : 0.01);
			group.position.y = -0.42 + patch.growth * 0.55;
		}
	}

	function sync(world: TideWorld, opts?: { reducedMotion?: boolean }) {
		if (opts?.reducedMotion != null) reduceMotion = opts.reducedMotion;
		applyDetail(world);
		waterUniforms.uSwell.value = world.swell;
		waterUniforms.uPulse.value = world.pulse;
		ensureCreatures(world);
		ensureStars(world);
		ensureCoral(world);
		if (world.collected > lastCollected) lastCollected = world.collected;
		fill.intensity = 12 + world.swell * 10;
		bio.intensity = 8 + world.pulse * 6;
	}

	function render(now: number) {
		const t = now / 1000;
		waterUniforms.uTime.value = reduceMotion ? t * 0.15 : t;
		if (!reduceMotion) {
			plankton.rotation.y = t * 0.03;
			for (const [, group] of creatureMap) {
				for (let i = 0; i < 6; i++) {
					const tent = group.getObjectByName(`tent-${i}`);
					if (tent) tent.rotation.z = Math.sin(t * 2.4 + i) * 0.35;
				}
				const wingL = group.getObjectByName('wingL');
				const wingR = group.getObjectByName('wingR');
				const flap = Math.sin(t * 2.1) * 0.28;
				if (wingL) wingL.rotation.z = flap;
				if (wingR) wingR.rotation.z = -flap;
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

	function hitWater(clientX: number, clientY: number) {
		if (!setPointer(clientX, clientY)) return null;
		const point = raycaster.ray.intersectPlane(waterPlane, hit);
		if (!point) return null;
		return { x: point.x, z: point.z };
	}

	function pickCreature(clientX: number, clientY: number) {
		if (!setPointer(clientX, clientY)) return null;
		const hits = raycaster.intersectObjects(pickables, false);
		const id = hits[0]?.object.userData.creatureId;
		return typeof id === 'number' ? id : null;
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
	}

	resize();
	return { sync, render, resize, dispose, hitWater, pickCreature };
}
