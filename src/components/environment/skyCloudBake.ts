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
  float warmth=pow(sunDot,20.);
  vec3 sky=mix(vec3(.24,.29,.54),vec3(.12,.22,.58),smoothstep(-1.3,.55,elevation));
  float horizon=exp(-pow((elevation+.32)*2.9,2.));
  sky=mix(sky,vec3(.98,.41,.35),horizon*.35);
  sky=mix(sky,vec3(1.55,.87,.38),warmth*.58);
  vec3 p=d*vec3(9.2,16.5,9.2)+vec3(11.,3.,7.);
  p.xz+=(vec2(field(p*.31),field(p*.31+8.))-.5)*1.8;
  float density=field(p);
  float belt=exp(-pow((elevation+.22)*3.5,2.))*.63+exp(-pow((elevation+1.05)*2.5,2.))*.75;
  float cover=smoothstep(.55,.78,density+belt*.12);
  float towardSun=field(p+uSun*.34);
  float light=clamp(.68+(density-towardSun)*3.0,0.,1.);
  vec3 cloud=mix(vec3(.28,.30,.54),vec3(1.35,1.21,1.11),light);
  cloud=mix(cloud,cloud*vec3(1.18,1.02,.84),warmth*.6);
  sky=mix(sky,cloud,cover*.56);
  // A diffuse cloud sea gives the steep overview a continuous lower atmosphere.
  float sea=1.-smoothstep(-.98,-.67,d.y);
  sky=mix(sky,mix(vec3(.53,.55,.73),vec3(.83,.76,.79),field(d*13.+4.)),sea*.72);
  float distanceSq=max(0.,2.*(1.-sunDot)),radiusSq=uSunRadius*uSunRadius;
  float halo=1.+distanceSq/(radiusSq*5.),haze=1.+distanceSq/(radiusSq*38.);
  sky+=vec3(1.,.57,.22)*(.24/(halo*halo)+.11/(haze*haze));
  float edge=max(fwidth(sunDot),.000001),disc=smoothstep(cos(uSunRadius)-edge,cos(uSunRadius)+edge,sunDot);
  float center=1.-clamp(distanceSq/radiusSq,0.,1.);
  sky=mix(sky,mix(vec3(1.8,.91,.25),vec3(3.,2.35,1.05),center),disc*(1.-cover*.45));
  vec3 color=sRGBTransferOETF(vec4(ACESFilmicToneMapping(sky),1.)).rgb;
  color+=(hash(gl_FragCoord.xyx)-.5)/255.;
  gl_FragColor=vec4(color,1.);
}`;
