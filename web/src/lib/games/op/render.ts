import * as THREE from 'three';
import type { OpWorld, RegionId, ToolId } from './sim';

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
type StdMat = InstanceType<typeof THREE.MeshStandardMaterial>;
type StdParams = {
	map?: InstanceType<typeof THREE.Texture> | null;
	roughness?: number;
	metalness?: number;
	transparent?: boolean;
	opacity?: number;
	depthWrite?: boolean;
	side?: typeof THREE.DoubleSide | typeof THREE.FrontSide;
	emissive?: number;
	emissiveIntensity?: number;
};

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
		d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.75));
		d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.55));
	}
	ctx.putImageData(img, 0, 0);
}

const texSkin = canvasTex(256, 256, (ctx) => {
	ctx.fillStyle = '#c89480';
	ctx.fillRect(0, 0, 256, 256);
	const g = ctx.createRadialGradient(118, 88, 10, 128, 128, 170);
	g.addColorStop(0, 'rgba(236,186,168,0.5)');
	g.addColorStop(1, 'rgba(96,42,36,0.22)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 256, 256);
	ctx.strokeStyle = 'rgba(128,52,62,0.22)';
	ctx.lineWidth = 1.1;
	for (let i = 0; i < 14; i++) {
		ctx.beginPath();
		ctx.moveTo(Math.random() * 256, Math.random() * 256);
		ctx.quadraticCurveTo(Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256);
		ctx.stroke();
	}
	noise(ctx, 256, 256, 18);
});

const texMuscle = canvasTex(256, 256, (ctx) => {
	ctx.fillStyle = '#4a1014';
	ctx.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 70; i++) {
		ctx.fillStyle = i % 3 === 0 ? 'rgba(110,28,32,0.7)' : 'rgba(58,12,16,0.65)';
		ctx.beginPath();
		ctx.ellipse(
			Math.random() * 256,
			Math.random() * 256,
			6 + Math.random() * 18,
			4 + Math.random() * 10,
			Math.random() * Math.PI,
			0,
			Math.PI * 2
		);
		ctx.fill();
	}
	noise(ctx, 256, 256, 16);
});

const texFat = canvasTex(128, 128, (ctx) => {
	ctx.fillStyle = '#e2c889';
	ctx.fillRect(0, 0, 128, 128);
	for (let i = 0; i < 36; i++) {
		ctx.fillStyle = i % 2 ? 'rgba(255,236,186,0.7)' : 'rgba(186,140,64,0.4)';
		ctx.beginPath();
		ctx.ellipse(Math.random() * 128, Math.random() * 128, 5 + Math.random() * 9, 4, 0, 0, Math.PI * 2);
		ctx.fill();
	}
});

const texDrape = canvasTex(256, 256, (ctx) => {
	ctx.fillStyle = '#1c5f44';
	ctx.fillRect(0, 0, 256, 256);
	noise(ctx, 256, 256, 12);
});

const texGum = canvasTex(128, 128, (ctx) => {
	ctx.fillStyle = '#b45662';
	ctx.fillRect(0, 0, 128, 128);
	noise(ctx, 128, 128, 18);
});

function std(color: number, extras: StdParams = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.55,
		metalness: 0.06,
		...extras
	});
}

function wet(color: number, extras: StdParams = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.22,
		metalness: 0.12,
		...extras
	});
}

function jitter(geo: Geo, amp: number) {
	const pos = geo.attributes.position;
	if (!pos) return geo;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		const n = Math.sin(x * 11.7 + z * 8.3 + y * 5.1) * Math.cos(x * 4.2 - z * 6.8);
		pos.setXYZ(i, x + n * amp * 0.35, y + n * amp * 0.55, z + n * amp);
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();
	return geo;
}

