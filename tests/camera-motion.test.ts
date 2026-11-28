import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { BoardOrbitControls, MAX_ORBIT_POLAR_ANGLE, MIN_ORBIT_DISTANCE } from '../src/components/3d/BoardOrbitControls';

function createOrbit(theta = 0) {
  const camera = new PerspectiveCamera(40);
  const controls = new BoardOrbitControls(camera);
  const target = new Vector3(0, .7, 0);
  controls.setPose(new Vector3().setFromSpherical(new Spherical(42, .7, theta)).add(target), target);
  return { camera, controls, target };
}

test('orbit and dolly follow the same elapsed-time curve at 30, 60, 120 and 240 Hz', () => {
  const checkpoints = [30, 60, 120, 240].map(hz => {
    const { camera, controls } = createOrbit();
    const before = camera.position.clone();
    controls.setAzimuthalAngle(.8);
    controls.setPolarAngle(.9);
    controls.dollyIn(.72);
    assert.deepEqual(camera.position, before, 'Input does not write the rendered pose');
    const samples = [];
    for (let i = 0; i < hz * .4; i++) {
      controls.step(1 / hz, false);
      if ((i + 1) % (hz / 10) === 0) samples.push({ position: camera.position.clone(), orientation: camera.quaternion.clone() });
    }
    return samples;
  });
  for (const samples of checkpoints.slice(1)) {
    samples.forEach((pose, i) => {
      assert.ok(pose.position.distanceTo(checkpoints[0][i].position) < 1e-9);
      assert.ok(pose.orientation.angleTo(checkpoints[0][i].orientation) < 1e-7);
    });
  }
});

test('orbit crosses the yaw seam continuously and zoom approaches the limit monotonically', () => {
  const { camera, controls, target } = createOrbit(Math.PI - .1);
  controls.setAzimuthalAngle(-Math.PI + .1);
  controls.setPolarAngle(MAX_ORBIT_POLAR_ANGLE + .8);
  controls.dollyIn(.01);
  let previous = camera.position.distanceTo(target);
  for (let frame = 0; frame < 90; frame++) {
    controls.step(1 / 60, false);
    const pose = new Spherical().setFromVector3(camera.position.clone().sub(target));
    assert.ok(Math.abs(pose.theta) > Math.PI - .101);
    assert.ok(pose.phi <= MAX_ORBIT_POLAR_ANGLE + 1e-10);
    assert.ok(pose.radius <= previous + 1e-10 && pose.radius >= MIN_ORBIT_DISTANCE - 1e-10);
    previous = pose.radius;
  }
  assert.ok(Math.abs(previous - MIN_ORBIT_DISTANCE) < 1e-10);
  const settled = camera.matrixWorld.clone();
  controls.step(1 / 30, false);
  assert.deepEqual(camera.matrixWorld, settled);
});

test('reduced motion publishes input on the next frame without a damping tail', () => {
  const { camera, controls } = createOrbit();
  controls.setAzimuthalAngle(.8);
  controls.dollyIn(.9);
  controls.step(1 / 120, true);
  assert.ok(camera.position.distanceTo(controls.object.position) < 1e-10);
  const rendered = camera.matrixWorld.clone();
  controls.step(1 / 30, true);
  assert.deepEqual(camera.matrixWorld, rendered);
});

test('manual input interrupts an explicit focus without a pose reset', () => {
  const { camera, controls, target } = createOrbit();
  controls.focusOn(new Vector3(3, 55, 9), new Vector3(2, 1, 3));
  controls.step(1 / 60, false);
  const interrupted = camera.position.clone();
  const pivot = controls.target.clone();
  controls.dispatchEvent({ type: 'start' });
  controls.step(1 / 60, false);
  assert.deepEqual(camera.position, interrupted);
  controls.setAzimuthalAngle(controls.getAzimuthalAngle() + .1);
  controls.step(1 / 60, false);
  assert.notDeepEqual(camera.position, interrupted);
  assert.deepEqual(controls.target, pivot);
  assert.notDeepEqual(pivot, target);
});
