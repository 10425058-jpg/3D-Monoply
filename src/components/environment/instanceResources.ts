import { InstancedMesh } from 'three';

/** R3F's dispose={null} masks the instance method to protect cached GLB resources.
 * Release only instance-owned buffers through the original Three implementation. */
export function releaseInstanceBuffers(instance: InstancedMesh) {
  InstancedMesh.prototype.dispose.call(instance);
}
