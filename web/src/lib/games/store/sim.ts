import { emptyStock, GOODS, SKUS, type SkuId } from './goods';
import { ENTRANCE, pathfind, QUEUE, SHELF_SPOTS, standForShelf, type Cell } from './layout';

export type ShopperPhase = 'toShelf' | 'pick' | 'toQueue' | 'queue' | 'pay' | 'leave';

export interface Shelf {
	id: number;
	sku: SkuId;
	stock: number;
	capacity: number;
	x: number;
	z: number;
}

export interface Shopper {
	id: number;
	x: number;
	z: number;
	hue: number;
	phase: ShopperPhase;
	list: SkuId[];
	listIndex: number;
	basket: SkuId[];
	disappointed: boolean;
	wait: number;
	path: Cell[];
	action: number;
	settled: boolean;
}

export interface PendingOrder {
	sku: SkuId;
	amount: number;
	arrivesAt: number;
}

export interface SimStats {
	revenue: number;
	soldUnits: number;
	customersHappy: number;
	customersUnhappy: number;
}

export interface SimState {
	tick: number;
	dayTicks: number;
	cash: number;
	paused: boolean;
	over: boolean;
	autoSpawn: boolean;
	spawnEvery: number;
	spawnWait: number;
	maxShoppers: number;
	patience: number;
	pickTicks: number;
	payTicks: number;
	orderDelay: number;
	storage: Record<SkuId, number>;
	shelves: Shelf[];
	shoppers: Shopper[];
	orders: PendingOrder[];
	stats: SimStats;
	nextId: number;
	rng: () => number;
}

export interface SimOptions {
	seed?: number;
	dayTicks?: number;
	cash?: number;
	autoSpawn?: boolean;
	shelfFill?: number;
	storage?: Record<SkuId, number>;
	patience?: number;
	pickTicks?: number;
	payTicks?: number;
	orderDelay?: number;
	spawnEvery?: number;
}

export interface DaySummary {
	revenue: number;
	leftoverUnits: number;
	leftoverStorage: number;
	satisfaction: number;
	cash: number;
	happy: number;
	unhappy: number;
}

function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let n = t;
		n = Math.imul(n ^ (n >>> 15), n | 1);
		n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
}

export function createSim(options: SimOptions = {}): SimState {
	const fill = options.shelfFill ?? 5;
	const storage =
		options.storage ??
		({ water: 10, bread: 8, milk: 8, snacks: 10, bento: 6 } satisfies Record<SkuId, number>);
	const sim: SimState = {
		tick: 0,
		dayTicks: options.dayTicks ?? 720,
		cash: options.cash ?? 100,
		paused: false,
		over: false,
		autoSpawn: options.autoSpawn ?? true,
		spawnEvery: options.spawnEvery ?? 28,
		spawnWait: options.spawnEvery ?? 28,
		maxShoppers: 6,
		patience: options.patience ?? 36,
		pickTicks: options.pickTicks ?? 5,
		payTicks: options.payTicks ?? 10,
		orderDelay: options.orderDelay ?? 18,
		storage: { ...storage },
		shelves: SHELF_SPOTS.map((spot) => ({
			id: spot.id,
			sku: spot.sku,
			stock: Math.min(8, Math.max(0, fill)),
			capacity: 8,
			x: spot.x,
			z: spot.z
		})),
		shoppers: [],
		orders: [],
		stats: { revenue: 0, soldUnits: 0, customersHappy: 0, customersUnhappy: 0 },
		nextId: 1,
		rng: mulberry32(options.seed ?? 20261112)
	};
	if (sim.autoSpawn) spawnShopper(sim);
	return sim;
}

export function restockShelf(sim: SimState, shelfId: number): boolean {
	if (sim.over) return false;
	const shelf = sim.shelves.find((item) => item.id === shelfId);
	if (!shelf) return false;
	const space = shelf.capacity - shelf.stock;
	const available = sim.storage[shelf.sku];
	const moved = Math.min(space, available);
	if (moved <= 0) return false;
	shelf.stock += moved;
	sim.storage[shelf.sku] -= moved;
	return true;
}

export function orderCrate(sim: SimState, sku: SkuId): boolean {
	if (sim.over) return false;
	const goods = GOODS[sku];
	if (sim.cash < goods.crateCost) return false;
	sim.cash -= goods.crateCost;
	sim.orders.push({ sku, amount: goods.crateSize, arrivesAt: sim.tick + sim.orderDelay });
	return true;
}

function shelfForSku(sim: SimState, sku: SkuId): Shelf | undefined {
	return sim.shelves.find((shelf) => shelf.sku === sku);
}

function setPath(shopper: Shopper, to: Cell) {
	shopper.path = pathfind({ x: shopper.x, z: shopper.z }, to);
}

export function spawnShopper(sim: SimState, list?: SkuId[]): Shopper {
	const chosen = list?.length ? [...list] : randomList(sim);
	const shopper: Shopper = {
		id: sim.nextId++,
		x: ENTRANCE.x,
		z: ENTRANCE.z,
		hue: sim.rng(),
		phase: 'toShelf',
		list: chosen,
		listIndex: 0,
		basket: [],
		disappointed: false,
		wait: 0,
		path: [],
		action: 0,
		settled: false
	};
	aimAtCurrentSku(sim, shopper);
	sim.shoppers.push(shopper);
	return shopper;
}

function randomList(sim: SimState): SkuId[] {
	const count = 1 + Math.floor(sim.rng() * 3);
	const bag = [...SKUS];
	const list: SkuId[] = [];
	for (let i = 0; i < count && bag.length; i++) {
		const index = Math.floor(sim.rng() * bag.length);
		list.push(bag.splice(index, 1)[0] ?? 'water');
	}
	return list;
}

