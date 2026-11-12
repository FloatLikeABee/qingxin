import * as THREE from 'three';
import { GOODS, SKUS, type SkuId } from './goods';
import { CHECKOUT, COLS, ENTRANCE, ROWS, SHELF_SPOTS, TILE, worldX, worldZ } from './layout';
import type { SimState } from './sim';

export interface StoreScene {
	sync(sim: SimState, selectedId: number | null): void;
	render(now: number): void;
	resize(): void;
	dispose(): void;
	pick(clientX: number, clientY: number): number | null;
	orbit(dx: number): void;
}

const CLOTHES = [0x3b82f6, 0xf97316, 0x14b8a6, 0xeab308, 0xc45c6a, 0x1d4ed8, 0x0f766e];

function isDark(): boolean {
	return document.documentElement.classList.contains('dark');
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512) {
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

function floorTexture(dark: boolean) {
	return canvasTexture((ctx, size) => {
		const a = dark ? '#1d314c' : '#f6ead6';
		const b = dark ? '#243a58' : '#e7f0fb';
		const step = size / 8;
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
				ctx.fillRect(x * step, y * step, step + 1, step + 1);
			}
		}
		ctx.strokeStyle = dark ? 'rgba(96,165,250,0.22)' : 'rgba(59,130,246,0.2)';
		ctx.lineWidth = 2;
		for (let i = 0; i <= 8; i++) {
			const p = i * step;
			ctx.beginPath();
			ctx.moveTo(p, 0);
			ctx.lineTo(p, size);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, p);
			ctx.lineTo(size, p);
			ctx.stroke();
		}
	});
}

function signTexture() {
	return canvasTexture((ctx, size) => {
		ctx.fillStyle = '#2563eb';
		ctx.fillRect(0, 0, size, size);
		ctx.fillStyle = '#93c5fd';
		ctx.fillRect(0, 0, size, 18);
		ctx.fillRect(0, size - 18, size, 18);
		ctx.fillStyle = '#fff7ed';
		ctx.font = '600 92px "Noto Sans SC", sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('轻心便利', size / 2, size / 2 - 10);
		ctx.font = '500 36px Outfit, sans-serif';
		ctx.fillStyle = '#fde68a';
		ctx.fillText('QINGXIN', size / 2, size / 2 + 70);
	}, 512);
}

function mat(color: number, extras: Record<string, unknown> = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.62,
		metalness: 0.04,
		...extras
	});
}

