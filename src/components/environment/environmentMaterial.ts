import * as THREE from 'three';

const SUN_NORMAL=new THREE.Vector3(-.48,.72,.56).normalize();

/** Illustrated lighting for background GLBs only. The embedded atlas and baked
 * cavity colours retain detail, while one sun, sky fill and a small specular
 * term replace the full metallic PBR lighting loop on distant architecture.
 * Board materials, exposure, real lights and shadows keep their existing code. */
export function finishEnvironmentMaterial(source: THREE.Material, atmosphere: number, tint?: THREE.ColorRepresentation) {
  if(!(source instanceof THREE.MeshStandardMaterial)||!source.map)return source.clone();
  const color=source.color.clone();if(tint)color.set(tint);
  return new THREE.ShaderMaterial({
    name:source.name,
    vertexColors:source.vertexColors,
    uniforms:{uMap:{value:source.map},uColor:{value:color},
      uEmission:{value:source.emissive.clone().multiplyScalar(source.emissiveIntensity)},
      uMetallic:{value:source.metalness},uRoughness:{value:source.roughness},uSun:{value:SUN_NORMAL},uHaze:{value:atmosphere}},
    vertexShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vTint;
      void main(){
        vUv=uv;vTint=vec3(1.);
        #if defined(USE_COLOR_ALPHA)
          vTint=color.rgb;
        #elif defined(USE_COLOR)
          vTint=color;
        #endif
        vec4 p=vec4(position,1.);vec3 n=normal;
        #ifdef USE_INSTANCING
          p=instanceMatrix*p;
          n=mat3(instanceMatrix)*n;
        #endif
        vNormal=normalize(mat3(modelMatrix)*n);
        vec4 world=modelMatrix*p;vWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`uniform sampler2D uMap;uniform vec3 uColor;uniform vec3 uEmission;
      uniform float uMetallic;uniform float uRoughness;uniform float uHaze;uniform vec3 uSun;
      varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vTint;
      void main(){
        vec3 albedo=texture2D(uMap,vUv).rgb*uColor*vTint;
        vec3 n=normalize(vNormal);float sun=max(0.,dot(n,uSun));
        float sky=clamp(n.y*.5+.5,0.,1.);
        vec3 fill=mix(vec3(.34,.27,.53),vec3(.64,.72,.97),sky);
        vec3 light=fill*.66+vec3(1.62,1.14,.65)*sun;
        vec3 viewDirection=normalize(cameraPosition-vWorld);
        float shine=pow(max(0.,dot(n,normalize(uSun+viewDirection))),mix(64.,14.,uRoughness));
        vec3 lit=albedo*light+uEmission+vec3(1.,.68,.30)*shine*(.025+uMetallic*.34)*(1.-uRoughness*.6);
        float luma=dot(lit,vec3(.2126,.7152,.0722));
        lit=max(vec3(0.),mix(vec3(luma),lit,1.12));
        float aerial=clamp((length(vWorld-cameraPosition)-65.)/210.,0.,1.)*.13;
        gl_FragColor=vec4(mix(lit,vec3(.49,.54,.71),min(.38,uHaze+aerial)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
