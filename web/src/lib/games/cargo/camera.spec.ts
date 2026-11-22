import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyHaulChaseCamera, cameraBasisDet } from './camera';
import { createHaul, haulRight, setHaulControl, stepHaul } from './sim';

function freezeProject(world: { x: number; z: number; yaw: number; speed: number }, x: number, y: number, z: number) {
	const cam = new THREE.PerspectiveCamera(50, 390 / 700, 0.1, 400);
	applyHaulChaseCamera(cam, world);
	return new THREE.Vector3(x, y, z).project(cam);
}

describe('cargo chase camera', () => {
	it('puts driver-right lamp on screen-right with a right-handed basis', () => {
		const world = createHaul(3);
		const cam = new THREE.PerspectiveCamera(50, 390 / 700, 0.1, 400);
		applyHaulChaseCamera(cam, world);
		expect(cam.scale.x).toBe(1);
		expect(cameraBasisDet(cam)).toBeGreaterThan(0.5);
		const right = haulRight(world.yaw);
		const hr = freezeProject(world, world.x + right.x * 0.82, 1.2, world.z + right.z * 0.82);
		const hl = freezeProject(world, world.x - right.x * 0.82, 1.2, world.z - right.z * 0.82);
		expect(hr.x).toBeGreaterThan(hl.x);
	});

	it('drive steer +1 increases frozen-cam NDC x', () => {
		const world = createHaul(3);
		world.speed = 12;
		world.gear = 'drive';
		const cam = new THREE.PerspectiveCamera(50, 390 / 700, 0.1, 400);
		applyHaulChaseCamera(cam, {
			x: world.x,
			z: world.z,
			yaw: world.yaw,
			speed: world.speed
		});
		const start = new THREE.Vector3(world.x, 1.2, world.z).project(cam);
		setHaulControl(world, 'steer', 1);
		setHaulControl(world, 'throttle', 1);
		stepHaul(world, 700);
		const end = new THREE.Vector3(world.x, 1.2, world.z).project(cam);
		expect(end.x).toBeGreaterThan(start.x);
	});

	it('reverse steer +1 increases frozen-cam NDC x', () => {
		const world = createHaul(3);
		world.speed = -7;
		world.gear = 'reverse';
		const cam = new THREE.PerspectiveCamera(50, 390 / 700, 0.1, 400);
		applyHaulChaseCamera(cam, {
			x: world.x,
			z: world.z,
			yaw: world.yaw,
			speed: world.speed
		});
		const start = new THREE.Vector3(world.x, 1.2, world.z).project(cam);
		setHaulControl(world, 'steer', 1);
		setHaulControl(world, 'throttle', 1);
		stepHaul(world, 700);
		const end = new THREE.Vector3(world.x, 1.2, world.z).project(cam);
		expect(end.x).toBeGreaterThan(start.x);
	});
});
