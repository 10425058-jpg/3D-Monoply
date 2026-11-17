import * as THREE from 'three';

const SUN_NORMAL=new THREE.Vector3(-.48,.72,.56).normalize();

/** Board support/dressing are excluded from the scenic art pass. */
export const isScenicEnvironmentAsset=(file:string)=>
  !file.startsWith('crown-foundation')&&!file.startsWith('royal-garden-dressing');

/** Illustrated lighting for background GLBs only. The embedded atlas and baked
 * cavity colours retain detail, while one sun, sky fill and a small specular
 * term replace the full metallic PBR lighting loop on distant architecture.
 * Board materials, exposure, real lights and shadows keep their existing code. */
export function finishEnvironmentMaterial(source: THREE.Material, atmosphere: number, tint?: THREE.ColorRepresentation, scenic = true) {
  if(!(source instanceof THREE.MeshStandardMaterial)||!source.map)return source.clone();
  const color=source.color.clone();if(tint)color.set(tint);
  // Tune surface reflectance, not the shared renderer exposure or board lights.
  const kind=source.name;
  const grass=kind==='Meadow and moss',rock=kind==='Lavender layered cliff';
  const foliage=kind==='Deep evergreen foliage',blossom=kind==='Sakura blossom clusters';
  const roof=kind==='Royal blue glazed slate';
  const stone=kind==='Ivory limestone'||kind==='Carved sandstone';
  const palette=scenic?(grass?[.66,.85,.54]:rock?[.72,.71,.88]:foliage?[.66,.85,.68]:
    roof?[.60,.80,1.10]:blossom?[1.06,.83,.97]:[1.05,.99,.92]):
    (grass?[.60,.84,.49]:rock?[.72,.68,.83]:foliage?[.66,.86,.67]:roof?[.54,.76,1.12]:blossom?[1.10,.72,.90]:[1.04,.96,.85]);
  color.multiply(new THREE.Color().setRGB(...palette as [number,number,number]));
  return new THREE.ShaderMaterial({
    name:source.name,
    vertexColors:source.vertexColors,
    uniforms:{uMap:{value:source.map},uColor:{value:color},
      uEmission:{value:source.emissive.clone().multiplyScalar(source.emissiveIntensity)},
      uMetallic:{value:source.metalness},uRoughness:{value:source.roughness},uSun:{value:SUN_NORMAL},uHaze:{value:atmosphere},
      uScenic:{value:scenic?1:0},uStone:{value:stone?1:0},
      uSurface:{value:new THREE.Vector4(grass?1:0,rock?1:0,roof?1:0,blossom?1:0)}},
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
      uniform float uMetallic;uniform float uRoughness;uniform float uHaze;uniform vec3 uSun;uniform vec4 uSurface;
      uniform float uScenic;uniform float uStone;
      varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vTint;
      void main(){
        vec3 albedo=texture2D(uMap,vUv).rgb*uColor*vTint;
        // Uniform branches skip unused pattern ALU for roofs, glass and metal.
        if(uSurface.x+uSurface.w>0.){
          float patches=sin(vWorld.x*.73+sin(vWorld.z*.41))*sin(vWorld.z*.53-vWorld.x*.17);
          albedo*=1.+patches*(uSurface.x*.10+uSurface.w*.06);
        }else if(uSurface.y>0.){
          float strata=sin(vWorld.y*5.4+sin(vWorld.x*1.3+vWorld.z*.72)*.65);
          albedo*=1.+strata*uSurface.y*.075;
        }
        vec3 n=normalize(vNormal);float sun=max(0.,dot(n,uSun));
        float sky=clamp(n.y*.5+.5,0.,1.);
        vec3 fill=mix(vec3(.27,.23,.44),vec3(.48,.61,.91),sky);
        // Restrained cool fill retains shaded relief; gold key models the forms.
        vec3 light=fill*.48+vec3(1.77,1.20,.66)*sun;
        if(uScenic>.5){
          // Wide soft sky fill lifts small architectural recesses while the
          // original vertex-baked contact shading still anchors every prop.
          float wrapped=clamp((dot(n,uSun)+.22)/1.22,0.,1.);
          light=mix(vec3(.24,.23,.39),vec3(.43,.52,.73),sky)*.66+vec3(1.59,1.22,.84)*wrapped;
          if(uStone>.5){
            float grain=sin(vWorld.x*13.+vWorld.z*7.)*sin(vWorld.y*19.-vWorld.x*3.);
            albedo*=.99+grain*.012;
          }
        }
        vec3 viewDirection=normalize(cameraPosition-vWorld);
        float shine=pow(max(0.,dot(n,normalize(uSun+viewDirection))),mix(64.,14.,uRoughness));
        vec3 lit=albedo*light+uEmission*vec3(1.08,.78,.43)+vec3(1.,.73,.40)*shine*(.035+uMetallic*.42+uSurface.z*.10)*(1.-uRoughness*.6);
        if(uSurface.w>0.){
          float backlight=pow(clamp(1.-dot(n,viewDirection),0.,1.),3.);
          lit+=albedo*backlight*.14;
          if(uScenic>.5)lit+=albedo*vec3(.25,.12,.16)*pow(max(0.,dot(-n,uSun)),2.);
        }
        float luma=dot(lit,vec3(.2126,.7152,.0722));
        lit=max(vec3(0.),mix(vec3(luma),lit,uScenic>.5?1.015:1.06));
        // No constant haze floor. Responsive pullback keeps the same depth tiers.
        float distance=length(vWorld-cameraPosition)-max(0.,length(cameraPosition)-60.);
        float aerial=smoothstep(88.,250.,distance)*(.24+uHaze*.55);
        vec3 hazeColor=uScenic>.5?vec3(.44,.42,.65):vec3(.32,.40,.65);
        gl_FragColor=vec4(mix(lit,hazeColor,aerial),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
