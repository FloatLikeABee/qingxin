import {
	CASE_IDS,
	createClinic,
	DISCLAIMER_COPY,
	isCaseId,
	isHerbId,
	PACK_MAX,
	PACK_MIN,
	SEEN_CAP,
	SLIP_MAX,
	type CaseId,
	type ClinicWorld,
	type HerbId,
	type PickedJar
} from './sim';

export const CLINIC_SAVE_KEY = 'qingxin.games.story-clinic';
export const CLINIC_SCHEMA = 1;

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
	const value = Number(n);
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

function parseHerbs(raw: unknown): PickedJar[] {
	if (!Array.isArray(raw)) return [];
	const jars: PickedJar[] = [];
	const used = new Set<HerbId>();
	for (const item of raw) {
		if (jars.length >= 5) break;
		const rec = asRecord(item);
		const id = rec ? String(rec.id) : String(item);
		if (!isHerbId(id) || used.has(id)) continue;
		used.add(id);
		jars.push({
			id,
			packs: Math.round(clamp(rec?.packs, PACK_MIN, PACK_MAX, 1))
		});
	}
	return jars;
}

function parseSeen(raw: unknown): CaseId[] {
	if (!Array.isArray(raw)) return [];
	const ids: CaseId[] = [];
	for (const item of raw) {
		const id = String(item);
		if (isCaseId(id) && !ids.includes(id)) ids.push(id);
		if (ids.length >= SEEN_CAP) break;
	}
	return ids;
}

function keepSettings(world: ClinicWorld, rec: Record<string, unknown>) {
	world.lowDetail = rec.lowDetail === true;
	world.audioWanted = rec.audioWanted === true;
	world.dockCollapsed = rec.dockCollapsed === true;
}

export function serializeClinic(world: ClinicWorld) {
	return {
		schema: CLINIC_SCHEMA,
		disclaimerAck: world.disclaimerAck === true,
		seenCaseIds: world.seenCaseIds.slice(-SEEN_CAP),
		lastSlip: world.lastSlip
			? {
					text: Array.from(world.lastSlip.text).slice(0, SLIP_MAX).join(''),
					herbs: world.lastSlip.herbs.map((jar) => ({
						id: jar.id,
						packs: jar.packs
					}))
				}
			: null,
		caseId: world.caseId,
		lowDetail: world.lowDetail,
		audioWanted: world.audioWanted,
		dockCollapsed: world.dockCollapsed
	};
}

export function writeClinicSave(
	world: ClinicWorld,
	storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage
) {
	try {
		storage?.setItem(CLINIC_SAVE_KEY, JSON.stringify(serializeClinic(world)));
	} catch {
		// private mode / quota
	}
}

function recoveredClinic(notice: string, rec?: Record<string, unknown> | null) {
	const fresh = createClinic();
	fresh.recovered = true;
	fresh.notice = notice;
	if (rec) keepSettings(fresh, rec);
	if (rec?.disclaimerAck === true) {
		fresh.disclaimerAck = true;
		fresh.phase = 'hall';
	}
	return fresh;
}

export function readClinicSave(
	storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage
): ClinicWorld {
	try {
		const raw = storage?.getItem(CLINIC_SAVE_KEY);
		if (!raw) return createClinic();
		const rec = asRecord(JSON.parse(raw) as unknown);
		if (!rec || rec.schema !== CLINIC_SCHEMA) {
			return recoveredClinic('厅里重新收拾好了。', rec);
		}
		const world = createClinic();
		keepSettings(world, rec);
		world.disclaimerAck = rec.disclaimerAck === true;
		world.seenCaseIds = parseSeen(rec.seenCaseIds);
		const last = asRecord(rec.lastSlip);
		world.lastSlip = last
			? {
					text: Array.from(String(last.text ?? '')).slice(0, SLIP_MAX).join(''),
					herbs: parseHerbs(last.herbs)
				}
			: null;
		const caseId = String(rec.caseId ?? '');
		world.caseId = isCaseId(caseId) ? caseId : (CASE_IDS[0] ?? 'fox-draft');
		if (world.disclaimerAck) {
			world.phase = 'hall';
			world.notice = '候诊厅还在。纸条上一次写过的气味还留着。';
		} else {
			world.phase = 'disclaimer';
			world.notice = DISCLAIMER_COPY;
		}
		world.recovered = false;
		return world;
	} catch {
		return recoveredClinic('厅里重新收拾好了。');
	}
}
