import { nearStation, stationById } from './floors';
import type { RoleId } from './roles';
import {
	JOB_STATION,
	JOB_STATIONS,
	canSubmit,
	checkpointsFor,
	flushPending,
	jobProgressReady,
	markCheckpoint,
	submitActive,
	type JobStage,
	type Task,
	type WorkState
} from './tasks';

export type JobState = WorkState & {
	paused?: boolean;
	hidden?: boolean;
	dayClosed?: boolean;
};

export function activeJob(state: WorkState): Task | undefined {
	return state.tasks.find(
		(task) => task.status === 'active' && task.roleId === state.player.roleId
	);
}

export function atWorkstation(state: JobState, roleId: RoleId = state.player.roleId): boolean {
	if (roleId === 'courier' && state.player.carrying) return true;
	const ids = JOB_STATIONS[roleId] ?? [JOB_STATION[roleId]];
	return ids.some((id) => {
		const station = stationById(id);
		if (!station) return false;
		return nearStation(state.player.floor, state.player.x, state.player.z, station, 1.8);
	});
}

export function workBlock(
	state: JobState
): 'none' | 'prepare' | 'away' | 'break' | 'paused' | 'hidden' | 'closed' | 'submit' | 'ok' {
	if (state.dayClosed) return 'closed';
	if (state.paused) return 'paused';
	if (state.hidden) return 'hidden';
	if ((state.player.breakUntil ?? 0) > state.tick) return 'break';
	const task = activeJob(state);
	if (!task) return 'none';
	if (task.stage === 'submit') return 'submit';
	if (task.stage === 'prepare') return atWorkstation(state, task.roleId) ? 'ok' : 'prepare';
	if (!atWorkstation(state, task.roleId)) return 'away';
	return 'ok';
}

export function startPerform(state: JobState): boolean {
	const task = activeJob(state);
	if (!task || task.status !== 'active') {
		state.notice = '先接一单。';
		return false;
	}
	if (task.stage === 'perform' || task.stage === 'submit') return true;
	if ((state.player.breakUntil ?? 0) > state.tick) {
		state.notice = '休息完再开始。';
		return false;
	}
	if (!atWorkstation(state, task.roleId)) {
		state.notice = `先到${stationById(task.requiredStation)?.label ?? '工位'}再开始。`;
		return false;
	}
	task.stage = 'perform';
	state.notice = `开始：${task.title}`;
	return true;
}

export function tickJob(state: JobState) {
	if (state.paused || state.hidden || state.dayClosed) return;
	const task = activeJob(state);
	if (!task) return;
	if ((state.player.breakUntil ?? 0) > state.tick) return;
	if (!atWorkstation(state, task.roleId)) return;
	if (task.stage === 'prepare') startPerform(state);
	if (task.stage === 'submit') {
		if (task.pendingAction) {
			flushPending(state);
		} else if (
			(task.payload.kind === 'negotiate' && task.payload.lastOffer) ||
			(task.payload.kind === 'ship' && task.payload.chosen)
		) {
			submitActive(state);
		}
		return;
	}
	if (task.stage !== 'perform') return;
	task.ticksSpent += 1;
	task.progress = Math.min(1, task.ticksSpent / Math.max(1, task.durationTicks));
	if (task.kind === 'audit') markCheckpoint(task, 'review');
	if (task.kind === 'decide') markCheckpoint(task, 'read');
	if (jobProgressReady(task) && task.checkpoints.every((item) => item.done)) {
		task.stage = 'submit';
		if (task.pendingAction) {
			flushPending(state);
		} else if (
			(task.payload.kind === 'negotiate' && task.payload.lastOffer) ||
			(task.payload.kind === 'ship' && task.payload.chosen)
		) {
			submitActive(state);
		} else if (!state.notice.includes('可以交')) {
			state.notice = `${task.title}可以交了。`;
		}
	}
}

export function remainingTicks(task: Task): number {
	return Math.max(0, task.durationTicks - task.ticksSpent);
}

export function dropActiveJob(state: WorkState): boolean {
	const task = activeJob(state);
	if (!task) return false;
	task.status = 'cancelled';
	task.stage = 'submit';
	state.player.carrying = null;
	state.notice = '放下这单，没有薪水。';
	return true;
}

export function resetJobFields(task: Task) {
	task.stage = 'offered' as JobStage;
	task.progress = 0;
	task.ticksSpent = 0;
	task.payAwarded = false;
	task.payGranted = 0;
	task.checkpoints = checkpointsFor(task.kind);
	task.pendingAction = undefined;
}

export function jobCanSubmit(task: Task): boolean {
	return canSubmit(task);
}

export function fillJobProgress(state: JobState) {
	const task = activeJob(state);
	if (!task) return;
	if (task.stage === 'prepare') startPerform(state);
	const left = remainingTicks(task);
	for (let i = 0; i < left + 1; i++) tickJob(state);
}
