import * as THREE from 'three';
import {
	HERB_IDS,
	HERBS,
	isCompactClinic,
	jarWorld,
	patientWorld,
	type ClinicWorld,
	type HerbId
} from './sim';

export type ClinicHit = { zone: 'patient' } | { zone: 'jar'; id: HerbId };

export interface ClinicScene {
	sync(world: ClinicWorld, opts?: { reducedMotion?: boolean }): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	hit(clientX: number, clientY: number): ClinicHit | null;
	projectPatient(): { x: number; y: number } | null;
	projectJar(id: HerbId): { x: number; y: number } | null;
}

type Geo = InstanceType<typeof THREE.BufferGeometry>;
type Renderer = InstanceType<typeof THREE.WebGLRenderer>;
type Obj = InstanceType<typeof THREE.Object3D>;
type Mesh = InstanceType<typeof THREE.Mesh>;
type Group = InstanceType<typeof THREE.Group>;

const JAR_COLOR: Record<HerbId, number> = {
	danggui: 0xc45a4a,
	huangqi: 0xe8c547,
	gouqi: 0xb33a3a,
	juhua: 0xf0d060,
	gancao: 0xd4b896,
	fuling: 0xe8dcc8,
	chenpi: 0xd4783a,
	shengjiang: 0xe8c878,
	hongzao: 0x8a2a22,
	bohe: 0x6aa37a,
	guizhi: 0xc48a5a,
	baizhu: 0xf2efe4
};

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

