import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CLOUD_DECK_CENTER, CLOUD_DECK_RADII, CLOUD_DECK_STEPS } from './atmosphereLayout';
import { mayAnimateEnvironment } from './environmentMotion';
import { variation, type EnvironmentQuality } from './environmentLayout';
import { SKY_SUN_DIRECTION } from './sunConfig';

const FIELD_SIZE = 48;

// The lattice wraps in all three axes so slow advection can scroll indefinitely.
function periodicNoise(cells: number) {
  const grid = Float32Array.from({ length: cells ** 3 }, (_, i) => variation(i, 427 + cells));
  const sample = (x: number, y: number, z: number) => grid[(z * cells + y) * cells + x];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const mix = THREE.MathUtils.lerp;
  return (x: number, y: number, z: number) => {
    const px = x * cells, py = y * cells, pz = z * cells;
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    const nx = (ix + 1) % cells, ny = (iy + 1) % cells, nz = (iz + 1) % cells;
    const fx = smooth(px - ix), fy = smooth(py - iy), fz = smooth(pz - iz);
    const near = mix(mix(sample(ix, iy, iz), sample(nx, iy, iz), fx), mix(sample(ix, ny, iz), sample(nx, ny, iz), fx), fy);
    const far = mix(mix(sample(ix, iy, nz), sample(nx, iy, nz), fx), mix(sample(ix, ny, nz), sample(nx, ny, nz), fx), fy);
    return mix(near, far, fz);
  };
}

function periodicBillows(cells: number) {
  const centers = Array.from({ length: cells ** 3 }, (_, i) => [
    .2 + variation(i, 830) * .6,
    .2 + variation(i, 831) * .6,
    .2 + variation(i, 832) * .6,
  ]);
  const wrap = (index: number) => (index + cells) % cells;
  return (x: number, y: number, z: number) => {
    const px = x * cells, py = y * cells, pz = z * cells;
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    let distance = 1;
    for (let dz = -1; dz <= 1; dz++) {
      const slab = wrap(iz + dz) * cells;
      for (let dy = -1; dy <= 1; dy++) {
        const row = (slab + wrap(iy + dy)) * cells;
        for (let dx = -1; dx <= 1; dx++) {
          const center = centers[row + wrap(ix + dx)];
          const ox = px - ix - dx - center[0];
          const oy = py - iy - dy - center[1];
          const oz = pz - iz - dz - center[2];
          distance = Math.min(distance, ox * ox + oy * oy + oz * oz);
        }
      }
    }
    return 1 - distance;
  };
}

function createDensityField() {
  const broad = periodicNoise(4), folds = periodicBillows(9), detail = periodicNoise(18);
  const size = FIELD_SIZE;
  const density = new Uint8Array(size ** 3);
  const data = new Uint8Array(density.length * 2);
  const offset = (x: number, y: number, z: number) => (z * size + y) * size + x;
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, w = z / size;
    const amount = broad(u, v, w) * .54 + folds(u, v, w) * .33 + detail(u, v, w) * .13;
    density[offset(x, y, z)] = Math.round(amount * 255);
  }
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = offset(x, y, z);
    // A directional density difference gives lit billow shoulders in the
    // same lookup as density, with light entering from the open sky above.
    const towardSky = offset(x, (y + 2) % size, (z + size - 2) % size);
    const furtherSky = offset(x, (y + 4) % size, (z + size - 4) % size);
    const light = 165 + 2.7 * (density[index] - density[towardSky]) - .36 * density[furtherSky];
    const body = THREE.MathUtils.smoothstep(density[index] / 255, .45, .76);
    data[2 * index] = Math.round(255 * body * body);
    data[2 * index + 1] = Math.round(255 * THREE.MathUtils.smoothstep(light / 255, .20, .78));
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.name = 'Cloud deck density and lighting';
  texture.format = THREE.RGFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** A short ray integral inside an ellipsoid well below the playing field.
 * The opaque scene depth rejects rays that hit the board or upper cliffs first. */
