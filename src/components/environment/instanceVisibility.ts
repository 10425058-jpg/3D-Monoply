import { Frustum, Matrix4, Sphere, type Camera, type Object3D } from 'three';

/** Reuse the same conservative bounds and compaction order as the original batches. */
export function createInstanceVisibility(bounds: readonly Sphere[]) {
  const projection = new Matrix4();
  const view = new Matrix4();
  const world = new Matrix4();
  const clip = new Matrix4();
  const frustum = new Frustum();
  const sphere = new Sphere();
  const visible: number[] = [];
  let initialized = false;

  return {
    reset() { initialized = false; },
    update(camera: Camera, group: Object3D) {
      group.updateWorldMatrix(true, false);
      const cameraChanged = !initialized || !projection.equals(camera.projectionMatrix) || !view.equals(camera.matrixWorldInverse);
      if (!cameraChanged && world.equals(group.matrixWorld)) return null;
      if (cameraChanged) {
        projection.copy(camera.projectionMatrix);
        view.copy(camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(clip.multiplyMatrices(projection, view));
      }
      world.copy(group.matrixWorld);
      let changed = !initialized;
      let count = 0;
      for (let index = 0; index < bounds.length; index++) {
        if (!frustum.intersectsSphere(sphere.copy(bounds[index]).applyMatrix4(world))) continue;
        if (visible[count] !== index) changed = true;
        visible[count++] = index;
      }
      if (visible.length !== count) changed = true;
      visible.length = count;
      initialized = true;
      return changed ? visible : null;
    },
  };
}
