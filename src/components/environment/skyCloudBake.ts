/** Static painted-volume approximation, evaluated once per quality/context.
 * Eight shaded ellipsoids per bank give rounded silhouettes and lavender
 * undersides without a runtime volume march or new model dependency. */
export const SKY_BAKE_FRAGMENT = `
varying vec2 vUv; uniform vec3 uSun; uniform float uSunRadius;
#include <tonemapping_pars_fragment>
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
void lobe(vec2 p,vec2 c,vec2 size,float depth,inout vec3 normals,inout float weight,inout float cover){
  vec2 q=(p-c)/size;float r=dot(q,q),height=sqrt(max(0.,1.-r));
  float alpha=1.-smoothstep(.85,1.04,r),w=height*height*height*depth;
  normals+=normalize(vec3(q*.85,max(.03,height)))*w;weight+=w;cover=max(cover,alpha);
}
vec4 cloudBank(vec2 p,float warm){
  p+=vec2(noise(p*9.+1.),noise(p*11.+7.))*.035;
  vec3 normals=vec3(0.);float weight=0.,cover=0.;
  lobe(p,vec2(-.88,-.15),vec2(.40,.31),.70,normals,weight,cover);
  lobe(p,vec2(-.57,.10),vec2(.50,.43),.90,normals,weight,cover);
  lobe(p,vec2(-.20,.34),vec2(.48,.55),1.1,normals,weight,cover);
  lobe(p,vec2(.24,.39),vec2(.51,.59),1.0,normals,weight,cover);
  lobe(p,vec2(.66,.11),vec2(.50,.43),.9,normals,weight,cover);
  lobe(p,vec2(.98,-.17),vec2(.39,.29),.7,normals,weight,cover);
  lobe(p,vec2(.03,-.24),vec2(.91,.35),1.2,normals,weight,cover);
  lobe(p,vec2(-.35,-.16),vec2(.53,.33),1.25,normals,weight,cover);
  // Small crown lobes break the broad bank into lit, rounded billows.
  for(int i=0;i<9;i++){
    float a=float(i)*2.399963;
    vec2 c=vec2(sin(a)*.78,cos(a)*.23+.32);
    lobe(p,c,vec2(.22,.26),.75,normals,weight,cover);
  }
  vec3 normal=normalize(normals/max(.001,weight)+vec3(0.,0.,.03));
  normal.xy+=(vec2(noise(p*16.),noise(p*21.+3.))-.5)*.065;
  float lit=clamp(dot(normal,normalize(vec3(.60,.75,.62))),0.,1.);
  float belly=smoothstep(-.63,.55,p.y);
  vec3 shade=mix(vec3(.28,.15,.46),vec3(.48,.24,.43),warm);
  vec3 light=mix(vec3(1.20,.69,.96),vec3(1.75,1.07,.65),warm);
  vec3 color=mix(shade,light,.12+lit*.82)*(.82+belly*.18);
  float silver=pow(max(0.,normal.x*.6+normal.y*.8),5.)*warm;
  color+=vec3(.32,.17,.045)*silver;
  return vec4(color,cover*.91);
}
void composite(inout vec3 sky,inout float cover,vec4 cloud,float fade){
  float a=cloud.a*fade;sky=mix(sky,cloud.rgb,a);cover=max(cover,a);
}
void main(){
  float theta=(1.-vUv.y)*3.14159265359,phi=vUv.x*6.28318530718;
  vec3 d=vec3(-cos(phi)*sin(theta),cos(theta),sin(phi)*sin(theta));
  float elevation=asin(clamp(d.y,-1.,1.)),sunDot=max(0.,dot(d,uSun));
  float horizon=exp(-pow((elevation+.62)*2.7,2.)),warm=pow(sunDot,7.);
  vec3 sky=mix(vec3(.25,.19,.66),vec3(.50,.25,.51),1.-smoothstep(-1.45,.15,elevation));
  sky=mix(sky,vec3(1.05,.30,.43),horizon*.55);
  sky=mix(sky,vec3(.25,.39,.86),smoothstep(-.40,.65,elevation)*.45);
  sky=mix(sky,vec3(1.5,.66,.24),warm*.78);
  float cover=0.;
  float azimuth=atan(d.x,-d.z);
  // Three spherical cloud shelves cover the entire orbit, with different
  // heights, gaps and billow scales. Evaluated only in this one-time bake.
  for(int row=0;row<3;row++)for(int i=0;i<9;i++){
    float seed=float(i)*3.17+float(row)*9.3;
    float center=float(i)*6.2831853/9.+float(row)*.37;
    float dx=atan(sin(azimuth-center),cos(azimuth-center));
    float width=.26+hash(vec2(seed,2.))*.13;
    float height=.12+float(row)*.05;
    float level=-.20-float(row)*.42+(hash(vec2(seed,6.))-.5)*.15;
    if(abs(dx)<width*1.42 && abs(elevation-level)<height*1.3){
      vec2 p=vec2(dx/width,(elevation-level)/height);
      float fade=(.70+float(row)*.09)*smoothstep(-1.55,-1.43,elevation);
      composite(sky,cover,cloudBank(p,warm),fade);
    }
  }
  // Continuous direction-space wisps wrap around the rest of the sky.
  vec2 uv=vec2(d.x*14.+d.z*3.,d.y*35.+d.z*5.);
  float streak=noise(uv)*.65+noise(uv*2.1)*.35;
  float veil=smoothstep(.55,.79,streak)*(1.-smoothstep(.93,.998,abs(d.y)))*.13;
  sky=mix(sky,mix(vec3(.48,.27,.50),vec3(1.,.65,.36),warm),veil);
  float distanceSq=max(0.,2.*(1.-sunDot)),radiusSq=uSunRadius*uSunRadius;
  float halo=1.+distanceSq/(radiusSq*4.),haze=1.+distanceSq/(radiusSq*25.);
  sky+=vec3(1.,.45,.12)*(.34/(halo*halo)+.09/(haze*haze));
  float edge=max(fwidth(sunDot),.000001),disc=smoothstep(cos(uSunRadius)-edge,cos(uSunRadius)+edge,sunDot);
  float center=1.-clamp(distanceSq/radiusSq,0.,1.),limb=center*(1.62-.62*center);
  sky=mix(sky,mix(vec3(1.8,.74,.12),vec3(3.2,2.18,.69),limb),disc*(1.-cover*.68));
  // Display-referred RGBA8, intentionally not sRGB-decoded on texture fetch.
  // The static ACES/sRGB conversion also belongs in this one-time pass.
  vec3 displayColor=sRGBTransferOETF(vec4(ACESFilmicToneMapping(sky),1.)).rgb;
  float luminance=dot(displayColor,vec3(.2126,.7152,.0722));
  displayColor=clamp(mix(vec3(luminance),displayColor,1.24),0.,1.);
  displayColor+=(hash(gl_FragCoord.xy)-.5)/255.;
  gl_FragColor=vec4(displayColor,1.);
}`;