export function CloudDeck({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  const densityField = useMemo(createDensityField, []);
  useEffect(() => () => densityField.dispose(), [densityField]);
  const uniforms = useMemo(() => ({
    uField: { value: densityField },
    uCenter: { value: new THREE.Vector3(...CLOUD_DECK_CENTER) },
    uRadii: { value: new THREE.Vector3(...CLOUD_DECK_RADII) },
    uSun: { value: new THREE.Vector3(...SKY_SUN_DIRECTION) },
    uWind: { value: new THREE.Vector3() },
    uShadow: { value: new THREE.Color('#8379aa') },
    uScatter: { value: new THREE.Color('#f2deee') },
    uLight: { value: new THREE.Color('#fff2e3') },
  }), [densityField]);
  useFrame((_, delta) => {
    if (!mayAnimateEnvironment(animate)) return;
    const time = Math.min(delta, .1);
    const wind = uniforms.uWind.value;
    wind.x = (wind.x + time * .0014) % 1;
    wind.z = (wind.z + time * .0005) % 1;
  });

  return <mesh name="low-cloud-deck" position={CLOUD_DECK_CENTER} scale={CLOUD_DECK_RADII}
    renderOrder={0} raycast={() => {}}>
    <sphereGeometry args={[1, 40, 20]} />
    <shaderMaterial key={quality} transparent depthWrite={false} toneMapped={false} uniforms={uniforms}
      defines={{ CLOUD_STEPS: CLOUD_DECK_STEPS[quality] }}
      vertexShader={`varying vec3 vPoint;
        void main(){
          vPoint=position;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`}
      fragmentShader={`uniform highp sampler3D uField;
        uniform vec3 uCenter,uRadii,uSun,uWind,uShadow,uScatter,uLight;
        varying vec3 vPoint;
        void main(){
          // Intersect in unit-sphere coordinates, then integrate extinction
          // using the actual distance traveled in world space.
          vec3 origin=(cameraPosition-uCenter)/uRadii;
          vec3 ray=normalize(vPoint-origin);
          float b=dot(origin,ray);
          float halfChord=sqrt(max(0.,1.+b*b-dot(origin,origin)));
          float start=max(0.,-b-halfChord);
          float stride=(-b+halfChord-start)/float(CLOUD_STEPS);
          if(stride<=0.)discard;
          vec3 worldRay=ray*uRadii;
          float worldScale=length(worldRay);
          float stepLength=worldScale*stride;
          float sunset=max(0.,dot(worldRay,uSun)/worldScale);
          vec3 p=origin+ray*(start+.5*stride);
          vec3 increment=ray*stride;
          const vec3 fieldScale=vec3(.008,.012,.008);
          vec3 coordinates=(p*uRadii+uCenter)*fieldScale+uWind;
          vec3 fieldStep=worldRay*(stride*fieldScale);
          float opticalDepth=0.;
          float illumination=0.;
          for(int i=0;i<CLOUD_STEPS;i++){
            vec2 field=texture(uField,coordinates).rg;
            float shell=clamp((1.-dot(p,p))*2.6,0.,1.);
            // Dense pockets rise through the deck. A wider, lighter fog
            // fills the gaps and softens the bottom of the cloud field.
            float cloud=.105*field.r*(1.-.78*abs(p.y-.12));
            float fog=.0018-.0012*p.y;
            float density=(cloud+fog)*shell*shell;
            opticalDepth+=density;
            illumination+=density*clamp(field.g+p.y*.34,0.,1.);
            p+=increment;
            coordinates+=fieldStep;
          }
          // Density-weighted lighting uses a single extinction evaluation
          // after the march, keeping the lower presets inexpensive.
          float alpha=1.-exp(-opticalDepth*stepLength);
          if(alpha<.004)discard;
          vec3 warm=mix(uScatter,uLight,sunset*sunset*sunset*sunset);
          gl_FragColor=vec4(mix(uShadow,warm,illumination/max(opticalDepth,.00001)),alpha);
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}
