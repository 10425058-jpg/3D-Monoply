import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type Quality = 'low' | 'balanced' | 'high';
type Vec3 = [number, number, number];

type IslandLayout = {
  position: Vec3;
  scale: number;
  topColor: string;
  canopyColor: string;
};

const ISLANDS: IslandLayout[] = [
  { position: [-20, -1.15, -15], scale: 0.82, topColor: '#719f69', canopyColor: '#6b9d5b' },
  { position: [20, -1.10, -16], scale: 0.84, topColor: '#7ca66d', canopyColor: '#78a85d' },
  { position: [-22, -1.35, 1], scale: 0.78, topColor: '#759f68', canopyColor: '#6c9f5a' },
  { position: [22, -1.25, 3], scale: 0.84, topColor: '#6d9d69', canopyColor: '#79a95e' },
  { position: [-19, -1.25, 17], scale: 0.76, topColor: '#77a36b', canopyColor: '#6c9f59' },
  { position: [19, -1.20, 18], scale: 0.82, topColor: '#739e68', canopyColor: '#7ba85e' },
];

const CLOUD_CLUSTERS: Array<{ position: Vec3; scale: number; tone: string }> = [
  { position: [-18, 5.8, -13], scale: 1.35, tone: '#fff3f5' },
  { position: [-11, 8.8, -21], scale: 1.15, tone: '#e7e0ff' },
  { position: [1, 8.0, -23], scale: 1.35, tone: '#fff7f0' },
  { position: [13, 8.4, -19], scale: 1.28, tone: '#eee5ff' },
  { position: [19, 5.3, -8], scale: 1.25, tone: '#fff5f0' },
  { position: [-20, 4.5, -3], scale: 1.18, tone: '#f0eaff' },
  { position: [-19, 3.1, 11], scale: 1.45, tone: '#fff2f7' },
  { position: [19, 3.0, 13], scale: 1.48, tone: '#f2eaff' },
  { position: [-12, 2.8, 20], scale: 1.35, tone: '#fff5f5' },
  { position: [12, 2.7, 21], scale: 1.42, tone: '#eeeaff' },
  { position: [0, 10.5, 23], scale: 1.1, tone: '#fff6f1' },
  { position: [-25, 7.0, 4], scale: 1.0, tone: '#fff3f0' },
  { position: [25, 6.8, 5], scale: 1.12, tone: '#efe9ff' },
];

const CLOUD_OFFSETS: Array<[number, number, number, number]> = [
  [-0.62, 0.00, 0.00, 0.58],
  [-0.25, 0.24, 0.04, 0.78],
  [0.18, 0.20, -0.02, 0.88],
  [0.60, 0.02, 0.03, 0.62],
  [-0.05, -0.12, 0.25, 0.62],
  [0.36, -0.10, -0.22, 0.50],
];

const LANTERNS: Vec3[] = [
  [-14.2, -0.1, -13.6],
  [-14.6, -0.1, 0],
  [-14.0, -0.1, 13.5],
  [14.2, -0.1, -13.6],
  [14.6, -0.1, 0],
  [14.0, -0.1, 13.5],
  [-7.0, 0.0, -14.4],
  [7.0, 0.0, -14.4],
  [-7.0, 0.0, 14.4],
  [7.0, 0.0, 14.4],
];

const SkyDome: React.FC = () => (
  <mesh scale={170} frustumCulled={false} renderOrder={-1000}>
    <sphereGeometry args={[1, 48, 32]} />
    <shaderMaterial
      side={THREE.BackSide}
      depthWrite={false}
      depthTest={false}
      uniforms={{
        uTop: { value: new THREE.Color('#292052') },
        uUpper: { value: new THREE.Color('#57417f') },
        uHorizon: { value: new THREE.Color('#c77fae') },
        uLower: { value: new THREE.Color('#7285c4') },
        uBottom: { value: new THREE.Color('#313f78') },
      }}
      vertexShader={`
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        uniform vec3 uTop;
        uniform vec3 uUpper;
        uniform vec3 uHorizon;
        uniform vec3 uLower;
        uniform vec3 uBottom;
        varying vec3 vDirection;

        void main() {
          float h = clamp(vDirection.y, -0.2, 0.8);
          float horizon = smoothstep(-0.08, 0.27, h);
          float upperSky = smoothstep(0.24, 0.67, h);
          vec3 lowerBand = mix(uBottom, uLower, horizon);
          vec3 upperBand = mix(uHorizon, uUpper, upperSky);
          vec3 sky = mix(lowerBand, upperBand, smoothstep(0.16, 0.38, h));
          sky = mix(sky, uTop, smoothstep(0.52, 0.78, h));

          float horizonGlow = exp(-pow((h - 0.16) * 4.2, 2.0));
          vec3 lavenderGlow = vec3(0.13, 0.07, 0.18) * horizonGlow;
          gl_FragColor = vec4(sky + lavenderGlow, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `}
    />
  </mesh>
);

