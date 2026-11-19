import * as THREE from 'three';
import { cameraPose, playFrustum } from './camera';
import { COLS, FLOOR_HEIGHT, FLOORS, ROWS, TILE, worldX, worldZ, type Station } from './floors';
import { ROLES, type Collar } from './roles';
import type { World } from './sim';

export interface ShangbanScene {
	sync(world: World, selectedId: string | null, overview: boolean): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	pick(clientX: number, clientY: number): string | null;
	orbit(dx: number): void;
}

const LOOK: Record<Collar, number> = {
	blue: 0xf97316,
	white: 0xe7eef8,
	'specialist-blue': 0x14b8a6,
	'specialist-white': 0xdbeafe,
	manager: 0x1e3a8a,
	ceo: 0x0f172a
};

function isDark() {
	return document.documentElement.classList.contains('dark');
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2d');
	draw(ctx, size);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

export function mountShangbanScene(canvas: HTMLCanvasElement): ShangbanScene | null {
	let renderer: ReturnType<typeof THREE.WebGLRenderer>;
	try {
		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
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
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor(0x000000, 0);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120);
	let yaw = Math.PI * 0.28;
	let overview = false;
	let focusY = 0;
	let reduceMotion = false;

	const unitBox = new THREE.BoxGeometry(1, 1, 1);
	const unitSphere = new THREE.SphereGeometry(0.5, 16, 12);
	const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
	const textures: Array<{ dispose: () => void }> = [];
	const materials: Array<{ dispose: () => void }> = [];
	const pickables: Array<ReturnType<typeof THREE.Mesh>> = [];

	const keep = (material: ReturnType<typeof THREE.MeshStandardMaterial>) => {
		materials.push(material);
		return material;
	};

	const mat = (color: number, extras: Record<string, unknown> = {}) =>
		keep(
			new THREE.MeshStandardMaterial({
				color,
				roughness: 0.62,
				metalness: 0.04,
				...extras
			})
		);

	let skin = mat(0xf1d4c0);
	let hair = mat(0x1e293b);
	let coral = mat(0xf97316);
	let teal = mat(0x14b8a6);
	let gold = mat(0xeab308);
	let blue = mat(0x3b82f6);
	let navy = mat(0x1e3a8a);
	let glass = mat(0xbfdbfe, { transparent: true, opacity: 0.38, roughness: 0.12, metalness: 0.18 });
	let wood = mat(0xc48a58);
	let cream = mat(0xf8efe2);
	let concrete = mat(0xcbd5e1);
	let city = mat(0x93c5fd);

	function label(text: string, fill: string) {
		const tex = canvasTexture((ctx, size) => {
			ctx.fillStyle = fill;
			ctx.fillRect(0, 0, size, size);
			ctx.fillStyle = '#fff7ed';
			ctx.font = '700 110px "Noto Sans SC", sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(text, size / 2, size / 2);
		}, 256);
		textures.push(tex);
		return keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
	}

	const hemi = new THREE.HemisphereLight(0xdbeafe, 0xf8efe2, 0.85);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xfff7ed, 1.15);
	sun.position.set(10, 22, 8);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.left = -18;
	sun.shadow.camera.right = 18;
	sun.shadow.camera.top = 22;
	sun.shadow.camera.bottom = -8;
	scene.add(sun);
	const fill = new THREE.DirectionalLight(0x93c5fd, 0.35);
	fill.position.set(-8, 10, -6);
	scene.add(fill);

	const building = new THREE.Group();
	scene.add(building);
	const people = new THREE.Group();
	scene.add(people);
	const parcels = new THREE.Group();
	scene.add(parcels);

	function floorY(id: number) {
		return (id - 1) * FLOOR_HEIGHT;
	}

	function box(
		parent: ReturnType<typeof THREE.Group>,
		material: ReturnType<typeof THREE.MeshStandardMaterial>,
		x: number,
		y: number,
		z: number,
		sx: number,
		sy: number,
		sz: number,
		cast = true
	) {
		const mesh = new THREE.Mesh(unitBox, material);
		mesh.position.set(x, y, z);
		mesh.scale.set(sx, sy, sz);
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		parent.add(mesh);
		return mesh;
	}

	function person(bodyColor: number, scale = 1, accent = 0x3b82f6) {
		const group = new THREE.Group();
		const cloth = mat(bodyColor);
		const body = new THREE.Mesh(unitBox, cloth);
		body.name = 'body';
		body.position.y = 0.52 * scale;
		body.scale.set(0.36 * scale, 0.9 * scale, 0.28 * scale);
		body.castShadow = true;
		const head = new THREE.Mesh(unitSphere, skin);
		head.position.y = 1.08 * scale;
		head.scale.setScalar(0.32 * scale);
		const hairMesh = new THREE.Mesh(unitSphere, hair);
		hairMesh.position.set(0, 1.2 * scale, -0.02 * scale);
		hairMesh.scale.set(0.34 * scale, 0.2 * scale, 0.3 * scale);
		const armL = new THREE.Mesh(unitBox, cloth);
		armL.name = 'armL';
		armL.position.set(-0.28 * scale, 0.62 * scale, 0);
		armL.scale.set(0.1 * scale, 0.46 * scale, 0.1 * scale);
		const armR = new THREE.Mesh(unitBox, cloth);
		armR.name = 'armR';
		armR.position.set(0.28 * scale, 0.62 * scale, 0);
		armR.scale.set(0.1 * scale, 0.46 * scale, 0.1 * scale);
		const legL = new THREE.Mesh(unitBox, cloth);
		legL.name = 'legL';
		legL.position.set(-0.1 * scale, 0.22 * scale, 0);
		legL.scale.set(0.1 * scale, 0.44 * scale, 0.12 * scale);
		const legR = new THREE.Mesh(unitBox, cloth);
		legR.name = 'legR';
		legR.position.set(0.1 * scale, 0.22 * scale, 0);
		legR.scale.set(0.1 * scale, 0.44 * scale, 0.12 * scale);
		const cap = new THREE.Mesh(unitCyl, mat(accent));
		cap.name = 'hat';
		cap.position.y = 1.28 * scale;
		cap.scale.set(0.36 * scale, 0.14 * scale, 0.36 * scale);
		const tie = new THREE.Mesh(unitBox, mat(accent));
		tie.name = 'tie';
		tie.position.set(0, 0.72 * scale, 0.16 * scale);
		tie.scale.set(0.08 * scale, 0.28 * scale, 0.04 * scale);
		group.add(body, head, hairMesh, armL, armR, legL, legR, cap, tie);
		return group;
	}

	function furnish(
		floorGroup: ReturnType<typeof THREE.Group>,
		station: Station,
		accent: ReturnType<typeof THREE.MeshStandardMaterial>
	) {
		const x = worldX(station.x);
		const z = worldZ(station.z);
		const prop = new THREE.Group();
		prop.position.set(x, 0, z);
		if (station.kind === 'elevator') {
			box(prop, navy, 0, 1.2, 0, 1.1, 2.4, 1.1, false);
			box(prop, gold, 0, 1.2, 0.52, 0.7, 1.8, 0.08, false);
			const plate = new THREE.Mesh(unitBox, label(String(station.floor), '#1d4ed8'));
			plate.position.set(0, 2.15, 0.58);
			plate.scale.set(0.5, 0.35, 0.04);
			prop.add(plate);
		} else if (station.kind === 'inbound') {
			box(prop, concrete, 0, 0.28, 0, 1.6, 0.56, 1.1);
			box(prop, coral, 0, 0.7, -0.4, 1.6, 0.12, 0.2);
		} else if (station.kind === 'bay') {
			box(prop, accent, 0, 0.7, 0, 1.15, 1.4, 0.25);
			const plate = new THREE.Mesh(unitBox, label(station.bay ?? '?', '#ea580c'));
			plate.position.set(0, 1.35, 0.2);
			plate.scale.set(0.55, 0.4, 0.05);
			prop.add(plate);
		} else if (station.kind === 'desk' && station.floor === 2) {
			box(prop, wood, 0, 0.45, 0, 1.4, 0.12, 1.4);
			const top = new THREE.Mesh(unitCyl, teal);
			top.position.y = 0.52;
			top.scale.set(1.2, 0.08, 1.2);
			prop.add(top);
			box(prop, cream, 0.35, 0.9, 0.2, 0.08, 0.7, 0.08);
		} else if (station.kind === 'bench') {
			box(prop, concrete, 0, 0.5, 0, 1.5, 0.7, 0.8);
			box(prop, gold, 0.4, 0.95, 0.1, 0.2, 0.2, 0.5);
			if (station.id === 'rack') {
				box(prop, navy, 0, 1.1, 0, 0.9, 1.8, 0.55);
				box(prop, teal, 0, 1.1, 0.28, 0.7, 1.4, 0.04, false);
			}
		} else if (station.kind === 'board') {
			box(prop, navy, 0, 1.1, 0, 1.6, 1.5, 0.12);
			box(prop, gold, 0, 1.1, 0.08, 1.3, 1.2, 0.04, false);
		} else if (station.kind === 'office') {
			box(prop, wood, 0, 0.45, 0, 1.8, 0.14, 1.1);
			box(prop, glass, 0, 1.2, -0.55, 1.8, 1.6, 0.08, false);
			box(prop, coral, 0.55, 0.85, 0.15, 0.12, 0.7, 0.12);
		} else if (station.kind === 'break') {
			box(prop, teal, 0, 0.28, 0, 0.7, 0.28, 0.7);
			box(prop, cream, 0.18, 0.48, 0.1, 0.12, 0.16, 0.12, false);
			box(prop, coral, 0.18, 0.58, 0.1, 0.08, 0.08, 0.08, false);
		} else {
			box(prop, wood, 0, 0.48, 0, 1.3, 0.14, 0.8);
			box(prop, cream, 0, 0.95, 0, 0.15, 0.7, 0.15);
		}
		const hit = box(prop, glass, 0, 0.7, 0, 1.2, 1.4, 1.2, false);
		hit.material = keep(
			new THREE.MeshStandardMaterial({
				color: 0x93c5fd,
				transparent: true,
				opacity: 0.01,
				depthWrite: false
			})
		);
		hit.userData.stationId = station.id;
		pickables.push(hit);
		floorGroup.add(prop);
		return prop;
	}

	const floorGroups: Array<ReturnType<typeof THREE.Group>> = [];
	const glowPads: Array<ReturnType<typeof THREE.Mesh>> = [];

	function buildFloors() {
		for (const def of FLOORS) {
			const group = new THREE.Group();
			group.position.y = floorY(def.id);
			const slab = box(
				group,
				keep(new THREE.MeshStandardMaterial({ color: def.carpet })),
				0,
				-0.08,
				0,
				COLS * TILE + 0.4,
				0.16,
				ROWS * TILE + 0.4,
				false
			);
			slab.receiveShadow = true;
			const wallMat = keep(new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 }));
			const depth = ROWS * TILE + 0.4;
			const width = COLS * TILE + 0.4;
			box(group, wallMat, 0, 1.3, -depth / 2 + 0.08, width, 2.6, 0.16, false);
			box(group, wallMat, -width / 2 + 0.08, 1.3, 0, 0.16, 2.6, depth, false);
			box(group, wallMat, width / 2 - 0.08, 1.3, 0, 0.16, 2.6, depth, false);
			if (def.id === 1) {
				box(group, coral, worldX(5), 0.2, worldZ(2), 3.2, 0.08, 0.45, false);
				box(group, coral, worldX(4), 0.22, worldZ(5), 0.4, 0.28, 0.32, false);
				box(group, gold, worldX(5), 0.22, worldZ(5), 0.4, 0.22, 0.32, false);
			}
			if (def.id === 2) {
				const plant = new THREE.Mesh(unitCyl, teal);
				plant.position.set(worldX(9), 0.55, worldZ(7));
				plant.scale.set(0.28, 1.1, 0.28);
				group.add(plant);
				box(group, wood, worldX(9), 0.45, worldZ(5), 1.1, 0.12, 0.7, false);
				box(group, cream, worldX(9), 0.85, worldZ(5), 0.12, 0.55, 0.4, false);
			}
			if (def.id === 3) {
				box(group, navy, worldX(4), 0.7, worldZ(6), 0.7, 1.2, 0.5, false);
				box(group, teal, worldX(4), 0.7, worldZ(6.35), 0.55, 0.9, 0.04, false);
			}
			if (def.id === 4) {
				box(group, wood, worldX(9), 0.45, worldZ(6), 1.2, 0.12, 0.8, false);
				box(group, cream, worldX(9), 0.72, worldZ(6), 0.35, 0.08, 0.45, false);
			}
			if (def.id === 5) {
				const windowPane = box(group, city, 0, 1.5, -depth / 2 + 0.14, 4.2, 1.6, 0.06, false);
				windowPane.material = glass;
				box(group, wood, worldX(3), 0.45, worldZ(5), 1.4, 0.12, 0.8, false);
			}
			for (const station of def.stations) {
				furnish(group, station, def.id === 1 ? coral : def.id === 3 ? gold : blue);
			}
			const rim = box(
				group,
				keep(
					new THREE.MeshStandardMaterial({
						color: def.color,
						emissive: def.color,
						emissiveIntensity: 0.12
					})
				),
				0,
				0.02,
				depth / 2 - 0.2,
				width * 0.92,
				0.06,
				0.12,
				false
			);
			glowPads.push(rim);
			building.add(group);
			floorGroups.push(group);
		}
	}

	buildFloors();

	const playerMesh = person(LOOK.blue, 1.08, 0x0f766e);
	const ring = new THREE.Mesh(
		new THREE.TorusGeometry(0.42, 0.04, 8, 24),
		keep(
			new THREE.MeshStandardMaterial({
				color: 0x3b82f6,
				emissive: 0x3b82f6,
				emissiveIntensity: 0.4
			})
		)
	);
	ring.rotation.x = Math.PI / 2;
	ring.position.y = 0.05;
	playerMesh.add(ring);
	people.add(playerMesh);

	const npcMap = new Map<number, ReturnType<typeof THREE.Group>>();
	const pkgMap = new Map<string, ReturnType<typeof THREE.Mesh>>();

	function applyPalette() {
		const dark = isDark();
		hemi.color.set(dark ? 0x1e3a5f : 0xdbeafe);
		hemi.groundColor.set(dark ? 0x0f172a : 0xf8efe2);
		cream.color.set(dark ? 0x1e293b : 0xf8efe2);
		concrete.color.set(dark ? 0x334155 : 0xcbd5e1);
		city.color.set(dark ? 0x1d4ed8 : 0x93c5fd);
	}

	applyPalette();
	const observer = new MutationObserver(applyPalette);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
	const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	reduceMotion = Boolean(motion?.matches);
	const onMotion = () => {
		reduceMotion = Boolean(motion?.matches);
	};
	motion?.addEventListener?.('change', onMotion);

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();

	function placeCamera() {
		const pose = cameraPose(overview, focusY, yaw);
		camera.position.set(pose.x, pose.y, pose.z);
		camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
		camera.updateProjectionMatrix();
	}

	function resize() {
		const parent = canvas.parentElement ?? canvas;
		const w = Math.max(1, parent.clientWidth);
		const h = Math.max(1, parent.clientHeight);
		const aspect = w / h;
		const frustum = playFrustum(overview, h);
		camera.left = -frustum * aspect;
		camera.right = frustum * aspect;
		camera.top = frustum;
		camera.bottom = -frustum;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, h < 700 ? 1.35 : 1.75));
		renderer.setSize(w, h, false);
		placeCamera();
	}

	function sync(world: World, selectedId: string | null, nextOverview: boolean) {
		overview = nextOverview;
		focusY = floorY(world.player.floor);
		const role = ROLES.find((item) => item.id === world.player.roleId);
		const body = playerMesh.getObjectByName('body') as ReturnType<typeof THREE.Mesh> | undefined;
		if (role && body?.material?.color) {
			body.material.color.setHex(role.look.body);
		}
		const hat = playerMesh.getObjectByName('hat');
		const tie = playerMesh.getObjectByName('tie');
		if (hat) hat.visible = Boolean(role?.look.hat);
		if (tie) tie.visible = Boolean(role?.look.tie);
		playerMesh.position.set(
			worldX(world.player.x),
			floorY(world.player.floor),
			worldZ(world.player.z)
		);
		playerMesh.rotation.y = world.player.facing;
		playerMesh.visible = true;

		for (let i = 0; i < floorGroups.length; i++) {
			const group = floorGroups[i];
			if (!group) continue;
			const current = i + 1 === world.player.floor;
			group.visible = overview || current;
			group.traverse(
				(obj: {
					material?: { transparent?: boolean; opacity?: number; userData?: { skipFade?: boolean } };
				}) => {
					const material = obj.material;
					if (!material || material.userData?.skipFade) return;
					material.transparent = overview && !current;
					material.opacity = overview && !current ? 0.38 : 1;
				}
			);
		}

		for (const npc of world.npcs) {
			let group = npcMap.get(npc.id);
			if (!group) {
				group = person(LOOK[npc.look] ?? LOOK.blue, 0.92);
				const npcHat = group.getObjectByName('hat');
				const npcTie = group.getObjectByName('tie');
				if (npcHat) npcHat.visible = npc.look === 'blue' || npc.look === 'specialist-blue';
				if (npcTie)
					npcTie.visible =
						npc.look === 'white' ||
						npc.look === 'specialist-white' ||
						npc.look === 'manager' ||
						npc.look === 'ceo';
				npcMap.set(npc.id, group);
				people.add(group);
			}
			const show = overview || npc.floor === world.player.floor;
			group.visible = show;
			if (!show) continue;
			const sit = npc.activity === 'coffee' ? 0.12 : 0;
			group.position.set(worldX(npc.x), floorY(npc.floor) - sit, worldZ(npc.z));
			group.userData.phase = npc.phase;
			group.userData.activity = npc.activity;
			group.userData.bob = npc.id;
			group.userData.baseY = floorY(npc.floor) - sit;
		}

		const seenPkg = new Set<string>();
		for (const boxItem of world.packages) {
			if (boxItem.held) continue;
			seenPkg.add(boxItem.id);
			let mesh = pkgMap.get(boxItem.id);
			if (!mesh) {
				mesh = new THREE.Mesh(unitBox, coral);
				mesh.scale.set(0.35, 0.28, 0.28);
				mesh.castShadow = true;
				pkgMap.set(boxItem.id, mesh);
				parcels.add(mesh);
			}
			mesh.position.set(worldX(boxItem.x), floorY(1) + 0.35, worldZ(boxItem.z));
		}
		for (const [id, mesh] of pkgMap) {
			if (seenPkg.has(id)) continue;
			parcels.remove(mesh);
			pkgMap.delete(id);
		}

		for (const hit of pickables) {
			const id = hit.userData.stationId as string;
			const matHit = hit.material;
			matHit.opacity = selectedId === id ? 0.22 : 0.01;
			matHit.emissive = new THREE.Color(selectedId === id ? 0x3b82f6 : 0x000000);
		}
		placeCamera();
	}

	function pick(clientX: number, clientY: number): string | null {
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		const hits = raycaster.intersectObjects(pickables, false);
		const id = hits[0]?.object.userData.stationId;
		return typeof id === 'string' ? id : null;
	}

	function orbit(dx: number) {
		yaw += dx * 0.006;
		yaw = Math.max(0.12, Math.min(Math.PI * 0.55, yaw));
		placeCamera();
	}

	function render(now: number) {
		if (!reduceMotion) {
			const swing = Math.sin(now * 0.012);
			const legL = playerMesh.getObjectByName('legL');
			const legR = playerMesh.getObjectByName('legR');
			if (legL) legL.rotation.x = swing * 0.35;
			if (legR) legR.rotation.x = -swing * 0.35;
			for (const group of npcMap.values()) {
				const base = Number(group.userData.baseY) || 0;
				const activity = group.userData.activity as string;
				const armL = group.getObjectByName('armL');
				const armR = group.getObjectByName('armR');
				if (group.userData.phase === 'walk') {
					group.position.y = base + Math.abs(Math.sin(now * 0.014 + group.userData.bob)) * 0.05;
				} else {
					group.position.y = base;
				}
				if (armL && armR) {
					if (activity === 'type') {
						armL.rotation.x = Math.sin(now * 0.02 + group.userData.bob) * 0.45;
						armR.rotation.x = Math.sin(now * 0.02 + group.userData.bob + 1) * 0.45;
					} else if (activity === 'repair') {
						armR.rotation.z = -0.6 + Math.sin(now * 0.01) * 0.15;
					} else if (activity === 'meet' || activity === 'chat') {
						armL.rotation.z = 0.35;
					} else {
						armL.rotation.x = 0;
						armR.rotation.x = 0;
						armL.rotation.z = 0;
						armR.rotation.z = 0;
					}
				}
			}
		}
		renderer.render(scene, camera);
	}

	function dispose() {
		observer.disconnect();
		motion?.removeEventListener?.('change', onMotion);
		renderer.dispose();
		unitBox.dispose();
		unitSphere.dispose();
		unitCyl.dispose();
		ring.geometry.dispose();
		for (const texture of textures) texture.dispose();
		for (const material of materials) material.dispose();
	}

	resize();
	return { sync, render, resize, dispose, pick, orbit };
}
