import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_SUN_DIRECTION, SUN_ANGULAR_RADIUS } from './sunConfig';
import type { EnvironmentQuality } from './environmentLayout';
import { SKY_BAKE_FRAGMENT } from './skyCloudBake';

// Baked once on mount/quality change. No procedural noise or trig cloud mapping
// runs in the full-screen gameplay pass. Direction projection is continuous at
// the equirectangular seam and downward pole, including the steep overview.
/** A static low-resolution atmosphere bake plus analytic sun in one sky draw.
 * Slow instanced clouds/airship supply life without a repeating full-screen bake. */
export function FantasySky({ quality = 'balanced' }: { animate: boolean; quality?: EnvironmentQuality }) {
  const gl=useThree(state=>state.gl),ref=useRef<THREE.Mesh>(null);
  const target=useMemo(()=>{
    const width=quality==='low'?512:quality==='high'?1536:1024;
    const result=new THREE.WebGLRenderTarget(width,width/2,{depthBuffer:false,stencilBuffer:false,
      format:THREE.RGBAFormat,type:THREE.UnsignedByteType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    result.texture.colorSpace=THREE.LinearSRGBColorSpace;
    result.texture.generateMipmaps=false; result.texture.wrapS=THREE.RepeatWrapping;
    result.texture.name=`Sunset atmosphere ${width}x${width/2}`;
    return result;
  },[quality]);
  const uniforms=useMemo(()=>({
    uSky:{value:target.texture},uSun:{value:new THREE.Vector3(...SKY_SUN_DIRECTION)},
    uSunCos:{value:Math.cos(SUN_ANGULAR_RADIUS)},uSunRadiusSq:{value:SUN_ANGULAR_RADIUS*SUN_ANGULAR_RADIUS},
  }),[target]);
  useLayoutEffect(()=>{
    const bake=()=>{
      const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      const geometry=new THREE.PlaneGeometry(2,2);
      const material=new THREE.ShaderMaterial({uniforms:{uSun:{value:new THREE.Vector3(...SKY_SUN_DIRECTION)}},
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:SKY_BAKE_FRAGMENT,depthWrite:false,depthTest:false,toneMapped:false});
      const quad=new THREE.Mesh(geometry,material);quad.frustumCulled=false;scene.add(quad);
      const previousTarget=gl.getRenderTarget(),viewport=gl.getViewport(new THREE.Vector4());
      const cubeFace=gl.getActiveCubeFace(),mipLevel=gl.getActiveMipmapLevel();
      const scissor=gl.getScissor(new THREE.Vector4()),scissorTest=gl.getScissorTest(),autoClear=gl.autoClear;
      const clearColor=gl.getClearColor(new THREE.Color()),clearAlpha=gl.getClearAlpha();
      try {
        // setRenderTarget installs its physical-pixel viewport. setViewport
        // here would multiply by the gameplay DPR and leave part of low's map black.
        gl.setRenderTarget(target);gl.setScissorTest(false);
        gl.autoClear=true;gl.render(scene,camera);
      } finally {
        gl.setViewport(viewport);gl.setScissor(scissor);gl.setScissorTest(scissorTest);
        gl.setRenderTarget(previousTarget,cubeFace,mipLevel);
        gl.autoClear=autoClear;gl.setClearColor(clearColor,clearAlpha);geometry.dispose();material.dispose();
      }
    };
    bake();
    // Render-target pixels have no CPU backing after a lost WebGL context.
    // Three restores its renderer first; then regenerate this small static map.
    gl.domElement.addEventListener('webglcontextrestored',bake);
    return()=>{gl.domElement.removeEventListener('webglcontextrestored',bake);target.dispose();};
  },[gl,target]);
  useFrame(({camera})=>ref.current?.position.copy(camera.position));
  return <mesh ref={ref} name="kingdom-sky" scale={245} frustumCulled={false} renderOrder={-1000} raycast={()=>{}}>
    <sphereGeometry args={[1,48,24]} />
    <shaderMaterial side={THREE.BackSide} depthWrite={false} depthTest={false} uniforms={uniforms}
      vertexShader={`varying vec2 vUv;varying vec3 vDirection;
        void main(){vUv=uv;vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`uniform sampler2D uSky;uniform vec3 uSun;uniform float uSunCos;uniform float uSunRadiusSq;
        varying vec2 vUv;varying vec3 vDirection;
        void main(){
          vec4 atmosphere=texture2D(uSky,vUv);
          vec3 d=normalize(vDirection),sky=atmosphere.rgb;
          float sunDot=dot(d,uSun),distanceSq=max(0.,2.*(1.-sunDot));
          float halo=1.+distanceSq/(uSunRadiusSq*4.),haze=1.+distanceSq/(uSunRadiusSq*25.);
          sky+=vec3(1.,.45,.12)*(.34/(halo*halo)+.09/(haze*haze));
          float edge=max(fwidth(sunDot),.000001),disc=smoothstep(uSunCos-edge,uSunCos+edge,sunDot);
          float center=1.-clamp(distanceSq/uSunRadiusSq,0.,1.);
          float limb=center*(1.62-.62*center);
          vec3 sunlight=mix(vec3(1.8,.74,.12),vec3(3.2,2.18,.69),limb);
          sky=mix(sky,sunlight,disc*(1.-atmosphere.a*.68));
          gl_FragColor=vec4(sky,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}
