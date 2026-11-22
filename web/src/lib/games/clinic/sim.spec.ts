import { describe, expect, it } from 'vitest';
import {
	ACK_LABEL,
	advanceTalk,
	beginWrite,
	CASES,
	clinicCopyForbidden,
	coverTags,
	createClinic,
	dispense,
	examine,
	FORBIDDEN_COPY,
	HERBS,
	HUD_DISCLAIMER,
	isCompactClinic,
	jarWorld,
	outcomeFor,
	patientWorld,
	setPacks,
	setSlip,
	SLIP_MAX,
	startTalk,
	stepClinic,
	toggleJar,
	ackDisclaimer,
	nextPatient
} from './sim';

describe('clinic sim', () => {
	it('lets two different 2–5 herb sets both cover ≥2 fox tags, and a 0-overlap set is mismatch', () => {
		const fox = CASES[0]!;
		expect(fox.id).toBe('fox-draft');
		const a = coverTags(fox.tags, [
			{ id: 'danggui', packs: 1 },
			{ id: 'juhua', packs: 2 }
		]);
		const b = coverTags(fox.tags, [
			{ id: 'shengjiang', packs: 1 },
			{ id: 'gouqi', packs: 1 }
		]);
		expect(a.length).toBeGreaterThanOrEqual(2);
		expect(b.length).toBeGreaterThanOrEqual(2);
		expect([...a].sort().join()).not.toBe([...b].sort().join());
		expect(outcomeFor(a)).toBe('warm');
		expect(outcomeFor(b)).toBe('warm');
		const none = coverTags(fox.tags, [
			{ id: 'fuling', packs: 1 },
			{ id: 'baizhu', packs: 1 }
		]);
		expect(none).toHaveLength(0);
		expect(outcomeFor(none)).toBe('mismatch');
		expect(outcomeFor(['怕风'])).toBe('partial');
	});

	it('refuses fewer than two jars, a sixth jar, overlong slip, and non 1–3 药包', () => {
		const world = createClinic();
		ackDisclaimer(world);
		for (let i = 0; i < 4; i++) advanceTalk(world);
		beginWrite(world);
		expect(dispense(world)).toBe(false);
		expect(world.notice).toMatch(/还没选药/);
		expect(toggleJar(world, 'danggui')).toBe(true);
		expect(dispense(world)).toBe(false);
		expect(toggleJar(world, 'juhua')).toBe(true);
		expect(toggleJar(world, 'gouqi')).toBe(true);
		expect(toggleJar(world, 'gancao')).toBe(true);
		expect(toggleJar(world, 'chenpi')).toBe(true);
		expect(world.jars).toHaveLength(5);
		expect(toggleJar(world, 'fuling')).toBe(false);
		expect(world.notice).toMatch(/一次最多五味/);
		expect(world.jars).toHaveLength(5);
		setSlip(world, '字'.repeat(SLIP_MAX + 12));
		expect(Array.from(world.slip)).toHaveLength(SLIP_MAX);
		expect(setPacks(world, 'danggui', 0)).toBe(true);
		expect(world.jars[0]?.packs).toBe(1);
		expect(setPacks(world, 'danggui', 9)).toBe(true);
		expect(world.jars[0]?.packs).toBe(3);
		expect(setPacks(world, 'danggui', 2)).toBe(true);
		expect(world.jars[0]?.packs).toBe(2);
	});

	it('talk reveals three story tags; examine only flavors tags already in the case', () => {
		const world = createClinic();
		ackDisclaimer(world);
		startTalk(world);
		expect(world.phase).toBe('talk');
		advanceTalk(world);
		advanceTalk(world);
		advanceTalk(world);
		expect(world.phase).toBe('examine');
		expect(world.revealedTags).toEqual(['怕风', '夜咳', '口干']);
		examine(world, 'look');
		expect(world.examined).toEqual(['look']);
		expect(world.examineNote).toMatch(/怕风/);
		expect(world.examineNote).not.toMatch(FORBIDDEN_COPY);
		examine(world, 'look');
		expect(world.notice).toMatch(/已经望过了/);
	});

	it('dispense writes a warm recovery that echoes matched tags and never claims a cure', () => {
		const world = createClinic();
		ackDisclaimer(world);
		for (let i = 0; i < 4; i++) advanceTalk(world);
		beginWrite(world);
		setSlip(world, '给狐狸一包暖手的气味。');
		toggleJar(world, 'danggui');
		toggleJar(world, 'juhua');
		expect(dispense(world)).toBe(true);
		expect(world.phase).toBe('dispense');
		expect(world.covered.length).toBeGreaterThanOrEqual(2);
		stepClinic(world, 2000);
		expect(world.phase).toBe('recovery');
		expect(world.recovery).toMatch(/怕风|夜咳/);
		expect(world.recovery).not.toMatch(FORBIDDEN_COPY);
		expect(world.notice).not.toMatch(FORBIDDEN_COPY);
		expect(world.lastSlip?.herbs).toHaveLength(2);
		expect(world.seenCaseIds).toContain('fox-draft');
	});

	it('mismatch recovery says the patient is fine; next patient rotates cases', () => {
		const world = createClinic();
		ackDisclaimer(world);
		for (let i = 0; i < 4; i++) advanceTalk(world);
		toggleJar(world, 'fuling');
		toggleJar(world, 'baizhu');
		dispense(world);
		stepClinic(world, 2000);
		expect(world.recovery).toMatch(/没事|好好地/);
		expect(world.recovery).not.toMatch(/错药|惩罚/);
		nextPatient(world);
		expect(world.phase).toBe('hall');
		expect(world.caseId).not.toBe('fox-draft');
		expect(world.jars).toHaveLength(0);
	});

	it('ships no forbidden clinical copy and compact layout keeps jars and patient on the counter', () => {
		expect(clinicCopyForbidden()).toBe(false);
		expect(HUD_DISCLAIMER).toMatch(/虚构娱乐/);
		expect(ACK_LABEL).toBe('我明白，开始虚构接诊');
		expect(ACK_LABEL).not.toMatch(/进入手术/);
		expect(HERBS).toHaveLength(12);
		expect(isCompactClinic(390)).toBe(true);
		expect(isCompactClinic(1280)).toBe(false);
		for (let i = 0; i < 12; i++) {
			const pos = jarWorld(i, true);
			expect(Math.abs(pos.x)).toBeLessThan(1.15);
			expect(pos.z).toBeLessThan(0);
			expect(pos.z).toBeGreaterThan(-1.5);
		}
		const who = patientWorld(true);
		expect(who.z).toBeGreaterThan(0.4);
		expect(Math.abs(who.x)).toBeLessThan(0.4);
	});
});
