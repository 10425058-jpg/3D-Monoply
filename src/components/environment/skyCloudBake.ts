/** Art-directed cloud banks and fractal edge relief, baked once per quality.
 * No per-frame fullscreen noise or runtime volumetric raymarch. */
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
  for(int i=0;i<5;i++){value+=noise(p)*weight;p=p*2.03+vec3(3.1,7.7,1.3);weight*=.48;}
  return value;
}
float dome(vec2 p,vec2 center,vec2 radius){
  vec2 q=(p-center)/radius;float body=max(0.,1.-dot(q,q));return body*body;
}
float cloudVolume(vec2 p,float seed){
  float a=dome(p,vec2(-.23,-.04),vec2(.21,.47));
  float b=dome(p,vec2(-.10,.20+seed*.12),vec2(.23,.70));
  float c=dome(p,vec2(.10,.14-seed*.10),vec2(.24,.64));
  float e=dome(p,vec2(.26,-.11),vec2(.18,.41));
  float crown=dome(p,vec2(.035,.47),vec2(.17,.47));
  return max(max(max(a,b),max(c,e)),crown);
}
vec2 cloudBank(float azimuth,float elevation,float layer,float detail){
  float slots=layer<.5?21.:layer<1.5?24.:27.;
  float cell=azimuth/6.2831853*slots+layer*.371;
  float id=mod(floor(cell),slots),seed=hash(vec3(id,layer,13.));
  float center=layer<.5?-.08:layer<1.5?-.68:-1.14;
  center+=(seed-.5)*.24;
  float height=layer<.5?.13:layer<1.5?.135:.12;
  vec2 p=vec2(fract(cell)-.5,(elevation-center)/height);
  p.x*=.88+seed*.26;
  p.x+=(detail-.5)*.09;p.y+=(detail-.5)*.32;
  float density=cloudVolume(p,seed);
  float volume=density;
  float shifted=cloudVolume(p+vec2(-.032,.09),seed);
  density+=((detail-.5)*.38)*smoothstep(.015,.22,density);
  float cover=smoothstep(.06,.17,density);
  float light=clamp(.58+(volume-shifted)*1.6+(detail-.5)*.48+p.y*.09,.12,.96);
  return vec2(cover,light);
}
void main(){
  float theta=(1.-vUv.y)*3.14159265,phi=vUv.x*6.2831853;
  vec3 d=vec3(-cos(phi)*sin(theta),cos(theta),sin(phi)*sin(theta));
  float elevation=asin(clamp(d.y,-1.,1.)),sunDot=max(0.,dot(d,uSun));
  float warmth=pow(sunDot,18.);
  // The static texture is authored in display colour, like a painted skybox.
  // Keeping its palette here avoids filmic compression washing pastel shadows
  // and peach highlights into the same gray-white blanket.
  vec3 sky=mix(vec3(.61,.51,.79),vec3(.48,.59,.86),smoothstep(-.75,.80,elevation));
  float horizon=exp(-pow((elevation+.27)*2.7,2.));
  sky=mix(sky,vec3(.91,.66,.74),horizon*.57);
  sky=mix(sky,vec3(1.,.79,.60),warmth*.67);
  float detail=field(d*52.+vec3(11.,3.,7.));
  float farDensity=field(d*vec3(21.,34.,21.)+vec3(23.,8.,9.));
  float farCover=smoothstep(.53,.67,farDensity)*exp(-pow((elevation+.39)*3.4,2.));
  sky=mix(sky,vec3(.83,.70,.86),farCover*.27);
  float cover=0.;
  for(int i=0;i<3;i++){
    float layer=float(i);vec2 bank=cloudBank(phi,elevation,layer,detail);
    vec3 shade=mix(vec3(.72,.63,.83),vec3(.99,.89,.84),bank.y);
    shade=mix(shade,shade*vec3(1.05,1.,.94),warmth*.55);
    float rim=bank.x*pow(1.-bank.x,1.8)*4.;
    shade+=vec3(.065,.027,.012)*rim*bank.y;
    float opacity=bank.x*(i==0?.85:i==1?.91:.94);
    sky=mix(sky,shade,opacity);cover=max(cover,bank.x);
  }
  float wisp=smoothstep(.58,.74,field(d*vec3(23.,58.,23.)+vec3(3.,16.,9.)));
  sky=mix(sky,vec3(.90,.82,.93),wisp*.13*smoothstep(-.2,.7,elevation));
  float sea=1.-smoothstep(-1.34,-.99,elevation);
  float seaDensity=field(d*18.+4.);
  vec3 seaColor=mix(vec3(.66,.56,.80),vec3(.90,.77,.88),smoothstep(.30,.69,seaDensity));
  sky=mix(sky,seaColor,sea*.67);
  float distanceSq=max(0.,2.*(1.-sunDot)),radiusSq=uSunRadius*uSunRadius;
  float halo=1.+distanceSq/(radiusSq*5.),haze=1.+distanceSq/(radiusSq*38.);
  // Three scales of warm scattering integrate the sun with the sky instead
  // of leaving a hard bright sticker over an unrelated background gradient.
  float aureole=1.+distanceSq/(radiusSq*130.);
  sky+=vec3(.22,.14,.065)*(.33/(halo*halo)+.23/(haze*haze)+.075/(aureole*aureole));
  float edge=max(fwidth(sunDot),.000001),disc=smoothstep(cos(uSunRadius)-edge,cos(uSunRadius)+edge,sunDot);
  float center=1.-clamp(distanceSq/radiusSq,0.,1.);
  sky=mix(sky,mix(vec3(1.,.86,.59),vec3(1.,.97,.82),sqrt(center)),disc*(1.-cover*.45));
  vec3 color=sky;
  color+=(hash(gl_FragCoord.xyx)-.5)/255.;
  gl_FragColor=vec4(color,1.);
}`;