const FloatingIslands: React.FC<{ quality: Quality }> = ({ quality }) => {
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const highlightRef = useRef<THREE.InstancedMesh>(null);
  const houseRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);

  const islands = useMemo(
    () => quality === 'low' ? ISLANDS.filter((_, index) => index % 2 === 0) : ISLANDS,
    [quality]
  );
  const houses = useMemo(() => islands.filter((_, index) => index % 3 === 1), [islands]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();

    islands.forEach((island, index) => {
      const [x, y, z] = island.position;
      const s = island.scale;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0.12 * (index % 2), index * 0.47, 0.08 * (index % 3));
      dummy.scale.set(1.55 * s, 0.72 * s, 1.28 * s);
      dummy.updateMatrix();
      rockRef.current?.setMatrixAt(index, dummy.matrix);
      rockRef.current?.setColorAt(index, new THREE.Color(index % 2 ? '#695d91' : '#79668f'));

      dummy.position.set(x, y + 0.39 * s, z);
      dummy.rotation.set(0, index * 0.31, 0);
      dummy.scale.set(1.32 * s, 0.26 * s, 1.10 * s);
      dummy.updateMatrix();
      grassRef.current?.setMatrixAt(index, dummy.matrix);
      grassRef.current?.setColorAt(index, new THREE.Color(island.topColor));

      dummy.position.set(x - 0.06 * s, y + 0.87 * s, z + 0.03 * s);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.15 * s, 0.72 * s, 0.15 * s);
      dummy.updateMatrix();
      trunkRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x - 0.04 * s, y + 1.58 * s, z + 0.02 * s);
      dummy.scale.set(0.68 * s, 0.72 * s, 0.66 * s);
      dummy.updateMatrix();
      canopyRef.current?.setMatrixAt(index, dummy.matrix);
      canopyRef.current?.setColorAt(index, new THREE.Color(island.canopyColor));

      dummy.position.set(x + 0.19 * s, y + 1.83 * s, z - 0.08 * s);
      dummy.scale.set(0.38 * s, 0.40 * s, 0.37 * s);
      dummy.updateMatrix();
      highlightRef.current?.setMatrixAt(index, dummy.matrix);

    });

    houses.forEach((island, index) => {
      const [x, y, z] = island.position;
      const s = island.scale;
      dummy.position.set(x - 0.65 * s, y + 0.84 * s, z + 0.25 * s);
      dummy.rotation.set(0, index * 0.8, 0);
      dummy.scale.set(0.48 * s, 0.42 * s, 0.42 * s);
      dummy.updateMatrix();
      houseRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x - 0.65 * s, y + 1.22 * s, z + 0.25 * s);
      dummy.scale.set(0.56 * s, 0.42 * s, 0.52 * s);
      dummy.updateMatrix();
      roofRef.current?.setMatrixAt(index, dummy.matrix);
    });

    const meshes = [
      [rockRef.current, islands.length],
      [grassRef.current, islands.length],
      [trunkRef.current, islands.length],
      [canopyRef.current, islands.length],
      [highlightRef.current, islands.length],
      [houseRef.current, islands.length],
      [roofRef.current, islands.length],
    ] as Array<[THREE.InstancedMesh | null, number]>;

    meshes.forEach(([mesh]) => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [houses, islands]);

  return (
    <group>
      <instancedMesh ref={rockRef} args={[undefined, undefined, islands.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={grassRef} args={[undefined, undefined, islands.length]} frustumCulled={false}>
        <cylinderGeometry args={[1.12, 1.26, 0.42, 8]} />
        <meshStandardMaterial roughness={0.94} />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, islands.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.08, 0.14, 1, 7]} />
        <meshStandardMaterial color="#79513f" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, islands.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.88} flatShading />
      </instancedMesh>
      <instancedMesh ref={highlightRef} args={[undefined, undefined, islands.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#a9ce79" roughness={0.88} flatShading />
      </instancedMesh>
      <instancedMesh ref={houseRef} args={[undefined, undefined, houses.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffe0b7" roughness={0.78} />
      </instancedMesh>
      <instancedMesh ref={roofRef} args={[undefined, undefined, houses.length]} frustumCulled={false}>
        <coneGeometry args={[0.72, 0.82, 4]} />
        <meshStandardMaterial color="#e8896e" roughness={0.72} />
      </instancedMesh>
    </group>
  );
};

const SkyClouds: React.FC<{ quality: Quality }> = ({ quality }) => {
  const cloudsRef = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => {
    const clusters = quality === 'low' ? CLOUD_CLUSTERS.filter((_, index) => index % 2 === 0) : CLOUD_CLUSTERS;
    return clusters.flatMap((cloud, clusterIndex) =>
      CLOUD_OFFSETS.map(([ox, oy, oz, radius], puffIndex) => ({
        position: [
          cloud.position[0] + ox * cloud.scale,
          cloud.position[1] + oy * cloud.scale,
          cloud.position[2] + oz * cloud.scale,
        ] as Vec3,
        radius: radius * cloud.scale,
        color: puffIndex % 3 === 0 ? cloud.tone : puffIndex % 3 === 1 ? '#fffaf8' : '#d9d5f5',
        seed: clusterIndex + puffIndex,
      }))
    );
  }, [quality]);

  useLayoutEffect(() => {
    if (!cloudsRef.current) return;
    const dummy = new THREE.Object3D();
    puffs.forEach((puff, index) => {
      dummy.position.set(...puff.position);
      dummy.scale.set(puff.radius * 1.18, puff.radius * 0.78, puff.radius);
      dummy.rotation.set(0.08 * (puff.seed % 3), 0.12 * (puff.seed % 5), 0);
      dummy.updateMatrix();
      cloudsRef.current?.setMatrixAt(index, dummy.matrix);
      cloudsRef.current?.setColorAt(index, new THREE.Color(puff.color));
    });
    cloudsRef.current.instanceMatrix.needsUpdate = true;
    if (cloudsRef.current.instanceColor) cloudsRef.current.instanceColor.needsUpdate = true;
  }, [puffs]);

  return (
    <instancedMesh ref={cloudsRef} args={[undefined, undefined, puffs.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 9]} />
      <meshStandardMaterial roughness={1} metalness={0} flatShading />
    </instancedMesh>
  );
};

const SkyLanterns: React.FC<{ quality: Quality }> = ({ quality }) => {
  const polesRef = useRef<THREE.InstancedMesh>(null);
  const lampsRef = useRef<THREE.InstancedMesh>(null);
  const capsRef = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(
    () => quality === 'low' ? LANTERNS.filter((_, index) => index % 2 === 0) : LANTERNS,
    [quality]
  );

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    positions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y + 1.0, z);
      dummy.scale.set(0.055, 1.75, 0.055);
      dummy.updateMatrix();
      polesRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, y + 2.0, z);
      dummy.rotation.set(0, Math.PI / 4, 0);
      dummy.scale.set(0.34, 0.42, 0.34);
      dummy.updateMatrix();
      lampsRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, y + 2.27, z);
      dummy.scale.set(0.23, 0.14, 0.23);
      dummy.updateMatrix();
      capsRef.current?.setMatrixAt(index, dummy.matrix);
    });
    [polesRef.current, lampsRef.current, capsRef.current].forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  }, [positions]);

  return (
    <group>
      <instancedMesh ref={polesRef} args={[undefined, undefined, positions.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 7]} />
        <meshStandardMaterial color="#73518d" roughness={0.62} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={lampsRef} args={[undefined, undefined, positions.length]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffc66d" emissive="#ffab4a" emissiveIntensity={1.2} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={capsRef} args={[undefined, undefined, positions.length]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial color="#9865a8" roughness={0.62} />
      </instancedMesh>
      {positions.filter((_, index) => index % 3 === 0).slice(0, quality === 'low' ? 1 : 3).map(([x, y, z], index) => (
        <pointLight key={index} position={[x, y + 2.1, z]} color="#ffbd70" intensity={0.42} distance={5.5} decay={2} />
      ))}
    </group>
  );
};

export const FantasySkyBackground: React.FC<{ quality?: Quality }> = ({ quality = 'balanced' }) => (
  <group>
    <SkyDome />
    <FloatingIslands quality={quality} />
    <SkyClouds quality={quality} />
  </group>
);

export default FantasySkyBackground;
