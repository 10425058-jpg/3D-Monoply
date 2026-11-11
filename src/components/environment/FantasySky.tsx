import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_SUN_DIRECTION, SUN_ANGULAR_RADIUS } from './sunConfig';
import type { EnvironmentQuality } from './environmentLayout';

// Baked once on mount/quality change. No procedural noise or trig cloud mapping
// runs in the full-screen gameplay pass. Direction projection is continuous at
// the equirectangular seam and downward pole, including the steep overview.
const BAKE_FRAGMENT = `
  varying vec2 vUv; uniform vec3 uSun;
  float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
  float fbm(vec2 p){return noise(p)*.53+noise(p*2.03)*.27+noise(p*4.07)*.13+noise(p*8.13)*.07;}
  float puff(vec2 p,vec2 c,vec2 size){vec2 q=(p-c)/size;float r=max(0.,1.-dot(q,q));return r*r;}
  float cumulus(vec2 p){return
    puff(p,vec2(-.79,-.12),vec2(.44,.33))*.75+
    puff(p,vec2(-.46,.13),vec2(.54,.52))*.92+
    puff(p,vec2(-.02,.33),vec2(.63,.64))+
    puff(p,vec2(.47,.15),vec2(.51,.48))*.88+
    puff(p,vec2(.81,-.09),vec2(.39,.31))*.69+
    puff(p,vec2(-.04,-.20),vec2(1.03,.31))*.75;
  }
  float banks(vec3 d){
    float front=1.-smoothstep(-.65,.25,d.z);
    return (cumulus((d.xy-vec2(-.43,-.24))/vec2(.19,.12))+
      cumulus((d.xy-vec2(.42,-.20))/vec2(.21,.13))*.95+
      cumulus((d.xy-vec2(-.56,-.76))/vec2(.21,.13))*.72+
      cumulus((d.xy-vec2(.55,-.80))/vec2(.21,.14))*.74)*front;
  }
  void main(){
    float theta=(1.-vUv.y)*3.14159265359,phi=vUv.x*6.28318530718;
    vec3 d=vec3(-cos(phi)*sin(theta),cos(theta),sin(phi)*sin(theta));
    float elevation=asin(clamp(d.y,-1.,1.));
    float h=smoothstep(-1.4,.03,elevation);
    vec3 sky=mix(vec3(.26,.14,.40),vec3(.20,.12,.38),h);
    float roseBand=exp(-pow((elevation+.72)*2.3,2.));
    sky=mix(sky,vec3(.70,.19,.24),roseBand*.61);
    float sunDot=max(0.,dot(d,uSun)),warm=pow(sunDot,8.);
    sky=mix(sky,vec3(.98,.42,.23),warm*.44);
    sky=mix(sky,vec3(1.,.60,.17),pow(sunDot,35.)*.38);

    vec2 uv=vec2(d.x*7.+d.z*.65,d.y*12.+d.z*2.8);
    float warp=noise(uv*.44);
    vec2 shaped=uv+vec2(warp*.85,warp*.38);
    float field=fbm(shaped);
    float poleFade=1.-smoothstep(.92,.998,abs(d.y));
    float bank=banks(d),shifted=banks(normalize(d+vec3(.012,.017,0.)));
    float density=smoothstep(.075,.57,bank+(field-.5)*.08)*poleFade;
    float lit=clamp(.43+(bank-shifted)*2.4+(field-.5)*.24+warm*.15,0.,1.);
    vec3 shadow=mix(vec3(.20,.09,.31),vec3(.39,.15,.26),warm);
    vec3 light=mix(vec3(.83,.43,.56),vec3(.95,.43,.21),warm);
    vec3 cloud=mix(shadow,light,lit);
    float rim=smoothstep(.10,.27,bank)*(1.-smoothstep(.27,.52,bank));
    cloud+=vec3(1.,.58,.27)*rim*warm*.14;
    sky=mix(sky,cloud,density*.90);

    vec2 highUv=vec2(d.x*9.+d.z*1.8,d.y*32.+d.z*3.);
    float cirrus=smoothstep(.48,.77,noise(highUv+warp*.6)*.7+noise(highUv*2.17)*.3)*poleFade;
    float veil=exp(-pow((elevation+.35)*5.,2.))*.17+exp(-pow((elevation+1.10)*5.,2.))*.10;
    sky=mix(sky,mix(vec3(.59,.30,.57),vec3(1.,.57,.32),warm),cirrus*.12+smoothstep(.48,.70,field)*veil*poleFade);
    gl_FragColor=vec4(sky,1.);
  }`;

/** A static low-resolution atmosphere bake plus analytic sun in one sky draw.
 * Slow instanced clouds/airship supply life without a repeating full-screen bake. */
export function FantasySky({ quality = 'balanced' }: { animate: boolean; quality?: EnvironmentQuality }) {
  const gl=useThree(state=>state.gl),ref=useRef<THREE.Mesh>(null);
  const target=useMemo(()=>{
    const width=quality==='low'?512:1024;
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
        fragmentShader:BAKE_FRAGMENT,depthWrite:false,depthTest:false,toneMapped:false});
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
          vec3 d=normalize(vDirection),sky=texture2D(uSky,vUv).rgb;
          float sunDot=dot(d,uSun),distanceSq=max(0.,2.*(1.-sunDot));
          float halo=1.+distanceSq/(uSunRadiusSq*4.),haze=1.+distanceSq/(uSunRadiusSq*25.);
          sky+=vec3(1.,.45,.12)*(.34/(halo*halo)+.09/(haze*haze));
          float edge=max(fwidth(sunDot),.000001),disc=smoothstep(uSunCos-edge,uSunCos+edge,sunDot);
          float center=1.-clamp(distanceSq/uSunRadiusSq,0.,1.);
          sky=mix(sky,mix(vec3(2.1,1.25,.18),vec3(3.1,2.2,.63),center*.65),disc);
          gl_FragColor=vec4(sky,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}
