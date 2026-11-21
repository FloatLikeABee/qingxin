import { describe, expect, it } from 'vitest';
import { loadOpSave, OP_KEY, parseOpSave, snapshotOp, writeOpSave } from './persist';
import { ackGraphic, createOp, pickRegion } from './sim';

function mem(init: Record<string, string> = {}) {
	const map = { ...init };
	return {
		getItem: (k: string) => (k in map ? map[k] : null),
		setItem: (k: string, v: string) => {
			map[k] = v;
		},
		raw: map
	};
}

describe('operation persist', () => {
	it('writes only qingxin.games.operation and leaves sibling keys', () => {
		const s = mem({ 'qingxin.games.shelf': '{"ok":1}', 'qingxin.theme': 'dark' });
		const world = createOp(8);
		ackGraphic(world);
		world.stars.forearm = 2;
		writeOpSave(s, world);
		expect(JSON.parse(s.raw[OP_KEY]).graphicAck).toBe(true);
		expect(s.raw['qingxin.games.shelf']).toBe('{"ok":1}');
		expect(s.raw['qingxin.theme']).toBe('dark');
	});

	it('reload without ack stays on the warning', () => {
		const s = mem();
		writeOpSave(s, createOp(2));
		const { world } = loadOpSave(s);
		expect(world.graphicAck).toBe(false);
		expect(world.view).toBe('warning');
		expect(world.region).toBeNull();
	});

	it('reload with ack returns to hub, never a completed field', () => {
		const world = createOp(3);
		ackGraphic(world);
		pickRegion(world, 'forearm');
		world.complete = true;
		world.phase = 'done';
		const s = mem();
		writeOpSave(s, world);
		const loaded = loadOpSave(s).world;
		expect(loaded.graphicAck).toBe(true);
		expect(loaded.view).toBe('hub');
		expect(loaded.region).toBeNull();
		expect(loaded.complete).toBe(false);
	});

	it('corrupt payload recovers behind the warning', () => {
		expect(parseOpSave(null).recovered).toBe(true);
		expect(parseOpSave({ schema: 9 }).recovered).toBe(true);
		const s = mem({ [OP_KEY]: '{not json' });
		const loaded = loadOpSave(s);
		expect(loaded.recovered).toBe(true);
		expect(loaded.world.view).toBe('warning');
	});

	it('snapshot does not include mid-procedure completion', () => {
		const world = createOp(1);
		ackGraphic(world);
		pickRegion(world, 'knee');
		world.complete = true;
		const snap = snapshotOp(world);
		expect(snap).not.toHaveProperty('complete');
		expect(snap).not.toHaveProperty('phase');
		expect(snap.graphicAck).toBe(true);
	});
});
