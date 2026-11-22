import * as THREE from 'three';
import { haulAhead } from './sim';

type PerspectiveCamera = InstanceType<typeof THREE.PerspectiveCamera>;

export type HaulChasePose = {
	x: number;
	z: number;
	yaw: number;
	speed: number;
};

export function cameraBasisDet(camera: PerspectiveCamera) {
	camera.updateMatrixWorld();
	const e = camera.matrixWorld.elements;
	const x = { x: e[0], y: e[1], z: e[2] };
	const y = { x: e[4], y: e[5], z: e[6] };
	const z = { x: e[8], y: e[9], z: e[10] };
	return (
		x.x * (y.y * z.z - y.z * z.y) -
		x.y * (y.x * z.z - y.z * z.x) +
		x.z * (y.x * z.y - y.y * z.x)
	);
}

export function haulChaseWant(world: HaulChasePose) {
	const ahead = haulAhead(world.yaw);
	const back = 16.8 + Math.min(5, Math.abs(world.speed) * 0.14);
	const height = 7.2 + Math.min(2.2, Math.abs(world.speed) * 0.06);
	return {
		x: world.x - ahead.x * back,
		y: height,
		z: world.z - ahead.z * back,
		lookX: world.x + ahead.x * 12,
		lookY: 2.1,
		lookZ: world.z + ahead.z * 12
	};
}

export function applyHaulChaseCamera(camera: PerspectiveCamera, world: HaulChasePose) {
	const want = haulChaseWant(world);
	camera.up.set(0, 1, 0);
	camera.scale.set(1, 1, 1);
	camera.position.set(want.x, want.y, want.z);
	camera.lookAt(want.lookX, want.lookY, want.lookZ);
	camera.updateMatrixWorld();
	camera.updateProjectionMatrix();
}
