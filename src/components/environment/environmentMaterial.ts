import * as THREE from 'three';

// Illustrated sunset modelling belongs only to the outer GLB materials. The
// board keeps its existing lights, shadows, exposure and material response.
const SUN_NORMAL = new THREE.Vector3(.55,.72,-.65).normalize();
const SUN_TINT = new THREE.Color('#ffd497');
const HAZE = new THREE.Color('#c3aed1');

export function finishEnvironmentMaterial(source: THREE.Material, atmosphere: number) {
  const material = source.clone();
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  material.fog = false;
  material.onBeforeCompile = shader => {
    shader.uniforms.environmentSun = { value: SUN_NORMAL };
    shader.uniforms.environmentSunTint = { value: SUN_TINT };
    shader.uniforms.environmentHaze = { value: HAZE };
    shader.uniforms.environmentHazeAmount = { value: atmosphere };
    shader.fragmentShader = `uniform vec3 environmentSun;
      uniform vec3 environmentSunTint; uniform vec3 environmentHaze;
      uniform float environmentHazeAmount;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      vec3 kingdomNormal = inverseTransformDirection(normal, viewMatrix);
      float kingdomSun = max(0.,dot(kingdomNormal,environmentSun));
      reflectedLight.directDiffuse += diffuseColor.rgb * environmentSunTint * kingdomSun * .38;
      reflectedLight.indirectDiffuse *= mix(vec3(.84,.82,1.10),vec3(1.),kingdomSun);
    `).replace('#include <opaque_fragment>', `
      outgoingLight = mix(outgoingLight,environmentHaze,environmentHazeAmount);
      #include <opaque_fragment>
    `);
  };
  // All placements share this shader program; per-material haze is a uniform.
  material.customProgramCacheKey = () => 'kingdom-sunset-finish-v1';
  return material;
}