export function mountClinicScene(canvas: HTMLCanvasElement): ClinicScene | null {
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
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor(0xf4e4c8, 1);

	const scene = new THREE.Scene();
	scene.fog = new THREE.Fog(0xf4e4c8, 10, 18);
	const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 40);
	camera.position.set(0, 4.9, 4.2);
	camera.lookAt(0, 0.55, 0);

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
	const sphere = keepGeo(new THREE.SphereGeometry(1, 18, 14));
	const cyl = keepGeo(new THREE.CylinderGeometry(1, 1, 1, 16));
	const cone = keepGeo(new THREE.ConeGeometry(1, 1, 10));
	const torus = keepGeo(new THREE.TorusGeometry(1, 0.18, 8, 18));

	const wood = keepMat(mat(0x6b3a22, { roughness: 0.86 }));
	const woodDark = keepMat(mat(0x4a2414, { roughness: 0.9 }));
	const plaster = keepMat(mat(0xf7ead2, { roughness: 0.92 }));
	const paper = keepMat(
		mat(0xf3e2b8, { roughness: 0.55, emissive: 0x3a2a10, emissiveIntensity: 0.18 })
	);
	const cloth = keepMat(mat(0xc4a35a, { roughness: 0.7 }));
	const ghost = keepMat(mat(0x222, { transparent: true, opacity: 0 }));

	const sun = new THREE.DirectionalLight(0xfff4e0, 1.25);
	sun.position.set(-2.2, 6, 3.4);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	scene.add(sun);
	scene.add(new THREE.HemisphereLight(0xfff6e8, 0x7a5a3a, 0.7));
	scene.add(new THREE.AmbientLight(0xffe8c8, 0.28));

	const floor = new THREE.Mesh(box, plaster);
	floor.scale.set(12, 0.08, 10);
	floor.position.set(0, -0.84, 0.2);
	floor.receiveShadow = true;
	scene.add(floor);

	const back = new THREE.Mesh(box, plaster);
	back.scale.set(10, 4.4, 0.18);
	back.position.set(0, 1.3, -2.4);
	scene.add(back);

	const counter = new THREE.Mesh(box, wood);
	counter.scale.set(7.2, 0.16, 3.8);
	counter.position.set(0, 0, 0.1);
	counter.receiveShadow = true;
	scene.add(counter);

	const bench = new THREE.Mesh(box, woodDark);
	bench.scale.set(1.8, 0.14, 0.7);
	bench.position.set(-1.15, 0.18, 0.55);
	scene.add(bench);

	const cabinet = new THREE.Mesh(box, wood);
	cabinet.scale.set(2.2, 2.2, 0.4);
	cabinet.position.set(1.35, 1.2, -0.7);
	scene.add(cabinet);

	const lamp = new THREE.Mesh(cyl, paper);
	lamp.scale.set(0.18, 0.35, 0.18);
	lamp.position.set(-0.2, 2.35, -0.4);
	scene.add(lamp);

	const bundle = new THREE.Mesh(sphere, cloth);
	bundle.scale.set(0.22, 0.12, 0.22);
	bundle.position.set(0.1, 0.28, 0.15);
	bundle.visible = false;
	scene.add(bundle);

	const hitList: Obj[] = [];

	const jars: Group[] = [];
	HERBS.forEach((herb, i) => {
		const pos = jarWorld(i);
		const group = new THREE.Group();
		group.position.set(pos.x, pos.y, pos.z);
		group.userData = { zone: 'jar', id: herb.id };
		const body = new THREE.Mesh(cyl, keepMat(mat(JAR_COLOR[herb.id])));
		body.scale.set(0.12, 0.22, 0.12);
		body.castShadow = true;
		body.userData = { zone: 'jar', id: herb.id };
		const lid = new THREE.Mesh(cyl, woodDark);
		lid.scale.set(0.13, 0.04, 0.13);
		lid.position.y = 0.14;
		lid.userData = { zone: 'jar', id: herb.id };
		const hit = new THREE.Mesh(cyl, ghost);
		hit.scale.set(0.22, 0.32, 0.22);
		hit.userData = { zone: 'jar', id: herb.id };
		group.add(body, lid, hit);
		scene.add(group);
		jars.push(group);
		hitList.push(body, hit);
	});

	const patient = new THREE.Group();
	scene.add(patient);
	const patientHit = new THREE.Mesh(cyl, ghost);
	patientHit.scale.set(0.55, 0.7, 0.55);
	patientHit.userData = { zone: 'patient' };
	patient.add(patientHit);
	hitList.push(patientHit);

	let paintedCase = '';

	function paintPatient(caseId: string) {
		if (paintedCase === caseId) return;
		paintedCase = caseId;
		for (const child of [...patient.children]) {
			if (child === patientHit) continue;
			patient.remove(child);
		}
		const add = (mesh: Mesh) => {
			mesh.castShadow = true;
			patient.add(mesh);
		};
		if (caseId === 'fox-draft') {
			const body = new THREE.Mesh(sphere, keepMat(mat(0xd4783a)));
			body.scale.set(0.28, 0.22, 0.34);
			body.position.y = 0.22;
			add(body);
			for (const side of [-1, 1]) {
				const ear = new THREE.Mesh(cone, keepMat(mat(0xc45a4a)));
				ear.scale.set(0.08, 0.16, 0.08);
				ear.position.set(side * 0.14, 0.48, -0.05);
				add(ear);
			}
			const tail = new THREE.Mesh(sphere, keepMat(mat(0xe8a060)));
			tail.scale.set(0.1, 0.08, 0.22);
			tail.position.set(0.22, 0.16, -0.22);
			add(tail);
		} else if (caseId === 'clerk-tea') {
			const torso = new THREE.Mesh(box, keepMat(mat(0x3a4a6a)));
			torso.scale.set(0.32, 0.4, 0.22);
			torso.position.y = 0.28;
			add(torso);
			const head = new THREE.Mesh(sphere, keepMat(mat(0xe8c8a0)));
			head.scale.set(0.14, 0.14, 0.14);
			head.position.y = 0.56;
			add(head);
			const brush = new THREE.Mesh(cyl, woodDark);
			brush.scale.set(0.02, 0.22, 0.02);
			brush.rotation.z = 0.6;
			brush.position.set(0.22, 0.32, 0.08);
			add(brush);
		} else if (caseId === 'turtle-well') {
			const shell = new THREE.Mesh(sphere, keepMat(mat(0x5a7a4a)));
			shell.scale.set(0.34, 0.16, 0.28);
			shell.position.y = 0.18;
			add(shell);
			const rim = new THREE.Mesh(torus, keepMat(mat(0x3a5a32)));
			rim.scale.set(0.22, 0.22, 0.22);
			rim.rotation.x = Math.PI / 2;
			rim.position.y = 0.18;
			add(rim);
			const head = new THREE.Mesh(sphere, keepMat(mat(0x86a373)));
			head.scale.set(0.1, 0.08, 0.14);
			head.position.set(0, 0.16, 0.28);
			add(head);
		} else {
			const sail = new THREE.Mesh(cone, keepMat(mat(0xe8dcc8)));
			sail.scale.set(0.28, 0.4, 0.04);
			sail.rotation.x = 0.3;
			sail.position.y = 0.4;
			add(sail);
			const stick = new THREE.Mesh(cyl, woodDark);
			stick.scale.set(0.02, 0.5, 0.02);
			stick.position.y = 0.28;
			add(stick);
			const ribbon = new THREE.Mesh(box, keepMat(mat(0xc45a4a)));
			ribbon.scale.set(0.06, 0.28, 0.02);
			ribbon.position.set(0.12, 0.08, -0.08);
			add(ribbon);
		}
	}

	function compactNow() {
		return isCompactClinic(canvas.clientWidth || window.innerWidth);
	}

	function applyLayout(world?: ClinicWorld) {
		const compact = world?.narrow || compactNow();
		const who = patientWorld(compact);
		patient.position.set(who.x, who.y, who.z);
		bench.position.set(compact ? 0 : -1.2, 0.18, compact ? 0.72 : 0.58);
		cabinet.position.set(compact ? 0 : 1.38, compact ? 0.42 : 1.12, compact ? -0.95 : -0.52);
		cabinet.scale.set(compact ? 2.95 : 2.45, compact ? 0.55 : 2.5, compact ? 1.7 : 0.36);
		lamp.visible = !compact;
		lamp.position.set(-1.35, 2.15, 0.35);
		HERBS.forEach((_, i) => {
			const pos = jarWorld(i, compact);
			jars[i]!.position.set(pos.x, pos.y, pos.z);
		});
	}

	function project(obj: Obj): { x: number; y: number } | null {
		if (!shown(obj)) return null;
		const v = obj.getWorldPosition(new THREE.Vector3());
		v.project(camera);
		const w = canvas.clientWidth || 1;
		const h = canvas.clientHeight || 1;
		return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
	}

	function applyDpr(world: ClinicWorld) {
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
			camera.fov = 34;
			camera.position.set(0, 6.9, 2.4);
			camera.lookAt(0, 0.35, 0.05);
		} else {
			camera.fov = 36;
			camera.position.set(-0.55, 2.35, 4.35);
			camera.lookAt(0.15, 0.92, -0.05);
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
			applyLayout(world);
			paintPatient(world.caseId);
			patient.visible = world.phase !== 'disclaimer';
			bundle.visible = world.phase === 'dispense' || world.phase === 'recovery';
			const selected = new Set(world.jars.map((jar) => jar.id));
			HERBS.forEach((herb, i) => {
				const jar = jars[i]!;
				const picked = selected.has(herb.id);
				jar.scale.setScalar(picked ? 1.18 : 1);
				const pos = jarWorld(i, world.narrow || compactNow());
				if (world.phase === 'dispense' && picked && !reduced) {
					const t = world.dispenseT;
					jar.position.set(
						pos.x + (0.1 - pos.x) * t,
						pos.y + (0.45 - pos.y) * t,
						pos.z + (0.15 - pos.z) * t
					);
				} else {
					jar.position.set(pos.x, pos.y, pos.z);
				}
			});
		},
		render(now) {
			lamp.rotation.y = Math.sin(now / 900) * 0.04;
			if (bundle.visible && !reduced) {
				bundle.position.y = 0.28 + Math.sin(now / 220) * 0.03;
			}
			renderer.render(scene, camera);
		},
		resize,
		dispose() {
			renderer.dispose();
			geos.forEach((g) => g.dispose());
			mats.forEach((m) => m.dispose());
		},
		hit(clientX, clientY) {
			const rect = canvas.getBoundingClientRect();
			const ndc = new THREE.Vector2(
				((clientX - rect.left) / rect.width) * 2 - 1,
				-((clientY - rect.top) / rect.height) * 2 + 1
			);
			const ray = new THREE.Raycaster();
			ray.setFromCamera(ndc, camera);
			const hits = ray.intersectObjects(hitList, false);
			for (const hit of hits) {
				if (!shown(hit.object)) continue;
				let node: Obj | null = hit.object;
				while (node) {
					const data = node.userData as { zone?: string; id?: HerbId };
					if (data.zone === 'jar' && data.id) return { zone: 'jar', id: data.id };
					if (data.zone === 'patient') return { zone: 'patient' };
					node = node.parent;
				}
			}
			return null;
		},
		projectPatient() {
			return project(patientHit);
		},
		projectJar(id) {
			const i = HERB_IDS.indexOf(id);
			return i < 0 ? null : project(jars[i]!);
		}
	};
}
