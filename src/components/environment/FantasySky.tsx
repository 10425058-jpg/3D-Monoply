import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_SUN_DIRECTION, SUN_ANGULAR_RADIUS } from './sunConfig';
import type { EnvironmentQuality } from './environmentLayout';
import { SKY_BAKE_FRAGMENT } from './skyCloudBake';
import { cloudAtlasTexture, cloudAtlasUrl } from './cloudAtlas';
import { EnvironmentAssetBoundary } from './EnvironmentAssetBoundary';

// Baked once on mount/quality change. No procedural noise or trig cloud mapping
// runs in the full-screen gameplay pass. Direction projection is continuous at
// the equirectangular seam and downward pole, including the steep overview.
/** A static atmosphere bake plus a small screen-resolution solar disc.
 * Slow instanced clouds/airship supply life without a repeating full-screen bake. */
export function FantasySky({ quality = 'balanced' }: { animate: boolean; quality?: EnvironmentQuality }) {
  return <EnvironmentAssetBoundary key={`cloud-sky-${quality}`} label="sky cloud atlas" fallback={<SkySurface quality={quality} />}>
    <Suspense fallback={<SkySurface quality={quality} />}><TexturedSky quality={quality} /></Suspense>
  </EnvironmentAssetBoundary>;
}

function TexturedSky({quality}:{quality:EnvironmentQuality}){
  const source=useTexture(cloudAtlasUrl(quality));
  return <SkySurface quality={quality} cloudSource={source} />;
}

function SkySurface({quality,cloudSource}:{quality:EnvironmentQuality;cloudSource?:THREE.Texture}){
  const gl=useThree(state=>state.gl),ref=useRef<THREE.Mesh>(null);
  const sunRef=useRef<THREE.Mesh>(null);
  const sunDirection=useMemo(()=>new THREE.Vector3(...SKY_SUN_DIRECTION),[]);
  const target=useMemo(()=>{
    const width=quality==='low'?1024:quality==='high'?3072:2048;
    const result=new THREE.WebGLRenderTarget(width,width/2,{depthBuffer:false,stencilBuffer:false,
      format:THREE.RGBAFormat,type:THREE.UnsignedByteType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    result.texture.colorSpace=THREE.NoColorSpace;
    result.texture.generateMipmaps=false; result.texture.wrapS=THREE.RepeatWrapping;
    result.texture.name=`Sunset atmosphere ${width}x${width/2}`;
    return result;
  },[quality]);
  const uniforms=useMemo(()=>({uSky:{value:target.texture}}),[target]);
  const sunUniforms=useMemo(()=>({uSky:{value:target.texture},uSun:{value:sunDirection},
    uCosRadius:{value:Math.cos(SUN_ANGULAR_RADIUS)},uRadiusSq:{value:SUN_ANGULAR_RADIUS*SUN_ANGULAR_RADIUS}}),[target,sunDirection]);
  useLayoutEffect(()=>{
    const bake=()=>{
      const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      const geometry=new THREE.PlaneGeometry(2,2);
      // The sky needs this texture only during its static bake. Dispose the
      // temporary GPU copy immediately; world cloud cards own their own map.
      const cloudMap=cloudSource?cloudAtlasTexture(cloudSource,quality):null;
      const material=new THREE.ShaderMaterial({uniforms:{uSun:{value:new THREE.Vector3(...SKY_SUN_DIRECTION)},uSunRadius:{value:SUN_ANGULAR_RADIUS},
        uCloudAtlas:{value:cloudMap},uHasCloudAtlas:{value:cloudMap?1:0}},
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
        gl.autoClear=autoClear;gl.setClearColor(clearColor,clearAlpha);geometry.dispose();material.dispose();cloudMap?.dispose();
      }
    };
    bake();
    // Render-target pixels have no CPU backing after a lost WebGL context.
    // Three restores its renderer first; then regenerate this small static map.
    gl.domElement.addEventListener('webglcontextrestored',bake);
    return()=>{gl.domElement.removeEventListener('webglcontextrestored',bake);target.dispose();};
  },[gl,target,cloudSource,quality]);
  useFrame(({camera})=>{
    ref.current?.position.copy(camera.position);
    if(sunRef.current) {
      sunRef.current.position.copy(camera.position).addScaledVector(sunDirection,230);
      sunRef.current.quaternion.copy(camera.quaternion);
    }
  });
  return <group>
  <mesh ref={ref} name="kingdom-sky" scale={245} frustumCulled={false} renderOrder={-1000} raycast={()=>{}}>
    <sphereGeometry args={[1,48,24]} />
    <shaderMaterial side={THREE.BackSide} depthWrite={false} depthTest={false} uniforms={uniforms} toneMapped={false}
      vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
      fragmentShader="uniform sampler2D uSky;varying vec2 vUv;void main(){gl_FragColor=texture2D(uSky,vUv);}" />
  </mesh>
  {/* Resolve the small solar disc at screen resolution. This opaque, depth-free
      patch draws before the board; expensive colour math covers only the sun. */}
  <mesh ref={sunRef} name="kingdom-sun-disc" renderOrder={-999} raycast={()=>{}}>
    <planeGeometry args={[230*Math.tan(SUN_ANGULAR_RADIUS)*2.5,230*Math.tan(SUN_ANGULAR_RADIUS)*2.5]} />
    <shaderMaterial uniforms={sunUniforms} depthWrite={false} depthTest={false}
      vertexShader={`varying vec3 vDirection;void main(){vec4 world=modelMatrix*vec4(position,1.);
        vDirection=world.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*world;}`}
      fragmentShader={`uniform sampler2D uSky;uniform vec3 uSun;uniform float uCosRadius;uniform float uRadiusSq;
        varying vec3 vDirection;void main(){vec3 d=normalize(vDirection);float sd=dot(d,uSun);
          float edge=max(fwidth(sd),.000001),disc=smoothstep(uCosRadius-edge,uCosRadius+edge,sd);
          if(disc<.001)discard;
          float center=1.-clamp(max(0.,2.*(1.-sd))/uRadiusSq,0.,1.);
          float altitude=clamp((d.y-uSun.y)/sqrt(uRadiusSq)*.5+.5,0.,1.);
          // Solar limb darkening and the warmer lower atmosphere retain a
          // round luminous body inside the baked three-scale aureole.
          float limb=sqrt(center)*(.76+.24*altitude);
          gl_FragColor=vec4(mix(vec3(1.72,.77,.24),vec3(2.8,2.12,1.12),limb),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          vec2 uv=vec2(fract(atan(d.z,-d.x)/6.28318530718+1.),asin(clamp(d.y,-1.,1.))/3.14159265359+.5);
          gl_FragColor.rgb=mix(texture2D(uSky,uv).rgb,gl_FragColor.rgb,disc);
        }`} />
  </mesh>
  </group>;
}
