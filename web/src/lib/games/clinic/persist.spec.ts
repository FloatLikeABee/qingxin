import { describe, expect, it } from 'vitest';
import { CLINIC_SAVE_KEY, CLINIC_SCHEMA, readClinicSave, serializeClinic, writeClinicSave } from './persist';
import {
	ackDisclaimer,
	advanceTalk,
	createClinic,
	dispense,
	setSlip,
	toggleJar
} from './sim';

function memory(initial?: Record<string, string>) {
	const data = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		}
	};
}

const SIBLINGS: Record<string, string> = {
	'qingxin.theme': 'dark',
	'qingxin.games.home-kitchen': '{"schema":1}',
	'qingxin.games.cargo-haul': '{"schema":2}',
	'qingxin.games.cloud-walk': '{"schema":3}',
	'qingxin.games.operation': '{"schema":2}',
	'qingxin.games.memory-shelf': '{"schema":3}',
	'qingxin.games.annual-report': '{"schema":1}',
	'qingxin.games.tide-breath': '{"schema":1}',
	'qingxin.games.convenient-store': '{"schema":1}'
};

describe('story-clinic save', () => {
	it('round-trips disclaimer, seen cases, last 药包 slip without wiping sibling keys', () => {
		const storage = memory(SIBLINGS);
		const world = createClinic();
		ackDisclaimer(world);
		for (let i = 0; i < 4; i++) advanceTalk(world);
		setSlip(world, '给狐狸一包暖手的气味。');
		toggleJar(world, 'danggui');
		toggleJar(world, 'juhua');
		dispense(world);
		world.lowDetail = true;
		world.audioWanted = true;
		world.dockCollapsed = true;
		writeClinicSave(world, storage);
		const raw = storage.getItem(CLINIC_SAVE_KEY) ?? '';
		expect(raw).not.toMatch(/\bmg\b|克|钱|撮|把|g\b/);
		expect(raw).toMatch(/药包|packs|danggui/);
		const loaded = readClinicSave(storage);
		expect(loaded.recovered).toBe(false);
		expect(loaded.disclaimerAck).toBe(true);
		expect(loaded.phase).toBe('hall');
		expect(loaded.lastSlip?.text).toMatch(/狐狸/);
		expect(loaded.lastSlip?.herbs).toEqual([
			{ id: 'danggui', packs: 1 },
			{ id: 'juhua', packs: 1 }
		]);
		expect(loaded.lowDetail).toBe(true);
		expect(loaded.audioWanted).toBe(true);
		expect(loaded.dockCollapsed).toBe(true);
		expect(CLINIC_SCHEMA).toBe(1);
		expect(CLINIC_SAVE_KEY).toBe('qingxin.games.story-clinic');
		expect(serializeClinic(world).lastSlip?.herbs.every((jar) => jar.packs >= 1 && jar.packs <= 3)).toBe(
			true
		);
		for (const [key, value] of Object.entries(SIBLINGS)) {
			expect(storage.getItem(key)).toBe(value);
		}
	});

	it('recovers foreign schema and corrupt JSON; missing ack returns to the disclaimer', () => {
		const foreign = memory({
			...SIBLINGS,
			[CLINIC_SAVE_KEY]: JSON.stringify({ schema: 9, disclaimerAck: true })
		});
		const recovered = readClinicSave(foreign);
		expect(recovered.recovered).toBe(true);
		expect(recovered.notice).toMatch(/厅里重新收拾好了/);
		expect(recovered.disclaimerAck).toBe(true);
		expect(recovered.phase).toBe('hall');
		expect(foreign.getItem('qingxin.theme')).toBe('dark');
		expect(foreign.getItem('qingxin.games.home-kitchen')).toBe('{"schema":1}');
		expect(foreign.getItem('qingxin.games.operation')).toBe('{"schema":2}');

		const noAck = memory({
			[CLINIC_SAVE_KEY]: JSON.stringify({ schema: 1, disclaimerAck: false })
		});
		const gated = readClinicSave(noAck);
		expect(gated.disclaimerAck).toBe(false);
		expect(gated.phase).toBe('disclaimer');

		const bad = memory({
			'qingxin.theme': 'light',
			[CLINIC_SAVE_KEY]: '{nope'
		});
		const broken = readClinicSave(bad);
		expect(broken.recovered).toBe(true);
		expect(broken.disclaimerAck).toBe(false);
		expect(bad.getItem('qingxin.theme')).toBe('light');
	});
});