export function mountStoreScene(canvas: HTMLCanvasElement): StoreScene | null {
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: true,
		powerPreference: 'high-performance'
	});
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
	const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 80);
	let yaw = Math.PI * 0.28;
	const look = new THREE.Vector3(0.2, 0.2, 0.4);

	const unitBox = new THREE.BoxGeometry(1, 1, 1);
	const unitSphere = new THREE.SphereGeometry(0.5, 18, 14);
	const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);

	const textures: Array<{ dispose: () => void }> = [];
	const materials: Array<{ dispose: () => void }> = [];
	const keep = (material: ReturnType<typeof mat>) => {
		materials.push(material);
		return material;
	};

	let wood = keep(mat(0xc48a58));
	let cream = keep(mat(0xf8efe2));
	let wall = keep(mat(0xe7f1fc));
	let trim = keep(mat(0x3b82f6));
	let coral = keep(mat(0xf97316));
	let teal = keep(mat(0x14b8a6));
	let gold = keep(mat(0xeab308));
	let counterTop = keep(mat(0xf8fafc));
	let asphalt = keep(mat(0x94a3b8));
	let glass = keep(
		mat(0xbfdbfe, { transparent: true, opacity: 0.38, roughness: 0.12, metalness: 0.2 })
	);
	const skuMats = Object.fromEntries(
		SKUS.map((sku) => [sku, keep(mat(Number.parseInt(GOODS[sku].color.slice(1), 16)))])
	) as Record<SkuId, ReturnType<typeof mat>>;
	const clothMats = CLOTHES.map((hex) => keep(mat(hex)));
	const skinMat = keep(mat(0xf2c7a4));
	const hairMat = keep(mat(0x1f2937));
	const bagMat = keep(mat(0xf8efe2));
	let floorMat = keep(mat(0xffffff, { roughness: 0.86, metalness: 0 }));

	const hemi = new THREE.HemisphereLight(0xb9d7ff, 0xe8d5b5, 0.85);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xfff6e8, 1.35);
	sun.position.set(8, 14, 7);
	sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024);
	sun.shadow.camera.left = -12;
	sun.shadow.camera.right = 12;
	sun.shadow.camera.top = 12;
	sun.shadow.camera.bottom = -12;
	scene.add(sun);
	const pendant = new THREE.PointLight(0xffe7c2, 1.1, 16);
	pendant.position.set(worldX(4), 3.2, worldZ(4));
	scene.add(pendant);
	const windowLight = new THREE.PointLight(0x93c5fd, 0.55, 12);
	windowLight.position.set(worldX(5), 2.4, worldZ(8));
	scene.add(windowLight);

	const root = new THREE.Group();
	scene.add(root);
	const stockGroups: Array<ReturnType<typeof THREE.Group>> = [];
	const crateGroups: Array<ReturnType<typeof THREE.Group>> = [];
	const shelfPickables: Array<ReturnType<typeof THREE.Mesh>> = [];
	const glowPads: Array<ReturnType<typeof THREE.Mesh>> = [];
	const shopperMap = new Map<number, ReturnType<typeof THREE.Group>>();
	const shoppersRoot = new THREE.Group();
	root.add(shoppersRoot);

	function addBox(
		parent: { add: (child: unknown) => void },
		material: unknown,
		x: number,
		y: number,
		z: number,
		sx: number,
		sy: number,
		sz: number,
		user?: Record<string, unknown>
	) {
		const mesh = new THREE.Mesh(unitBox, material);
		mesh.position.set(x, y, z);
		mesh.scale.set(sx, sy, sz);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		if (user) Object.assign(mesh.userData, user);
		parent.add(mesh);
		return mesh;
	}

	let floorMesh: ReturnType<typeof THREE.Mesh> | null = null;
	let signMesh: ReturnType<typeof THREE.Mesh> | null = null;
	let floorTex: ReturnType<typeof THREE.CanvasTexture> | null = null;
	const signTex = signTexture();
	textures.push(signTex);
	const signMat = keep(mat(0xffffff, { map: signTex, roughness: 0.45 }));

	function paintFloor() {
		if (floorTex) {
			floorTex.dispose();
			textures.splice(textures.indexOf(floorTex), 1);
		}
		floorTex = floorTexture(isDark());
		floorTex.wrapS = THREE.RepeatWrapping;
		floorTex.wrapT = THREE.RepeatWrapping;
		floorTex.repeat.set(COLS / 2, ROWS / 2);
		textures.push(floorTex);
		floorMat.map = floorTex;
		floorMat.needsUpdate = true;
		if (floorMesh) return;
		floorMesh = addBox(root, floorMat, 0, -0.04, 0, COLS * TILE + 0.4, 0.08, ROWS * TILE + 0.4);
	}

	function applyPalette() {
		const dark = isDark();
		scene.background = new THREE.Color(dark ? 0x0b1526 : 0xcfe4ff);
		hemi.color.set(dark ? 0x8fb4e8 : 0xb9d7ff);
		hemi.groundColor.set(dark ? 0x1b283c : 0xe8d5b5);
		wood.color.set(dark ? 0x8a5a38 : 0xc48a58);
		cream.color.set(dark ? 0x2a3b52 : 0xf8efe2);
		wall.color.set(dark ? 0x1c2e46 : 0xe7f1fc);
		trim.color.set(dark ? 0x60a5fa : 0x3b82f6);
		asphalt.color.set(dark ? 0x334155 : 0x94a3b8);
		sun.intensity = dark ? 0.9 : 1.35;
		pendant.intensity = dark ? 1.4 : 1.1;
		paintFloor();
	}

	function buildStatic() {
		const wallH = 2.55;
		const thick = 0.18;
		const halfW = (COLS * TILE) / 2;
		const halfD = (ROWS * TILE) / 2;
		addBox(root, wall, 0, wallH / 2, -halfD, COLS * TILE + 0.2, wallH, thick);
		addBox(root, wall, -halfW, wallH / 2, 0, thick, wallH, ROWS * TILE);
		addBox(root, wall, halfW, wallH / 2, 0, thick, wallH, ROWS * TILE);
		const door = TILE * 1.35;
		const frontZ = halfD;
		const side = (COLS * TILE - door) / 2;
		addBox(root, wall, -halfW + side / 2 + 0.05, wallH / 2, frontZ, side, wallH, thick);
		addBox(root, wall, halfW - side / 2 - 0.05, wallH / 2, frontZ, side, wallH, thick);
		addBox(root, trim, 0, wallH - 0.08, frontZ, door + 0.3, 0.16, 0.22);
		addBox(root, coral, 0, wallH + 0.12, frontZ - 0.2, door + 1.4, 0.12, 0.7);
		addBox(root, gold, 0, wallH + 0.22, frontZ - 0.2, door + 0.5, 0.08, 0.5);

		addBox(root, asphalt, 0, -0.06, halfD + 1.35, COLS * TILE + 2.4, 0.06, 2.4);
		addBox(root, teal, worldX(ENTRANCE.x), 0.02, worldZ(ENTRANCE.z) + 0.35, TILE * 1.1, 0.04, TILE);
		addBox(root, glass, -halfW + 0.04, 1.45, worldZ(3), 0.05, 1.2, 2.4);
		addBox(root, glass, -halfW + 0.04, 1.45, worldZ(6.2), 0.05, 1.2, 1.6);
		addBox(root, trim, 0, 0.08, -halfD + 0.12, COLS * TILE, 0.16, 0.08);

		signMesh = addBox(root, signMat, 0, 2.05, -halfD + 0.14, 3.2, 0.9, 0.08);

		const glowMatBase = () => keep(mat(0x3b82f6, { emissive: 0x3b82f6, emissiveIntensity: 0 }));

		for (const spot of SHELF_SPOTS) {
			const x = worldX(spot.x);
			const z = worldZ(spot.z);
			const cooler = spot.sku === 'milk';
			const accent = skuMats[spot.sku];
			const glow = addBox(root, glowMatBase(), x, 0.015, z + 0.28, TILE * 0.95, 0.03, TILE * 0.9, {
				shelfId: spot.id
			});
			glowPads[spot.id] = glow;
			shelfPickables.push(glow);

			if (cooler) {
				addBox(root, teal, x, 0.95, z - 0.22, TILE * 0.86, 1.9, 0.1, { shelfId: spot.id });
				addBox(root, teal, x - 0.42, 0.95, z, 0.1, 1.9, TILE * 0.55, { shelfId: spot.id });
				addBox(root, teal, x + 0.42, 0.95, z, 0.1, 1.9, TILE * 0.55, { shelfId: spot.id });
				addBox(root, teal, x, 1.88, z, TILE * 0.86, 0.1, TILE * 0.58, { shelfId: spot.id });
				addBox(root, cream, x, 0.08, z, TILE * 0.82, 0.08, TILE * 0.52);
				addBox(root, cream, x, 0.7, z, TILE * 0.72, 0.05, TILE * 0.46);
				addBox(root, cream, x, 1.28, z, TILE * 0.72, 0.05, TILE * 0.46);
				const door = addBox(root, glass, x, 0.95, z + 0.3, TILE * 0.78, 1.7, 0.05, {
					shelfId: spot.id
				});
				shelfPickables.push(door);
			} else {
				const posts: Array<[number, number]> = [
					[-0.4, -0.22],
					[0.4, -0.22],
					[-0.4, 0.22],
					[0.4, 0.22]
				];
				for (const [px, pz] of posts) {
					addBox(root, wood, x + px, 0.7, z + pz, 0.08, 1.4, 0.08);
				}
				addBox(root, cream, x, 0.1, z, TILE * 0.86, 0.08, TILE * 0.52);
				addBox(root, cream, x, 0.58, z, TILE * 0.82, 0.06, TILE * 0.5);
				addBox(root, cream, x, 1.04, z, TILE * 0.82, 0.06, TILE * 0.5);
				addBox(root, cream, x, 1.42, z, TILE * 0.82, 0.06, TILE * 0.5);
				const back = addBox(root, wall, x, 0.78, z - 0.28, TILE * 0.86, 1.45, 0.05, {
					shelfId: spot.id
				});
				shelfPickables.push(back);
				addBox(root, accent, x, 1.48, z, TILE * 0.86, 0.07, TILE * 0.54, { shelfId: spot.id });
			}
			const stock = new THREE.Group();
			stock.position.set(x, 0, z);
			root.add(stock);
			stockGroups[spot.id] = stock;
		}

		const cx = worldX(CHECKOUT.x);
		const cz = worldZ(CHECKOUT.z);
		addBox(root, wood, cx, 0.45, cz, TILE * 1.05, 0.9, TILE * 0.85);
		addBox(root, counterTop, cx, 0.92, cz, TILE * 1.12, 0.08, TILE * 0.92);
		addBox(root, gold, cx + 0.22, 1.12, cz, 0.28, 0.32, 0.22);
		addBox(root, trim, cx - 0.18, 1.18, cz + 0.12, 0.18, 0.44, 0.12);
		const queueTape = keep(mat(0xf97316));
		addBox(root, queueTape, worldX(8.4), 0.03, worldZ(6), TILE * 1.6, 0.03, 0.12);

		const cashier = new THREE.Group();
		cashier.position.set(cx, 0, cz - 0.35);
		addBox(cashier, keep(mat(0x1e3a5f)), 0, 0.55, 0, 0.42, 1.1, 0.28);
		const head = new THREE.Mesh(unitSphere, keep(mat(0xf2c7a4)));
		head.position.set(0, 1.28, 0);
		head.scale.set(0.36, 0.36, 0.36);
		cashier.add(head);
		root.add(cashier);

		for (let i = 0; i < SKUS.length; i++) {
			const group = new THREE.Group();
			group.position.set(worldX(1.4 + i * 1.6), 0, worldZ(1));
			root.add(group);
			crateGroups[i] = group;
			addBox(group, wood, 0, 0.18, 0, 0.7, 0.36, 0.55);
		}

		const lamp = new THREE.Mesh(unitCyl, gold);
		lamp.position.set(worldX(4), 2.55, worldZ(3.5));
		lamp.scale.set(0.42, 0.08, 0.42);
		root.add(lamp);
		const cord = new THREE.Mesh(unitCyl, keep(mat(0x64748b)));
		cord.position.set(worldX(4), 2.85, worldZ(3.5));
		cord.scale.set(0.03, 0.55, 0.03);
		root.add(cord);
	}

	function fillStock(
		group: { children: unknown[]; remove: (child: unknown) => void; add: (child: unknown) => void },
		sku: SkuId,
		count: number,
		cooler: boolean
	) {
		while (group.children.length) group.remove(group.children[0]);
		const material = skuMats[sku];
		const boards = cooler ? [0.78, 1.36] : [0.68, 1.14, 1.52];
		for (let i = 0; i < count; i++) {
			const cols = 3;
			const col = i % cols;
			const row = Math.min(boards.length - 1, Math.floor(i / cols));
			const mesh =
				sku === 'water' ? new THREE.Mesh(unitCyl, material) : new THREE.Mesh(unitBox, material);
			mesh.position.set((col - 1) * 0.26, boards[row] ?? 0.68, 0.06);
			if (sku === 'water') mesh.scale.set(0.16, 0.36, 0.16);
			else if (sku === 'bread') mesh.scale.set(0.24, 0.12, 0.18);
			else if (sku === 'milk') mesh.scale.set(0.14, 0.3, 0.14);
			else if (sku === 'bento') mesh.scale.set(0.26, 0.1, 0.2);
			else mesh.scale.set(0.18, 0.2, 0.14);
			mesh.castShadow = true;
			group.add(mesh);
		}
	}

	function fillCrate(
		group: { children: unknown[]; remove: (child: unknown) => void; add: (child: unknown) => void },
		sku: SkuId,
		count: number
	) {
		while (group.children.length > 1) group.remove(group.children[1]);
		const stacks = Math.min(6, Math.ceil(count / 4));
		for (let i = 0; i < stacks; i++) {
			const mesh = new THREE.Mesh(unitBox, skuMats[sku]);
			mesh.position.set(((i % 2) - 0.5) * 0.22, 0.42 + Math.floor(i / 2) * 0.16, 0);
			mesh.scale.set(0.28, 0.14, 0.28);
			group.add(mesh);
		}
	}

	function shopperMesh(id: number, hue: number) {
		const group = new THREE.Group();
		const cloth = clothMats[Math.floor(hue * clothMats.length)] ?? clothMats[0];
		const body = new THREE.Mesh(unitBox, cloth);
		body.position.y = 0.52;
		body.scale.set(0.36, 0.9, 0.28);
		body.castShadow = true;
		const head = new THREE.Mesh(unitSphere, skinMat);
		head.position.y = 1.08;
		head.scale.set(0.32, 0.32, 0.32);
		const hair = new THREE.Mesh(unitSphere, hairMat);
		hair.position.set(0, 1.2, -0.02);
		hair.scale.set(0.34, 0.2, 0.3);
		const bag = new THREE.Mesh(unitBox, bagMat);
		bag.name = 'bag';
		bag.position.set(0.22, 0.42, 0);
		bag.scale.set(0.14, 0.18, 0.12);
		group.add(body, head, hair, bag);
		group.userData.id = id;
		shoppersRoot.add(group);
		return group;
	}

	buildStatic();
	applyPalette();
	const observer = new MutationObserver(applyPalette);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const lastStock: number[] = SHELF_SPOTS.map(() => -1);
	const lastStorage: number[] = SKUS.map(() => -1);

	function placeCamera() {
		const radius = 14.2;
		camera.position.set(Math.cos(yaw) * radius, 9.1, Math.sin(yaw) * radius);
		camera.lookAt(look);
		camera.updateProjectionMatrix();
	}

	function resize() {
		const parent = canvas.parentElement ?? canvas;
		const w = Math.max(1, parent.clientWidth);
		const h = Math.max(1, parent.clientHeight);
		const aspect = w / h;
		const frustum = h < 700 ? 6.9 : 7.35;
		camera.left = -frustum * aspect;
		camera.right = frustum * aspect;
		camera.top = frustum;
		camera.bottom = -frustum;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(w, h, false);
		placeCamera();
	}

	function sync(sim: SimState, selectedId: number | null) {
		for (const shelf of sim.shelves) {
			const group = stockGroups[shelf.id];
			if (!group) continue;
			if (lastStock[shelf.id] !== shelf.stock) {
				fillStock(group, shelf.sku, shelf.stock, shelf.sku === 'milk');
				lastStock[shelf.id] = shelf.stock;
			}
			const glow = glowPads[shelf.id];
			if (glow) {
				const empty = shelf.stock === 0;
				const selected = selectedId === shelf.id;
				glow.material.emissive.setHex(selected ? 0x3b82f6 : empty ? 0xc45c6a : 0x000000);
				glow.material.emissiveIntensity = selected ? 0.55 : empty ? 0.32 : 0.04;
			}
		}
		SKUS.forEach((sku, index) => {
			const count = sim.storage[sku];
			if (lastStorage[index] === count) return;
			lastStorage[index] = count;
			const group = crateGroups[index];
			if (group) fillCrate(group, sku, count);
		});

		const seen = new Set<number>();
		for (const shopper of sim.shoppers) {
			seen.add(shopper.id);
			let group = shopperMap.get(shopper.id);
			if (!group) {
				group = shopperMesh(shopper.id, shopper.hue);
				group.position.set(worldX(shopper.x), 0, worldZ(shopper.z));
				shopperMap.set(shopper.id, group);
			}
			const targetX = worldX(shopper.x);
			const targetZ = worldZ(shopper.z);
			group.position.x += (targetX - group.position.x) * 0.28;
			group.position.z += (targetZ - group.position.z) * 0.28;
			const dx = targetX - group.position.x;
			const dz = targetZ - group.position.z;
			if (Math.abs(dx) + Math.abs(dz) > 0.02) {
				group.rotation.y = Math.atan2(dx, dz);
			}
			const bag = group.getObjectByName('bag');
			if (bag) bag.visible = shopper.basket.length > 0;
			group.position.y = shopper.phase === 'pick' ? 0.04 : 0;
			if (shopper.disappointed) group.scale.setScalar(0.92);
			else group.scale.setScalar(1);
		}
		for (const [id, group] of shopperMap) {
			if (seen.has(id)) continue;
			shoppersRoot.remove(group);
			shopperMap.delete(id);
		}
	}

	function pick(clientX: number, clientY: number): number | null {
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		const hits = raycaster.intersectObjects(shelfPickables, false);
		const id = hits[0]?.object.userData.shelfId;
		return typeof id === 'number' ? id : null;
	}

	function orbit(dx: number) {
		yaw += dx * 0.006;
		yaw = Math.max(0.12, Math.min(Math.PI * 0.55, yaw));
		placeCamera();
	}

	function render(now: number) {
		pendant.intensity = 1.05 + Math.sin(now * 0.0016) * 0.08;
		if (signMesh) signMesh.position.y = 3.15 + Math.sin(now * 0.0012) * 0.02;
		renderer.render(scene, camera);
	}

	function dispose() {
		observer.disconnect();
		renderer.dispose();
		unitBox.dispose();
		unitSphere.dispose();
		unitCyl.dispose();
		for (const texture of textures) texture.dispose();
		for (const material of materials) material.dispose();
	}

	resize();
	return { sync, render, resize, dispose, pick, orbit };
}
