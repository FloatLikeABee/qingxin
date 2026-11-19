import { nearStation, stationById } from './floors';
import type { RoleId } from './roles';
import {
	JOB_STATION,
	canSubmit,
	checkpointsFor,
	jobProgressReady,
	markCheckpoint,
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
	const station = stationById(JOB_STATION[roleId]);
	if (!station) return false;
	if (state.player.floor !== station.floor) return false;
	if (roleId === 'courier') {
		if (state.player.carrying) return true;
		const inbound = stationById('inbound');
		const bays = ['bay-a', 'bay-b', 'bay-c'].map((id) => stationById(id));
		const spots = [inbound, ...bays].filter(Boolean);
		return spots.some(
			(spot) => spot && nearStation(state.player.floor, state.player.x, state.player.z, spot, 1.8)
		);
	}
	return nearStation(state.player.floor, state.player.x, state.player.z, station, 1.8);
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
	if (!task || task.stage !== 'perform') return;
	if ((state.player.breakUntil ?? 0) > state.tick) return;
	if (!atWorkstation(state, task.roleId)) return;
	task.ticksSpent += 1;
	task.progress = Math.min(1, task.ticksSpent / Math.max(1, task.durationTicks));
	if (task.kind === 'audit') markCheckpoint(task, 'review');
	if (task.kind === 'decide') markCheckpoint(task, 'read');
	if (jobProgressReady(task) && task.checkpoints.every((item) => item.done)) {
		task.stage = 'submit';
		if (!state.notice.includes('可以交')) {
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
