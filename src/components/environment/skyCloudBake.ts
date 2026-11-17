/** Continuous fractal-density sky, baked once per quality/context. No sphere
 * lobes, seams, per-frame fullscreen noise or runtime volumetric raymarch. */
export const SKY_BAKE_FRAGMENT=`
varying vec2 vUv;uniform vec3 uSun;uniform float uSunRadius;
#include <tonemapping_pars_fragment>
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  float a=mix(hash(i),hash(i+vec3(1.,0.,0.)),f.x);
  float b=mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x);
  float c=mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x);
  float e=mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.)),f.x);
  return mix(mix(a,b,f.y),mix(c,e,f.y),f.z);
}
float field(vec3 p){
  float value=0.,weight=.53;
  for(int i=0;i<4;i++){value+=noise(p)*weight;p=p*2.03+vec3(3.1,7.7,1.3);weight*=.48;}
  return value;
}
void main(){
  float theta=(1.-vUv.y)*3.14159265,phi=vUv.x*6.2831853;
  vec3 d=vec3(-cos(phi)*sin(theta),cos(theta),sin(phi)*sin(theta));
  float elevation=asin(clamp(d.y,-1.,1.)),sunDot=max(0.,dot(d,uSun));
  float warmth=pow(sunDot,18.);
  // Broad clear-blue zenith, rose-lavender distance and a peach sunward horizon.
  // Colours are linear here; the bake is tone mapped exactly once below.
  vec3 sky=mix(vec3(.19,.22,.48),vec3(.10,.24,.58),smoothstep(-.50,.75,elevation));
  float horizon=exp(-pow((elevation+.28)*2.6,2.));
  sky=mix(sky,vec3(1.04,.37,.43),horizon*.43);
  sky=mix(sky,vec3(1.55,.70,.35),warmth*.55);
  vec3 p=d*vec3(7.4,13.8,7.4)+vec3(11.,3.,7.);
  p.xz+=(vec2(field(p*.31),field(p*.31+8.))-.5)*1.6;
  float density=field(p);
  float belt=exp(-pow((elevation+.20)*3.4,2.))*.65+exp(-pow((elevation+1.05)*2.5,2.))*.82;
  float cover=smoothstep(.52,.73,density+belt*.14);
  float towardSun=field(p+uSun*.52);
  float light=clamp(.39+(density-towardSun)*4.1,0.,1.);
  vec3 cloud=mix(vec3(.25,.25,.51),vec3(1.53,1.21,1.04),light);
  cloud=mix(cloud,cloud*vec3(1.13,1.02,.91),warmth*.60);
  // A soft illuminated edge gives the banks volume without hard white outlines.
  float rim=cover*pow(1.-cover,1.8)*4.;
  cloud+=vec3(.31,.21,.13)*rim*(.20+warmth*.80)*light;
  sky=mix(sky,cloud,cover*.70);
  float wisp=smoothstep(.59,.80,field(d*vec3(19.,38.,19.)+vec3(3.,16.,9.)));
  sky=mix(sky,vec3(.96,.88,1.15),wisp*.06*smoothstep(-.2,.7,elevation));
  // A diffuse cloud sea gives the steep overview a continuous lower atmosphere.
  float sea=1.-smoothstep(-.98,-.67,d.y);
  float seaDensity=field(d*10.+4.);
  vec3 seaColor=mix(vec3(.39,.36,.62),vec3(1.02,.80,.87),smoothstep(.25,.75,seaDensity));
  sky=mix(sky,seaColor,sea*.49);
  float distanceSq=max(0.,2.*(1.-sunDot)),radiusSq=uSunRadius*uSunRadius;
  float halo=1.+distanceSq/(radiusSq*5.),haze=1.+distanceSq/(radiusSq*38.);
  sky+=vec3(1.,.72,.43)*(.20/(halo*halo)+.12/(haze*haze));
  float edge=max(fwidth(sunDot),.000001),disc=smoothstep(cos(uSunRadius)-edge,cos(uSunRadius)+edge,sunDot);
  float center=1.-clamp(distanceSq/radiusSq,0.,1.);
  sky=mix(sky,mix(vec3(1.8,.91,.28),vec3(3.1,2.45,1.25),center),disc*(1.-cover*.45));
  vec3 color=sRGBTransferOETF(vec4(ACESFilmicToneMapping(sky),1.)).rgb;
  color+=(hash(gl_FragCoord.xyx)-.5)/255.;
  gl_FragColor=vec4(color,1.);
}`;
