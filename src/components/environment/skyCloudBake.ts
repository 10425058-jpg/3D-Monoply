import { SKY_CLOUD_MASSES, skyCloudFrame } from './cloudSkyLayout';
import { CLOUD_LIGHT_RESPONSE } from './cloudAtlas';

const vector=(values:readonly number[])=>`vec3(${values.map(v=>v.toFixed(7)).join(',')})`;
const patches=SKY_CLOUD_MASSES.map(mass=>{
  const frame=skyCloudFrame(mass.direction,mass.roll);
  return `{
    vec4 billow=cloudPatch(d,${vector(frame.center)},${vector(frame.right)},${vector(frame.up)},${mass.radius.toFixed(3)},${mass.variant.toFixed(1)});
    sky=mix(sky,billow.rgb,billow.a);cover=max(cover,billow.a);
  }`;
}).join('\n');

/** Volumetric impostors projected through orthonormal spherical frames.
 * No per-frame fullscreen noise or runtime volumetric raymarch. */
export const SKY_BAKE_FRAGMENT=`
varying vec2 vUv;uniform vec3 uSun;uniform float uSunRadius;
uniform sampler2D uCloudAtlas;uniform float uHasCloudAtlas;
#include <tonemapping_pars_fragment>
${CLOUD_LIGHT_RESPONSE}
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
float cloudMass(vec3 p){
  // Broad connected bodies plus smaller billows. Sampling XYZ direction
  // instead of azimuth cells keeps the same shape scale through the nadir.
  return noise(p)*.63+noise(p*2.03+vec3(3.7,11.2,5.1))*.26+
    noise(p*4.11+vec3(8.3,2.1,17.))* .11;
}
vec4 cloudPatch(vec3 direction,vec3 center,vec3 right,vec3 up,float radius,float variant){
  float facing=dot(direction,center);
  if(facing<.45)return vec4(0.);
  vec2 uv=.5+vec2(dot(direction,right),dot(direction,up))/(2.*radius*facing);
  if(min(uv.x,uv.y)<0.||max(uv.x,uv.y)>1.)return vec4(0.);
  vec2 cell=vec2(mod(variant,4.),floor(variant/4.));
  vec4 volume=texture2D(uCloudAtlas,(cell+clamp(uv,.008,.992))/vec2(4.,2.));
  // The atlas carries optical depth and self-shadowing from the offline bake.
  // Convert linear cloud light into the painted sky's display palette once.
  vec3 relief=cloudDisplayLight(volume.rgb);
  vec3 color=sRGBTransferOETF(vec4(relief,1.)).rgb;
  color=mix(color,vec3(.86,.78,.88),.13);
  float lower=1.-smoothstep(-.85,-.18,center.y);
  float alpha=volume.a*(.45+lower*.12)*smoothstep(0.,.10,volume.a);
  return vec4(color,alpha);
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
  float lower=1.-smoothstep(-.85,-.18,d.y);
  float farDensity=cloudMass(d*vec3(15.,12.,15.)+vec3(23.,8.,9.));
  float farCover=smoothstep(.49,.67,farDensity)*(.35+lower*.25);
  sky=mix(sky,vec3(.85,.76,.88),farCover*.34);
  vec3 p=d*vec3(9.4,10.6,9.4)+vec3(11.,3.,7.);
  float density=cloudMass(p);
  float detail=noise(p*7.2+vec3(3.,8.,1.));
  float cover=smoothstep(.49,.63,density+lower*.025+(detail-.5)*.055);
  // Two offset density samples give soft billow self-shading. This is a
  // static sky bake, not a per-frame volume march or a blurred cloud image.
  float litDensity=cloudMass(p+uSun*.34);
  float light=clamp(.61+(density-litDensity)*4.2+(detail-.5)*.18,.18,.98);
  vec3 cloud=mix(vec3(.69,.62,.80),vec3(.99,.93,.89),light);
  cloud=mix(cloud,cloud*vec3(1.04,1.,.95),warmth*.5);
  float rim=cover*pow(1.-cover,1.8)*4.;
  cloud+=vec3(.055,.032,.020)*rim*light;
  // A quiet distant veil connects the real cloud bodies without turning the
  // lower hemisphere into a full-screen noise/fog blanket.
  sky=mix(sky,cloud,cover*(.06+lower*.04));
  cover*=.18;
  if(uHasCloudAtlas>.5){
    ${patches}
  }
  float wisp=smoothstep(.58,.74,field(d*vec3(23.,58.,23.)+vec3(3.,16.,9.)));
  sky=mix(sky,vec3(.90,.82,.93),wisp*.13*smoothstep(-.2,.7,elevation));
  // At the lower pole there is no radial seam, ring or elongated petal.
  // A pale lower atmosphere connects the denser world-space cloud beds.
  float sea=1.-smoothstep(-.98,-.76,d.y);
  sky=mix(sky,mix(vec3(.73,.65,.83),cloud,.65),sea*.22);
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
