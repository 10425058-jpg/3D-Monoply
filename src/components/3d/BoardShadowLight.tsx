import { useCallback, useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function useInvalidateBoardShadow() {
  const gl = useThree(state => state.gl);
  return useCallback(() => { gl.shadowMap.needsUpdate = true; }, [gl]);
}

/** Tokens and dice have static caster meshes below a moving root. */
export function watchShadowPose() {
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  let visible = false;
  return (gl: THREE.WebGLRenderer, actor: THREE.Object3D) => {
    if (actor.visible === visible && (!visible || position.equals(actor.position) &&
      rotation.equals(actor.quaternion) && scale.equals(actor.scale))) return;
    visible = actor.visible;
    position.copy(actor.position);
    rotation.copy(actor.quaternion);
    scale.copy(actor.scale);
    gl.shadowMap.needsUpdate = true;
  };
}

export function BoardShadowLight({ enabled, size }: { enabled: boolean; size: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);

  useLayoutEffect(() => {
    const key = light.current;
    if (!enabled || !key) return;
    const previousBeforeRender = scene.onBeforeRender;
    const previousAutoUpdate = gl.shadowMap.autoUpdate;
    const lightMatrix = new THREE.Matrix4();
    const targetMatrix = new THREE.Matrix4();
    const projection = new THREE.Matrix4();
    let layers = 0;

    const invalidate = () => { gl.shadowMap.needsUpdate = true; };
    gl.shadowMap.autoUpdate = false;
    invalidate();
    gl.domElement.addEventListener('webglcontextrestored', invalidate);
    // Each mutable caster marks the map as needed at its commit or frame update.
    // The light can be checked here after Three updates its world matrix.
    scene.onBeforeRender = function (...args) {
      previousBeforeRender.apply(this, args);
      const [renderer, , camera] = args;
      if (!renderer.shadowMap.enabled) return;
      const shadow = key.shadow;
      if (shadow.map && (shadow.map.width !== shadow.mapSize.x || shadow.map.height !== shadow.mapSize.y)) {
        shadow.map.dispose();
        shadow.map = null;
      }
      const cameraLayers = camera.layers.mask;
      key.target.updateWorldMatrix(true, false);
      if (shadow.map === null || layers !== cameraLayers || !key.matrixWorld.equals(lightMatrix) ||
        !key.target.matrixWorld.equals(targetMatrix) || !projection.equals(shadow.camera.projectionMatrix)) {
        invalidate();
        layers = cameraLayers;
        lightMatrix.copy(key.matrixWorld);
        targetMatrix.copy(key.target.matrixWorld);
        projection.copy(shadow.camera.projectionMatrix);
      }
    };

    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', invalidate);
      scene.onBeforeRender = previousBeforeRender;
      gl.shadowMap.autoUpdate = previousAutoUpdate;
      key.shadow.dispose();
      key.shadow.map = null;
    };
  }, [enabled, gl, scene]);

  return <directionalLight ref={light} position={[-12, 28, 16]} intensity={2.6} color="#fff0d9"
    castShadow={enabled} shadow-mapSize-width={size} shadow-mapSize-height={size}
    shadow-bias={-0.00012} shadow-normalBias={0.018}>
    <orthographicCamera attach="shadow-camera" args={[-18, 18, 18, -18, 8, 62]} />
  </directionalLight>;
}