function aimAtCurrentSku(sim: SimState, shopper: Shopper) {
	const sku = shopper.list[shopper.listIndex];
	if (!sku) {
		finishShopping(sim, shopper);
		return;
	}
	const shelf = shelfForSku(sim, sku);
	if (!shelf) {
		finishShopping(sim, shopper);
		return;
	}
	shopper.phase = 'toShelf';
	setPath(shopper, standForShelf(shelf));
}

function settle(sim: SimState, shopper: Shopper, happy: boolean) {
	if (shopper.settled) return;
	shopper.settled = true;
	if (happy) sim.stats.customersHappy += 1;
	else sim.stats.customersUnhappy += 1;
}

function finishShopping(sim: SimState, shopper: Shopper) {
	if (shopper.basket.length === 0) {
		settle(sim, shopper, false);
		beginLeave(shopper, true);
		return;
	}
	shopper.phase = 'toQueue';
	shopper.action = 0;
	setPath(shopper, QUEUE);
}

function beginLeave(shopper: Shopper, unhappy: boolean) {
	shopper.phase = 'leave';
	shopper.disappointed = shopper.disappointed || unhappy;
	setPath(shopper, ENTRANCE);
}

function returnBasket(sim: SimState, shopper: Shopper) {
	for (const sku of shopper.basket) {
		const shelf = shelfForSku(sim, sku);
		if (shelf && shelf.stock < shelf.capacity) shelf.stock += 1;
		else sim.storage[sku] += 1;
	}
	shopper.basket = [];
}

function stepShopper(sim: SimState, shopper: Shopper) {
	if (shopper.path.length > 0) {
		const next = shopper.path.shift();
		if (next) {
			shopper.x = next.x;
			shopper.z = next.z;
		}
		return;
	}

	if (shopper.phase === 'toShelf') {
		shopper.phase = 'pick';
		shopper.action = sim.pickTicks;
		return;
	}

	if (shopper.phase === 'pick') {
		shopper.action -= 1;
		if (shopper.action > 0) return;
		const sku = shopper.list[shopper.listIndex];
		const shelf = sku ? shelfForSku(sim, sku) : undefined;
		if (shelf && shelf.stock > 0 && sku) {
			shelf.stock -= 1;
			shopper.basket.push(sku);
		} else {
			shopper.disappointed = true;
		}
		shopper.listIndex += 1;
		if (shopper.listIndex < shopper.list.length) aimAtCurrentSku(sim, shopper);
		else finishShopping(sim, shopper);
		return;
	}

	if (shopper.phase === 'toQueue') {
		shopper.phase = 'queue';
		shopper.wait = 0;
		shopper.action = 0;
		return;
	}

	if (shopper.phase === 'queue' || shopper.phase === 'pay') {
		const queued = sim.shoppers.filter((item) => item.phase === 'queue' || item.phase === 'pay');
		const place = queued.findIndex((item) => item.id === shopper.id);
		if (place > 0) {
			shopper.phase = 'queue';
			shopper.wait += 1;
			if (shopper.wait > sim.patience) {
				returnBasket(sim, shopper);
				settle(sim, shopper, false);
				beginLeave(shopper, true);
			}
			return;
		}
		shopper.phase = 'pay';
		shopper.action += 1;
		if (shopper.action >= sim.payTicks) {
			const bill = shopper.basket.reduce((sum, sku) => sum + GOODS[sku].price, 0);
			sim.cash += bill;
			sim.stats.revenue += bill;
			sim.stats.soldUnits += shopper.basket.length;
			settle(sim, shopper, !shopper.disappointed);
			shopper.basket = [];
			beginLeave(shopper, shopper.disappointed);
		}
		return;
	}

	if (shopper.phase === 'leave') {
		sim.shoppers = sim.shoppers.filter((item) => item.id !== shopper.id);
	}
}

function deliverOrders(sim: SimState) {
	const ready = sim.orders.filter((order) => order.arrivesAt <= sim.tick);
	sim.orders = sim.orders.filter((order) => order.arrivesAt > sim.tick);
	for (const order of ready) sim.storage[order.sku] += order.amount;
}

export function tick(sim: SimState): SimState {
	if (sim.paused || sim.over) return sim;
	sim.tick += 1;
	deliverOrders(sim);
	if (sim.tick >= sim.dayTicks) {
		sim.over = true;
		return sim;
	}
	if (sim.autoSpawn) {
		sim.spawnWait -= 1;
		if (sim.spawnWait <= 0 && sim.shoppers.length < sim.maxShoppers) {
			spawnShopper(sim);
			sim.spawnWait = sim.spawnEvery;
		}
	}
	for (const shopper of [...sim.shoppers]) stepShopper(sim, shopper);
	return sim;
}

export function leftoverStock(sim: SimState): { shelves: number; storage: number } {
	const shelves = sim.shelves.reduce((sum, shelf) => sum + shelf.stock, 0);
	const storage = SKUS.reduce((sum, sku) => sum + sim.storage[sku], 0);
	return { shelves, storage };
}

export function summarize(sim: SimState): DaySummary {
	const left = leftoverStock(sim);
	const guests = sim.stats.customersHappy + sim.stats.customersUnhappy;
	return {
		revenue: sim.stats.revenue,
		leftoverUnits: left.shelves + left.storage,
		leftoverStorage: left.storage,
		satisfaction: guests === 0 ? 1 : sim.stats.customersHappy / guests,
		cash: sim.cash,
		happy: sim.stats.customersHappy,
		unhappy: sim.stats.customersUnhappy
	};
}

export function restartSim(sim: SimState, options?: SimOptions): SimState {
	Object.assign(sim, createSim(options));
	return sim;
}