function offset(mat: StdMat, factor: number, units: number) {
	mat.polygonOffset = true;
	mat.polygonOffsetFactor = factor;
	mat.polygonOffsetUnits = units;
	return mat;
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
	renderer.toneMappingExposure = 1.08;
	renderer.setClearColor(0x12161a, 1);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0x12161a, 7, 16);
	const camera = new THREE.PerspectiveCamera(36, 1, 0.06, 40);

	scene.add(new THREE.HemisphereLight(0xf4efe6, 0x2a2220, 0.62));
	const lamp = new THREE.SpotLight(0xfff1d8, 42, 14, 0.5, 0.4, 1.05);
	lamp.position.set(0.55, 4.2, 2.4);
	lamp.castShadow = true;
	lamp.shadow.mapSize.set(1024, 1024);
	lamp.target.position.set(0, 1.05, 0);
	scene.add(lamp, lamp.target);
	const fill = new THREE.DirectionalLight(0xb7d4c8, 0.38);
	fill.position.set(-2.6, 2.2, 1.8);
	scene.add(fill);
	const rim = new THREE.DirectionalLight(0xffc8b4, 0.28);
	rim.position.set(2.2, 1.4, -1.8);
	scene.add(rim);

	const skinM = keepM(std(0xc48a78, { map: texSkin, roughness: 0.5, metalness: 0.03 }));
	const muscleM = keepM(
		offset(wet(0x6a1a20, { map: texMuscle, roughness: 0.38, metalness: 0.08 }), -2, -2)
	);
	const fatM = keepM(offset(std(0xe4cc8c, { map: texFat, roughness: 0.48 }), -1, -1));
	const bloodFilmM = keepM(
		offset(
			wet(0x6a0810, {
				roughness: 0.07,
				metalness: 0.22,
				transparent: true,
				opacity: 0,
				depthWrite: false
			}),
			-4,
			-4
		)
	);
	const poolM = keepM(
		wet(0x4a030c, { roughness: 0.05, metalness: 0.24, transparent: true, opacity: 0, depthWrite: false })
	);
	const drapeM = keepM(std(0x1c5f44, { map: texDrape, roughness: 0.78, side: THREE.DoubleSide }));
	const gauzeM = keepM(std(0xf4f1ea, { roughness: 0.86 }));
	const steelM = keepM(std(0xcfd8e3, { metalness: 0.82, roughness: 0.18 }));
	const shardM = keepM(std(0x8896a4, { metalness: 0.86, roughness: 0.22 }));
	const boneM = keepM(std(0xe8d9c4, { roughness: 0.45 }));

	const floor = new THREE.Mesh(keepG(new THREE.PlaneGeometry(18, 18)), keepM(std(0x6d7378, { roughness: 0.88 })));
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	scene.add(floor);
	const wall = new THREE.Mesh(keepG(new THREE.BoxGeometry(18, 8, 0.35)), keepM(std(0xd5dad6)));
	wall.position.set(0, 3.6, -7);
	scene.add(wall);

	const hubRoot = new THREE.Group();
	const fieldRoot = new THREE.Group();
	scene.add(hubRoot, fieldRoot);
	fieldRoot.visible = false;

	function limbBetween(
		r: number,
		ax: number,
		ay: number,
		az: number,
		bx: number,
		by: number,
		bz: number,
		mat: StdMat = skinM
	) {
		const dx = bx - ax;
		const dy = by - ay;
		const dz = bz - az;
		const len = Math.hypot(dx, dy, dz);
		const m = new THREE.Mesh(
			keepG(new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 1.05), 6, 12)),
			mat
		);
		m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
		m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
		m.castShadow = true;
		m.receiveShadow = true;
		return m;
	}

	const head = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.23, 18, 14)), skinM);
	head.position.set(0, 2.12, 0.04);
	head.castShadow = true;
	const nose = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.035, 8, 6)), skinM);
	nose.position.set(0, 2.1, 0.25);
	const mouthMark = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.045, 8, 6)),
		keepM(std(0x4a1820, { roughness: 0.4 }))
	);
	mouthMark.position.set(0, 2.02, 0.24);
	hubRoot.add(
		limbBetween(0.09, 0, 1.82, 0.02, 0, 1.96, 0.03),
		head,
		nose,
		mouthMark,
		limbBetween(0.3, 0, 1.14, 0, 0, 1.82, 0),
		limbBetween(0.22, -0.12, 1.08, 0, 0.12, 1.08, 0)
	);
	hubRoot.add(
		limbBetween(0.125, -0.13, 1.08, 0.02, -0.14, 0.58, 0.04),
		limbBetween(0.125, 0.13, 1.08, 0.02, 0.14, 0.58, 0.04),
		limbBetween(0.1, -0.14, 0.6, 0.04, -0.14, 0.1, 0.06),
		limbBetween(0.1, 0.14, 0.6, 0.04, 0.14, 0.1, 0.06)
	);
	const footL = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.08, 10, 8)), skinM);
	footL.scale.set(1.35, 0.55, 1.85);
	footL.position.set(-0.14, 0.05, 0.1);
	const footR = footL.clone();
	footR.position.x = 0.14;
	hubRoot.add(footL, footR);
	const armL = limbBetween(0.09, -0.28, 1.72, 0.04, -0.5, 1.4, 0.08);
	const armR = limbBetween(0.09, 0.28, 1.72, 0.04, 0.5, 1.4, 0.08);
	const foreL = limbBetween(0.075, -0.48, 1.42, 0.08, -0.72, 1.14, 0.14);
	const foreR = limbBetween(0.075, 0.48, 1.42, 0.08, 0.72, 1.14, 0.14);
	const handL = limbBetween(0.055, -0.7, 1.16, 0.14, -0.82, 1.04, 0.18);
	const handR = limbBetween(0.055, 0.7, 1.16, 0.14, 0.82, 1.04, 0.18);
	hubRoot.add(armL, armR, foreL, foreR, handL, handR);
	const glowArm = keepM(std(0xe8b4a4, { emissive: 0x4a1814, emissiveIntensity: 0.32 }));
	const glowKnee = keepM(std(0xe4b09c, { emissive: 0x4a1814, emissiveIntensity: 0.32 }));
	const hlFore = foreL.clone();
	hlFore.material = glowArm;
	hlFore.scale.setScalar(1.06);
	const hlKnee = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.14, 12, 10)), glowKnee);
	hlKnee.position.set(0.14, 0.58, 0.08);
	const hlBelly = new THREE.Mesh(
		keepG(new THREE.CircleGeometry(0.15, 16)),
		keepM(std(0xd7a090, { emissive: 0x3a2018, emissiveIntensity: 0.22, side: THREE.DoubleSide }))
	);
	hlBelly.position.set(0, 1.28, 0.3);
	hubRoot.add(hlFore, hlKnee, hlBelly);

	function addFat(parent: Group, count: number, along: number, y: number, z: number) {
		for (let i = 0; i < count; i++) {
			const b = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.016 + (i % 3) * 0.006, 8, 6)), fatM);
			b.position.set(-along / 2 + (i / Math.max(1, count - 1)) * along, y, z);
			parent.add(b);
		}
	}

	const table = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(1.35, 1.4, 0.08, 36)),
		keepM(std(0x2a3330, { roughness: 0.7 }))
	);
	table.position.y = 0.68;
	table.receiveShadow = true;
	fieldRoot.add(table);

	const forearmG = new THREE.Group();
	const drapeF = new THREE.Mesh(keepG(new THREE.RingGeometry(0.38, 1.7, 40)), drapeM);
	drapeF.rotation.x = -Math.PI / 2;
	drapeF.position.y = 0.73;
	drapeF.receiveShadow = true;
	const arm = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.2, 0.28, 2.2, 24, 5)), skinM);
	arm.rotation.z = Math.PI / 2;
	arm.position.set(0, 0.98, 0);
	arm.castShadow = true;
	arm.receiveShadow = true;
	const wrist = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.2, 14, 12)), skinM);
	wrist.position.set(-1.12, 0.98, 0);
	wrist.castShadow = true;
	const elbow = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.29, 14, 12)), skinM);
	elbow.position.set(1.12, 0.98, 0);
	elbow.castShadow = true;
	const wellF = new THREE.Mesh(keepG(jitter(new THREE.SphereGeometry(0.11, 16, 12), 0.016)), muscleM);
	wellF.scale.set(2.85, 0.42, 0.62);
	wellF.position.set(0, 0.99, 0.22);
	const fatUpper = new THREE.Group();
	addFat(fatUpper, 6, 0.62, 0.06, 0.02);
	fatUpper.position.set(0, 0.99, 0.24);
	const fatLower = new THREE.Group();
	addFat(fatLower, 6, 0.62, -0.06, 0.02);
	fatLower.position.set(0, 0.99, 0.24);
	const bone = new THREE.Mesh(keepG(new THREE.CapsuleGeometry(0.038, 0.55, 4, 8)), boneM);
	bone.rotation.z = Math.PI / 2;
	bone.position.set(0, 0.97, 0.12);
	const filmF = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.09, 14, 10)), bloodFilmM);
	filmF.scale.set(2.6, 0.22, 0.42);
	filmF.position.set(0, 0.995, 0.26);
	const poolF = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.07, 12, 8)), poolM);
	poolF.scale.set(1.35, 0.28, 1.05);
	poolF.position.set(0.2, 0.84, 0.28);
	const shard = new THREE.Mesh(keepG(new THREE.TetrahedronGeometry(0.1, 0)), shardM);
	shard.position.set(0.04, 1.02, 0.3);
	shard.rotation.set(0.45, 0.7, 0.35);
	shard.scale.set(1.65, 0.4, 0.48);
	shard.castShadow = true;
	forearmG.add(drapeF, arm, wrist, elbow, wellF, fatUpper, fatLower, bone, filmF, poolF, shard);
	fieldRoot.add(forearmG);

	const kneeG = new THREE.Group();
	const drapeK = new THREE.Mesh(keepG(new THREE.RingGeometry(0.42, 1.7, 36)), drapeM);
	drapeK.rotation.x = -Math.PI / 2;
	drapeK.position.y = 0.73;
	const thigh = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.22, 0.28, 1.2, 20, 4)), skinM);
	thigh.rotation.z = Math.PI / 2;
	thigh.position.set(-0.78, 0.96, 0);
	thigh.castShadow = true;
	const calf = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.17, 0.22, 1.15, 20, 4)), skinM);
	calf.rotation.z = Math.PI / 2;
	calf.position.set(0.78, 0.88, 0.06);
	calf.castShadow = true;
	const joint = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.3, 18, 14)), skinM);
	joint.position.set(0, 0.96, 0.04);
	joint.castShadow = true;
	const patella = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.13, 12, 10)), skinM);
	patella.position.set(0, 1.14, 0.22);
	const wellK = new THREE.Mesh(keepG(jitter(new THREE.SphereGeometry(0.1, 14, 10), 0.012)), muscleM);
	wellK.scale.set(1.45, 0.38, 0.55);
	wellK.position.set(0, 1.02, 0.28);
	const filmK = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.075, 12, 8)), bloodFilmM);
	filmK.scale.set(1.3, 0.16, 0.42);
	filmK.position.set(0, 1.04, 0.32);
	const wrap = new THREE.Mesh(
		keepG(new THREE.TorusGeometry(0.34, 0.055, 8, 20)),
		keepM(std(0xd9d3c4, { roughness: 0.82 }))
	);
	wrap.rotation.y = Math.PI / 2;
	wrap.position.set(0, 0.96, 0.04);
	wrap.visible = false;
	kneeG.add(drapeK, thigh, calf, joint, patella, wellK, filmK, wrap);
	fieldRoot.add(kneeG);

	const toothG = new THREE.Group();
	const jaw = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.62, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58)),
		skinM
	);
	jaw.rotation.x = Math.PI;
	jaw.position.set(0, 1.02, 0.02);
	const gum = new THREE.Mesh(
		keepG(new THREE.TorusGeometry(0.4, 0.09, 10, 28, Math.PI * 1.2)),
		keepM(std(0xb45662, { map: texGum, roughness: 0.48 }))
	);
	gum.rotation.x = Math.PI / 2;
	gum.position.set(0, 1.14, 0.14);
	const gumUpper = new THREE.Mesh(
		keepG(new THREE.TorusGeometry(0.36, 0.07, 8, 24, Math.PI * 1.05)),
		keepM(std(0xa44856, { map: texGum, roughness: 0.5 }))
	);
	gumUpper.rotation.x = Math.PI / 2;
	gumUpper.position.set(0, 1.38, 0.1);
	const tongue = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.18, 12, 8)), keepM(std(0xc45a68, { roughness: 0.4 })));
	tongue.scale.set(1.45, 0.32, 0.95);
	tongue.position.set(0, 1.0, 0.16);
	const cavity = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.28, 14, 10)),
		keepM(std(0x3a1018, { roughness: 0.55 }))
	);
	cavity.position.set(0, 1.12, 0.02);
	toothG.add(jaw, cavity, gum, gumUpper, tongue);
	const toothMeshes: Mesh[] = [];
	for (let i = 0; i < 7; i++) {
		const marked = i === 3;
		const t = new THREE.Mesh(
			keepG(new THREE.CapsuleGeometry(0.05, 0.13, 4, 8)),
			keepM(std(marked ? 0xf0d56a : 0xf4efe4, { roughness: 0.32 }))
		);
		const a = -0.88 + i * 0.29;
		t.position.set(Math.sin(a) * 0.38, 1.24, 0.12 + Math.cos(a) * 0.24);
		t.rotation.x = -0.18;
		t.userData.marked = marked;
		toothMeshes.push(t);
		toothG.add(t);
	}
	const socket = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.048, 0.038, 0.11, 10)), muscleM);
	socket.position.set(0, 1.14, 0.36);
	socket.visible = false;
	const filmT = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.042, 10, 8)), bloodFilmM);
	filmT.position.set(0, 1.16, 0.36);
	toothG.add(socket, filmT);
	fieldRoot.add(toothG);

	const bellyG = new THREE.Group();
	const belly = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.7, 24, 18)), skinM);
	belly.scale.set(1.25, 0.68, 1.05);
	belly.position.set(0, 0.86, 0);
	belly.castShadow = true;
	const drapeB = new THREE.Mesh(keepG(new THREE.RingGeometry(0.48, 1.85, 40)), drapeM);
	drapeB.rotation.x = -Math.PI / 2;
	drapeB.position.set(0, 1.28, 0.02);
	const portRim = new THREE.Mesh(
		keepG(jitter(new THREE.TorusGeometry(0.12, 0.03, 8, 18), 0.006)),
		skinM
	);
	portRim.rotation.x = Math.PI / 2;
	portRim.position.set(0, 1.36, 0.04);
	const wellB = new THREE.Mesh(keepG(jitter(new THREE.SphereGeometry(0.1, 14, 10), 0.01)), muscleM);
	wellB.scale.set(1.05, 0.55, 1.05);
	wellB.position.set(0, 1.28, 0.04);
	const filmB = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.08, 12, 8)), bloodFilmM);
	filmB.scale.set(1.0, 0.18, 1.0);
	filmB.position.set(0, 1.32, 0.05);
	const stones = new THREE.Group();
	for (let i = 0; i < 3; i++) {
		const s = new THREE.Mesh(
			keepG(jitter(new THREE.SphereGeometry(0.048, 10, 8), 0.008)),
			keepM(std(0xb7a078, { roughness: 0.55 }))
		);
		s.position.set(-0.08 + i * 0.08, 1.26, 0.04);
		stones.add(s);
	}
	bellyG.add(belly, drapeB, portRim, wellB, filmB, stones);
	fieldRoot.add(bellyG);

	const sutures = new THREE.Group();
	for (let i = 0; i < 6; i++) {
		const s = new THREE.Mesh(
			keepG(new THREE.CylinderGeometry(0.007, 0.007, 0.11, 6)),
			keepM(std(0x1a1a1a, { roughness: 0.45 }))
		);
		sutures.add(s);
	}
	fieldRoot.add(sutures);

	const dropGeo = keepG(new THREE.SphereGeometry(0.016, 8, 6));
	const dropMat = keepM(wet(0x6a0810, { roughness: 0.08, metalness: 0.2 }));
	const drops = new THREE.InstancedMesh(dropGeo, dropMat, 80);
	drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	drops.frustumCulled = false;
	fieldRoot.add(drops);
	const dummy = new THREE.Object3D();

	const tools = new THREE.Group();
	fieldRoot.add(tools);
	const gauze = new THREE.Mesh(keepG(new THREE.BoxGeometry(0.22, 0.05, 0.16)), gauzeM);
	const scalpel = new THREE.Group();
	const blade = new THREE.Mesh(keepG(new THREE.BoxGeometry(0.26, 0.008, 0.04)), steelM);
	blade.position.x = 0.14;
	const handle = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.018, 0.022, 0.3, 8)),
		keepM(std(0x1f2937, { metalness: 0.4 }))
	);
	handle.rotation.z = Math.PI / 2;
	handle.position.x = -0.1;
	scalpel.add(blade, handle);
	const forceps = new THREE.Group();
	for (const s of [-1, 1]) {
		const a = new THREE.Mesh(keepG(new THREE.BoxGeometry(0.32, 0.01, 0.018)), steelM);
		a.position.set(0.02, s * 0.018, 0);
		a.rotation.z = s * 0.1;
		forceps.add(a);
	}
	const suction = new THREE.Group();
	const tube = new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.022, 0.026, 0.38, 8)), steelM);
	const tip = new THREE.Mesh(keepG(new THREE.SphereGeometry(0.035, 8, 8)), keepM(std(0x111827, { metalness: 0.5 })));
	tip.position.y = -0.2;
	suction.add(tube, tip);
	suction.rotation.z = 0.85;
	const irrigator = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 8)),
		keepM(std(0xdbeafe, { roughness: 0.28, transparent: true, opacity: 0.72 }))
	);
	const needle = new THREE.Group();
	needle.add(new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.007, 0.007, 0.28, 6)), steelM));
	needle.rotation.z = 0.65;
	const bandage = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12)),
		keepM(std(0xf5f0e6, { roughness: 0.8 }))
	);
	const elevator = new THREE.Group();
	elevator.add(new THREE.Mesh(keepG(new THREE.CylinderGeometry(0.016, 0.018, 0.28, 8)), steelM));
	const elevTip = new THREE.Mesh(keepG(new THREE.BoxGeometry(0.07, 0.01, 0.025)), steelM);
	elevTip.position.set(0.04, -0.14, 0);
	elevator.add(elevTip);
	const grasper = new THREE.Mesh(
		keepG(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 8)),
		keepM(std(0x6b7280, { metalness: 0.62 }))
	);
	const bag = new THREE.Mesh(
		keepG(new THREE.SphereGeometry(0.08, 10, 8)),
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

	let mode: 'hub' | 'field' | '' = '';
	let region: RegionId | null = null;

	function aimHub() {
		camera.fov = 40;
		camera.position.set(1.2, 1.38, 4.85);
		camera.lookAt(0, 1.05, 0);
		camera.updateProjectionMatrix();
	}

	function aimField(id: RegionId) {
		camera.fov = 36;
		if (id === 'tooth') {
			camera.position.set(0.08, 1.78, 1.32);
			camera.lookAt(0, 1.12, 0.12);
		} else if (id === 'belly') {
			camera.position.set(0.18, 1.95, 1.05);
			camera.lookAt(0, 1.2, 0.02);
		} else if (id === 'knee') {
			camera.position.set(0.18, 1.92, 1.22);
			camera.lookAt(0, 1.0, 0.1);
		} else {
			camera.position.set(0.22, 1.72, 1.38);
			camera.lookAt(0, 0.98, 0.08);
		}
		camera.updateProjectionMatrix();
	}

	function uvWorld(x: number, y: number) {
		return new THREE.Vector3((x - 0.5) * 1.5, 1.28, (0.42 - y) * 0.85);
	}

	function sync(world: OpWorld) {
		const want = world.view === 'field' ? 'field' : 'hub';
		if (want !== mode || (want === 'field' && world.region !== region)) {
			mode = want;
			region = world.region;
			hubRoot.visible = want === 'hub';
			fieldRoot.visible = want === 'field';
			if (want === 'hub') aimHub();
			else if (world.region) aimField(world.region);
		}

		renderer.shadowMap.enabled = !world.lowDetail;
		forearmG.visible = world.view === 'field' && world.region === 'forearm';
		kneeG.visible = world.view === 'field' && world.region === 'knee';
		toothG.visible = world.view === 'field' && world.region === 'tooth';
		bellyG.visible = world.view === 'field' && world.region === 'belly';

		const open =
			world.phase === 'prepare'
				? 0.05
				: world.phase === 'expose'
					? 0.12 + world.progress * 0.88
					: world.phase === 'close'
						? Math.max(0.08, 1 - world.progress)
						: world.phase === 'done'
							? 0.07
							: 1;
		const closeAmt = world.phase === 'close' ? world.progress : world.phase === 'done' ? 1 : 0;

		wellF.scale.set(2.2 + open * 0.9, 0.28 + open * 0.2, 0.4 + open * 0.28);
		wellF.position.set(0, 0.99, 0.16 + open * 0.08);
		filmF.scale.set(2.1 + open * 0.7, 0.14 + open * 0.1, 0.28 + open * 0.18);
		filmF.position.set(0, 1.0, 0.2 + open * 0.08);
		patella.visible = world.region === 'knee' && open < 0.45;
		wellF.visible = world.region === 'forearm' && open > 0.08;
		bone.visible = world.region === 'forearm' && open > 0.25;
		fatUpper.visible = world.region === 'forearm' && open > 0.22;
		fatLower.visible = world.region === 'forearm' && open > 0.22;
		shard.visible =
			world.region === 'forearm' && !world.extracted && world.phase !== 'prepare' && world.phase !== 'done';
		wrap.visible = world.region === 'knee' && closeAmt > 0.55;
		socket.visible = world.region === 'tooth' && world.extracted;
		for (const t of toothMeshes) {
			if (t.userData.marked) t.visible = !(world.region === 'tooth' && world.extracted);
		}
		stones.children.forEach((ch: InstanceType<typeof THREE.Object3D>, i: number) => {
			ch.visible = world.region === 'belly' && i >= world.stoneIndex;
			if (world.heldStone && i === world.stoneIndex) ch.visible = false;
		});

		sutures.visible = closeAmt > 0.18 && world.region !== 'tooth';
		sutures.children.forEach((ch: InstanceType<typeof THREE.Object3D>, i: number) => {
			ch.visible = closeAmt > (i + 1) / 8;
			const x = -0.26 + i * 0.1;
			ch.rotation.set(Math.PI / 2, 0, 0);
			if (world.region === 'forearm') {
				ch.position.set(x, 0.99, 0.28);
			}
			else if (world.region === 'knee') ch.position.set(x * 0.65, 1.06, 0.32);
			else ch.position.set(x * 0.16, 1.355, 0.04);
		});

		const wetField = world.view === 'field' && open > 0.15;
		bloodFilmM.opacity = wetField ? Math.max(0.38, world.film * 0.92) : 0;
		poolM.opacity = world.region === 'forearm' && wetField ? Math.max(0.22, world.pool * 0.85) : 0;
		filmF.visible = world.region === 'forearm' && wetField;
		filmK.visible = world.region === 'knee' && wetField;
		filmB.visible = world.region === 'belly' && wetField;
		filmT.visible = world.region === 'tooth' && (world.extracted || world.film > 0.08);
		poolF.visible = world.region === 'forearm' && wetField && world.pool > 0.05;
		gauzeM.color.setHex(world.stain > 20 ? 0xb08a86 : 0xf4f1ea);

		const capN = Math.min(world.sprayCap, world.lowDetail ? 12 : 18);
		const n = Math.min(capN, Math.max(0, Math.floor(world.spray)));
		for (let i = 0; i < 80; i++) {
			if (i < n && wetField) {
				const t = i / Math.max(1, n);
				dummy.position.set(
					-0.28 + t * 0.56 + Math.sin(i * 2.3) * 0.04,
					0.92 + (i % 3) * 0.03,
					0.32 + Math.abs(Math.sin(i * 1.9)) * 0.04
				);
				dummy.scale.setScalar(0.55 + (i % 5) * 0.18);
			} else {
				dummy.position.set(0, -8, 0);
				dummy.scale.setScalar(0.01);
			}
			dummy.updateMatrix();
			drops.setMatrixAt(i, dummy.matrix);
		}
		drops.instanceMatrix.needsUpdate = true;
		drops.visible = n > 0 && wetField;

		for (const [id, obj] of Object.entries(toolMap)) {
			obj.visible = world.view === 'field' && world.tool === (id as ToolId);
		}
		const at = uvWorld(world.px, world.py);
		tools.position.copy(at);
		tools.rotation.z = world.pointerDown ? -0.35 : -0.12;
		if (world.heldStone) {
			bag.visible = true;
			bag.position.copy(at);
		}
	}

	function render(_now: number) {
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
		drops.dispose();
		for (const g of geos) g.dispose();
		for (const m of mats) m.dispose();
	}

	resize();
	return { sync, render, resize, dispose };
}
