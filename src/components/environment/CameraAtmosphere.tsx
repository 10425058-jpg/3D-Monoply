import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** The responsive overview can sit 300m away on a short landscape screen.
 * Fixed 48–150m fog made the entire playable board an opaque fog rectangle.
 * Preserve desktop fog and move its range only for those distant views. Camera
 * pose, FOV, view offset, controls and gameplay illumination are untouched. */
export function CameraAtmosphere() {
  const { camera, scene } = useThree();
  useEffect(() => {
    const far = (camera as THREE.PerspectiveCamera).far;
    const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
    const nearFog = fog?.near, farFog = fog?.far;
    return () => {
      (camera as THREE.PerspectiveCamera).far = far;
      camera.updateProjectionMatrix();
      if (fog && nearFog !== undefined && farFog !== undefined) { fog.near = nearFog; fog.far = farFog; }
    };
  }, [camera, scene]);
  useFrame(() => {
    const distance = camera.position.length();
    if (scene.fog instanceof THREE.Fog) {
      const shift = Math.max(0, distance - 60);
      scene.fog.near = 48 + shift;
      scene.fog.far = 150 + shift;
    }
    const perspective = camera as THREE.PerspectiveCamera;
    const far = Math.max(400, distance + 220);
    if (Math.abs(perspective.far - far) > .1) { perspective.far = far; perspective.updateProjectionMatrix(); }
  });
  return null;
}
