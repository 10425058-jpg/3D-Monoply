import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';

// Ground-local ambient contact: one instanced draw, no depth/scene pass.
// Castle upgrades retain the footprint; animated canopies remain untouched.
const CONTACTS = [
  [-4.8, .465, -2.6, 2, 2], [4.8, .465, -2.6, 2, 2],
  [-2.8, .465, -1.8, 1.7, 1.7], [2.8, .465, -1.8, 1.7, 1.7],
  [-3.2, .375, 2, 1.7, 1.7], [3.2, .375, 2, 1.7, 1.7],
  [-5.4, .345, 5.8, 1.9, 1.9], [5.4, .345, 5.8, 1.9, 1.9],
  [-2.4, .465, -.6, 1.3, 1.3], [2.4, .465, -.6, 1.3, 1.3],
  [-1.8, .345, 2.6, 1.2, 1.2], [1.8, .345, 2.6, 1.2, 1.2],
  [-1.8, .345, 5.8, 1.2, 1.2], [1.8, .345, 5.8, 1.2, 1.2],
  [0, .465, -1.8, 10.3, 6.4],
];

export function ContactOcclusion() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    CONTACTS.forEach(([x, y, z, width, depth], i) => {
      dummy.position.set(x, y, z); dummy.rotation.x = -Math.PI / 2;
      dummy.scale.set(width, depth, 1); dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh ref={mesh} args={[undefined, undefined, CONTACTS.length]} raycast={() => {}}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1}
      vertexShader={`varying vec2 contactUv;
        void main() { contactUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`}
      fragmentShader={`varying vec2 contactUv;
        void main() {
          float radius = length((contactUv - .5) * 2.);
          float contact = 1. - smoothstep(.0, 1., radius);
          gl_FragColor = vec4(.10, .13, .16, contact * contact * .24);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </instancedMesh>;
}
