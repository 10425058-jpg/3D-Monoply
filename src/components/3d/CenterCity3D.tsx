import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';

type Pos = [number, number, number];
const GOLD = '#ffd36c';
const CREAM = '#fff0d8';

const Island: React.FC<{position: Pos; size: [number, number, number]; top?: string; cliff?: string; rotation?: number}> = ({
  position, size, top = '#9fe15c', cliff = '#8272bd', rotation = 0,
}) => {
  const [width, height, depth] = size;
  const shape = useMemo(() => {
    const outline = new THREE.Shape();
    const segments = 16;
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const wave = 1 + 0.075 * Math.sin(angle * 3 + rotation * 5) + 0.035 * Math.cos(angle * 5 - rotation * 3);
      const x = Math.cos(angle) * width * 0.5 * wave;
      const z = Math.sin(angle) * depth * 0.5 * wave;
      if (index === 0) outline.moveTo(x, -z);
      else outline.lineTo(x, -z);
    }
    outline.closePath();
    return outline;
  }, [width, depth, rotation]);
  const cliffGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height * 0.72,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.075,
      bevelThickness: 0.075,
      curveSegments: 5,
    });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [shape, height]);
  const grassGeometry = useMemo(() => {
    const geometry = new THREE.ShapeGeometry(shape, 8);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [shape]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={cliffGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={cliff} roughness={0.78} />
      </mesh>
      <mesh geometry={grassGeometry} position={[0, height * 0.72 + 0.09, 0]} receiveShadow>
        <meshStandardMaterial color={top} roughness={0.9} />
      </mesh>
    </group>
  );
};

type TreeLayout = { position: Pos; scale: number; tone: string };

const TREE_LAYOUT: TreeLayout[] = [
  { position: [-5.85, 1.31, -2.6], scale: 0.66, tone: '#55ad4b' },
  { position: [-5.9, 1.31, 0.1], scale: 0.78, tone: '#69c34e' },
  { position: [-4.65, 1.31, 2.0], scale: 0.64, tone: '#78c64f' },
  { position: [-3.25, 1.31, -4.55], scale: 0.68, tone: '#62b84b' },
  { position: [-2.8, 1.31, 4.75], scale: 0.68, tone: '#70bd4d' },
  { position: [-1.8, 1.31, 0.2], scale: 0.54, tone: '#8acb57' },
  { position: [1.85, 1.31, -4.45], scale: 0.62, tone: '#6aba50' },
  { position: [3.4, 1.31, -3.15], scale: 0.75, tone: '#62b34b' },
  { position: [5.4, 1.31, -2.8], scale: 0.7, tone: '#75c34e' },
  { position: [5.7, 1.31, 0.2], scale: 0.8, tone: '#5db34a' },
  { position: [5.2, 1.31, 3.3], scale: 0.7, tone: '#77c850' },
  { position: [3.7, 1.31, 4.7], scale: 0.6, tone: '#64b74b' },
  { position: [1.7, 1.31, 4.55], scale: 0.62, tone: '#82c957' },
  { position: [-4.8, 1.31, -0.3], scale: 0.55, tone: '#7acb55' },
  { position: [2.7, 1.31, -0.3], scale: 0.56, tone: '#6fbd4a' },
  { position: [-0.2, 1.31, 4.95], scale: 0.6, tone: '#5fb24a' },
];

const TreeInstances: React.FC = () => {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopies = useRef<THREE.InstancedMesh>(null);
  const highlights = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    TREE_LAYOUT.forEach((tree, index) => {
      const [x, y, z] = tree.position;
      dummy.position.set(x, y + 0.32 * tree.scale, z);
      dummy.scale.setScalar(tree.scale);
      dummy.updateMatrix();
      trunks.current?.setMatrixAt(index, dummy.matrix);

      const canopyOffsets: Array<[number, number, number, number, string]> = [
        [0, 0.82, 0, 0.52, tree.tone],
        [-0.30, 0.70, 0.10, 0.34, '#86c95b'],
        [0.29, 0.72, -0.08, 0.33, '#4fa747'],
      ];
      canopyOffsets.forEach(([ox, oy, oz, size, tint], canopyIndex) => {
        const instanceIndex = index * 3 + canopyIndex;
        dummy.position.set(x + ox * tree.scale, y + oy * tree.scale, z + oz * tree.scale);
        dummy.scale.set(size * tree.scale, size * tree.scale * 0.92, size * tree.scale);
        dummy.rotation.set(0, (index + canopyIndex) * 0.31, 0);
        dummy.updateMatrix();
        canopies.current?.setMatrixAt(instanceIndex, dummy.matrix);
        canopies.current?.setColorAt(instanceIndex, new THREE.Color(tint));
      });

      dummy.position.set(x + 0.18 * tree.scale, y + 1.02 * tree.scale, z + 0.1 * tree.scale);
      dummy.scale.setScalar(tree.scale * 0.33);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      highlights.current?.setMatrixAt(index, dummy.matrix);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (canopies.current) {
      canopies.current.instanceMatrix.needsUpdate = true;
      if (canopies.current.instanceColor) canopies.current.instanceColor.needsUpdate = true;
    }
    if (highlights.current) highlights.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, TREE_LAYOUT.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.075, 0.13, 0.64, 7]} />
        <meshStandardMaterial color="#996044" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[undefined, undefined, TREE_LAYOUT.length * 3]} frustumCulled={false}>
        <dodecahedronGeometry args={[0.48, 1]} />
        <meshStandardMaterial roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={highlights} args={[undefined, undefined, TREE_LAYOUT.length]} frustumCulled={false}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial color="#c1ed73" roughness={0.78} />
      </instancedMesh>
    </>
  );
};

type CloudLayout = { position: Pos; scale: number };
const CLOUD_LAYOUT: CloudLayout[] = [
  { position: [-4.3, 5.7, -4.3], scale: 0.82 },
  { position: [2.5, 5.9, -4.6], scale: 0.9 },
  { position: [5.3, 5.1, 0.6], scale: 0.6 },
];
const CLOUD_PUFFS: Array<{ position: Pos; radius: number }> = CLOUD_LAYOUT.flatMap((cloud) =>
  [
    [-0.45, 0, 0, 0.52], [0, 0.17, 0, 0.68],
    [0.48, 0.02, 0.04, 0.48], [0.18, -0.13, 0.22, 0.42],
  ].map(([x, y, z, radius]) => ({
    position: [
      cloud.position[0] + x * cloud.scale,
      cloud.position[1] + y * cloud.scale,
      cloud.position[2] + z * cloud.scale,
    ] as Pos,
    radius: radius * cloud.scale,
  }))
);

const CloudInstances: React.FC = () => {
  const clouds = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!clouds.current) return;
    const dummy = new THREE.Object3D();
    CLOUD_PUFFS.forEach((puff, index) => {
      dummy.position.set(...puff.position);
      dummy.scale.setScalar(puff.radius);
      dummy.updateMatrix();
      clouds.current?.setMatrixAt(index, dummy.matrix);
    });
    clouds.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={clouds} args={[undefined, undefined, CLOUD_PUFFS.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshStandardMaterial color="#fff5f1" roughness={0.96} />
    </instancedMesh>
  );
};

const OrchardInstances: React.FC = () => {
  const pots = useRef<THREE.InstancedMesh>(null);
  const fruits = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const positions = [-4.85, -4.1, -3.35].flatMap((x) =>
    [-0.32, 0.18, 0.68].map((z) => [x, 1.21, 4.05 + z] as Pos)
  );

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    positions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y + 0.16, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pots.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, y + 0.34, z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      fruits.current?.setMatrixAt(index, dummy.matrix);
      fruits.current?.setColorAt(index, new THREE.Color(index % 2 ? '#f36d52' : '#ef9d42'));

      dummy.position.set(x + 0.02, y + 0.46, z);
      dummy.updateMatrix();
      leaves.current?.setMatrixAt(index, dummy.matrix);
    });
    if (pots.current) pots.current.instanceMatrix.needsUpdate = true;
    if (fruits.current) {
      fruits.current.instanceMatrix.needsUpdate = true;
      if (fruits.current.instanceColor) fruits.current.instanceColor.needsUpdate = true;
    }
    if (leaves.current) leaves.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={pots} args={[undefined, undefined, positions.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.15, 0.18, 0.28, 8]} />
        <meshStandardMaterial color="#d86e4d" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={fruits} args={[undefined, undefined, positions.length]} frustumCulled={false}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial roughness={0.65} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, positions.length]} frustumCulled={false}>
        <coneGeometry args={[0.11, 0.18, 5]} />
        <meshStandardMaterial color="#66b75d" />
      </instancedMesh>
    </>
  );
};

const House: React.FC<{position: Pos; roof?: string; wall?: string; scale?: number; awning?: boolean}> = ({
  position, roof = '#f17c61', wall = '#ffe4bd', scale = 1, awning = false,
}) => (
  <group position={position} scale={scale}>
    <RoundedBox args={[1.0, 0.86, 0.86]} radius={0.12} smoothness={4} position={[0, 0.48, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={wall} roughness={0.72} />
    </RoundedBox>
    <mesh position={[0, 1.08, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[0.82, 0.76, 4]} />
      <meshStandardMaterial color={roof} roughness={0.56} />
    </mesh>
    <mesh position={[0, 0.34, 0.438]}>
      <boxGeometry args={[0.25, 0.54, 0.035]} />
      <meshStandardMaterial color="#a65d4e" roughness={0.65} />
    </mesh>
    <mesh position={[-0.27, 0.57, 0.45]}>
      <boxGeometry args={[0.2, 0.2, 0.035]} />
      <meshPhysicalMaterial color="#75d8ed" roughness={0.18} metalness={0.18} clearcoat={1} />
    </mesh>
    <mesh position={[0.27, 0.57, 0.45]}>
      <boxGeometry args={[0.2, 0.2, 0.035]} />
      <meshPhysicalMaterial color="#75d8ed" roughness={0.18} metalness={0.18} clearcoat={1} />
    </mesh>
    {awning && (
      <group position={[0, 0.86, 0.56]}>
        <mesh rotation={[-0.17, 0, 0]}>
          <boxGeometry args={[1.18, 0.12, 0.66]} />
          <meshStandardMaterial color={roof} roughness={0.6} />
        </mesh>
        {[-0.36, -0.12, 0.12, 0.36].map((x, i) => (
          <mesh key={i} position={[x, 0.012, 0.01]} rotation={[-0.17, 0, 0]}>
            <boxGeometry args={[0.12, 0.125, 0.67]} />
            <meshStandardMaterial color={i % 2 ? '#fff4e6' : roof} roughness={0.58} />
          </mesh>
        ))}
      </group>
    )}
    <mesh position={[0, 1.47, 0]}>
      <sphereGeometry args={[0.07, 10, 10]} />
      <meshStandardMaterial color={GOLD} metalness={0.35} roughness={0.25} />
    </mesh>
  </group>
);

const Crystal: React.FC<{position: Pos}> = ({ position }) => {
  const ref = useRef<THREE.Group>(null);
  const lastUpdate = useRef(0);
  useFrame(({ clock }) => {
    if (!ref.current || clock.elapsedTime - lastUpdate.current < 1 / 30) return;
    lastUpdate.current = clock.elapsedTime;
    ref.current.rotation.y = clock.elapsedTime * 0.7;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.7) * 0.12;
  });
  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <octahedronGeometry args={[0.43, 0]} />
        <meshPhysicalMaterial color="#60e8ff" emissive="#22cfff" emissiveIntensity={1.2} metalness={0.1} roughness={0.12} transmission={0.12} thickness={0.5} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshPhysicalMaterial color="#b2f8ff" emissive="#4ee8ff" emissiveIntensity={1.3} roughness={0.12} />
      </mesh>
      <pointLight color="#52eaff" intensity={1.2} distance={5} />
    </group>
  );
};

const Castle: React.FC = () => (
  <group position={[-0.9, 1.61, -2.28]}>
    <RoundedBox args={[2.65, 2.25, 2.35]} radius={0.16} smoothness={5} position={[0, 1.18, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#f8d6b8" roughness={0.66} />
    </RoundedBox>
    <mesh position={[0, 1.1, 1.19]}>
      <boxGeometry args={[0.55, 1.55, 0.06]} />
      <meshStandardMaterial color="#b95f58" roughness={0.64} />
    </mesh>
    <mesh position={[0, 0.53, 1.24]}>
      <boxGeometry args={[0.54, 0.88, 0.08]} />
      <meshStandardMaterial color="#985249" roughness={0.7} />
    </mesh>
    {[[-1.02, 2.12, -0.88], [1.02, 2.12, -0.88], [-1.02, 2.12, 0.88], [1.02, 2.12, 0.88]].map((p, i) => (
      <group key={i} position={p as Pos}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.42, 1.5, 8]} />
          <meshStandardMaterial color={i % 2 ? '#f6cba5' : '#f5d9bd'} roughness={0.68} />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow>
          <coneGeometry args={[0.53, 0.75, 4]} />
          <meshStandardMaterial color={i % 2 ? '#ee8066' : '#8b82d2'} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.84, 0]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.2} />
        </mesh>
      </group>
    ))}
    <mesh position={[0, 2.58, 0]}>
      <boxGeometry args={[1.55, 0.32, 1.4]} />
      <meshStandardMaterial color="#f7d3b3" roughness={0.6} />
    </mesh>
    <mesh position={[0, 2.82, 0]}>
      <coneGeometry args={[0.82, 0.92, 4]} />
      <meshStandardMaterial color="#ed8068" roughness={0.52} />
    </mesh>
    <mesh position={[0, 3.35, 0]}>
      <cylinderGeometry args={[0.12, 0.12, 0.55, 8]} />
      <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.2} />
    </mesh>
    <Crystal position={[0, 3.82, 0]} />
    <mesh position={[0, 2.2, 1.2]}>
      <boxGeometry args={[0.16, 0.78, 0.035]} />
      <meshStandardMaterial color="#ffc65f" emissive="#ffc65f" emissiveIntensity={0.15} />
    </mesh>
  </group>
);

const Fountain: React.FC = () => {
  const waterRef = useRef<THREE.Mesh>(null);
  const lastUpdate = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastUpdate.current < 1 / 30) return;
    lastUpdate.current = clock.elapsedTime;
    if (waterRef.current) {
      waterRef.current.position.y = 0.66 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
      waterRef.current.scale.y = 0.85 + Math.sin(clock.elapsedTime * 2.2) * 0.18;
    }
  });
  return (
    <group position={[0.7, 0.72, 0.95]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.48, 40]} />
        <meshPhysicalMaterial color="#34c9ed" metalness={0.22} roughness={0.14} clearcoat={1} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[1.48, 1.55, 0.23, 40]} />
        <meshStandardMaterial color="#e9d4df" roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.29, 0]}>
        <torusGeometry args={[1.32, 0.11, 10, 40]} />
        <meshStandardMaterial color="#83d8f0" metalness={0.3} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.48, 0.62, 0.3, 24]} />
        <meshStandardMaterial color="#fff0d8" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <torusGeometry args={[0.47, 0.08, 8, 24]} />
        <meshStandardMaterial color={GOLD} metalness={0.55} roughness={0.22} />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.09, 0.16, 0.76, 12]} />
        <meshStandardMaterial color="#87f4ff" emissive="#46dfff" emissiveIntensity={0.75} transparent opacity={0.82} />
      </mesh>
      <pointLight position={[0, 1.0, 0]} color="#69eaff" intensity={0.65} distance={4} />
    </group>
  );
};

const Bridge: React.FC<{position: Pos; rotation?: number; length?: number}> = ({
  position, rotation = 0, length = 2.5,
}) => (
  <group position={position} rotation={[0, rotation, 0]}>
    <RoundedBox args={[length, 0.22, 0.72]} radius={0.12} smoothness={4} position={[0, 0.12, 0]} castShadow>
      <meshStandardMaterial color="#d99562" roughness={0.68} />
    </RoundedBox>
    {[-1, 1].map((side) => (
      <React.Fragment key={side}>
        <mesh position={[0, 0.46, side * 0.32]}>
          <boxGeometry args={[length - 0.12, 0.08, 0.09]} />
          <meshStandardMaterial color="#f7c58c" roughness={0.55} />
        </mesh>
        {[-0.42, 0.42].map((x) => (
          <mesh key={x} position={[x * (length / 2.1), 0.29, side * 0.32]}>
            <cylinderGeometry args={[0.045, 0.055, 0.35, 8]} />
            <meshStandardMaterial color="#b66b4f" roughness={0.72} />
          </mesh>
        ))}
      </React.Fragment>
    ))}
  </group>
);

const LandmarkTower: React.FC<{position: Pos; color: string; level: number}> = ({ position, color, level }) => (
  <group position={position}>
    {Array.from({ length: level }).map((_, index) => (
      <group key={index} position={[0, index * 0.62, 0]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.72 + index * 0.12, 0.62, 0.72 + index * 0.12]} />
          <meshStandardMaterial color={color} roughness={0.38} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.66, 0]}>
          <coneGeometry args={[0.56 + index * 0.08, 0.42, 4]} />
          <meshStandardMaterial color="#ffe0a0" roughness={0.5} />
        </mesh>
      </group>
    ))}
  </group>
);

const CannonFort: React.FC<{position: Pos}> = ({ position }) => (
  <group position={position} rotation={[0, -0.35, 0]}>
    <mesh position={[0, 0.22, 0]} castShadow>
      <cylinderGeometry args={[0.76, 0.92, 0.42, 12]} />
      <meshStandardMaterial color="#d9c4dc" roughness={0.74} />
    </mesh>
    <mesh position={[0, 0.64, 0]} castShadow>
      <cylinderGeometry args={[0.55, 0.62, 0.48, 12]} />
      <meshStandardMaterial color="#edb29c" roughness={0.62} />
    </mesh>
    <mesh position={[0, 1.05, 0.14]} rotation={[Math.PI / 2.5, 0, 0]} castShadow>
      <cylinderGeometry args={[0.22, 0.31, 1.15, 16]} />
      <meshStandardMaterial color="#8373a8" metalness={0.42} roughness={0.28} />
    </mesh>
    <mesh position={[0, 0.62, 0.34]}>
      <boxGeometry args={[0.18, 0.45, 0.07]} />
      <meshStandardMaterial color="#e65f5d" />
    </mesh>
  </group>
);

const MarketStall: React.FC<{position: Pos; color: string}> = ({ position, color }) => (
  <group position={position}>
    <mesh position={[0, 0.38, 0]} castShadow>
      <boxGeometry args={[0.82, 0.68, 0.7]} />
      <meshStandardMaterial color="#cf906a" roughness={0.68} />
    </mesh>
    <mesh position={[0, 0.82, 0]}>
      <boxGeometry args={[1.08, 0.12, 0.92]} />
      <meshStandardMaterial color={color} roughness={0.54} />
    </mesh>
    {[-0.3, 0, 0.3].map((x, i) => (
      <mesh key={i} position={[x, 0.83, 0.01]}>
        <boxGeometry args={[0.12, 0.125, 0.93]} />
        <meshStandardMaterial color={i % 2 ? CREAM : color} roughness={0.54} />
      </mesh>
    ))}
  </group>
);

const PATH_ROUTES: Array<{ points: Pos[]; elevation: number }> = [
  {
    elevation: 1.72,
    points: [
      [-5.1, 0, -4.35], [-4.3, 0, -4.0], [-3.25, 0, -3.95],
      [-2.1, 0, -4.15], [-0.95, 0, -4.45], [0.4, 0, -4.35],
      [1.7, 0, -3.95], [3.0, 0, -3.4], [4.45, 0, -2.75],
    ],
  },
  {
    elevation: 1.43,
    points: [
      [-5.2, 0, -0.6], [-5.45, 0, 0.6], [-5.0, 0, 1.85],
      [-4.3, 0, 2.9], [-3.35, 0, 3.8], [-2.0, 0, 4.2],
    ],
  },
  {
    elevation: 1.38,
    points: [
      [-3.3, 0, 4.55], [-2.1, 0, 4.68], [-0.7, 0, 4.62],
      [0.85, 0, 4.45], [2.25, 0, 4.0], [3.45, 0, 3.35],
      [4.35, 0, 2.35],
    ],
  },
  {
    elevation: 1.50,
    points: [
      [4.65, 0, -2.3], [5.1, 0, -1.1], [5.25, 0, 0.2],
      [5.05, 0, 1.3], [4.45, 0, 2.35],
    ],
  },
];

const CityPaths: React.FC = () => {
  const routes = useMemo(() => PATH_ROUTES.map(({ points, elevation }) => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return {
      geometry: new THREE.TubeGeometry(curve, 56, 0.42, 8, false),
      elevation,
    };
  }), []);

  return (
    <group>
      {routes.map((route, index) => (
        <mesh
          key={index}
          geometry={route.geometry}
          position={[0, route.elevation, 0]}
          scale={[1, 0.13, 1]}
          receiveShadow
        >
          <meshStandardMaterial
            color={index % 2 === 0 ? '#ead4b5' : '#f5e3c8'}
            roughness={0.95}
          />
        </mesh>
      ))}
    </group>
  );
};

const FlowerGarden: React.FC = () => {
  const planters = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const blooms = useRef<THREE.InstancedMesh>(null);
  const leafClumps = useRef<THREE.InstancedMesh>(null);
  const beds = useMemo(() => [
    { x: -2.75, z: -1.0, rotation: 0.22 },
    { x: 2.45, z: -0.65, rotation: -0.28 },
    { x: -1.25, z: 3.0, rotation: -0.18 },
    { x: 3.3, z: 2.65, rotation: 0.32 },
  ], []);
  const flowers = useMemo(() => beds.flatMap((bed, bedIndex) =>
    Array.from({ length: 5 }, (_, index) => ({
      x: bed.x + (index - 2) * 0.24,
      z: bed.z + Math.sin(index * 1.8 + bedIndex) * 0.18,
      color: ['#f58a77', '#ffd36c', '#9b8cdb', '#f6a3c5', '#fff0d8'][(index + bedIndex) % 5],
    }))
  ), [beds]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    beds.forEach((bed, index) => {
      dummy.position.set(bed.x, 1.38, bed.z);
      dummy.rotation.set(0, bed.rotation, 0);
      dummy.scale.set(1.48, 0.12, 0.62);
      dummy.updateMatrix();
      planters.current?.setMatrixAt(index, dummy.matrix);
    });
    flowers.forEach((flower, index) => {
      dummy.position.set(flower.x, 1.58, flower.z);
      dummy.rotation.set(0, 0, index * 0.2);
      dummy.scale.set(0.045, 0.36, 0.045);
      dummy.updateMatrix();
      stems.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(flower.x, 1.80, flower.z);
      dummy.scale.setScalar(0.13);
      dummy.updateMatrix();
      blooms.current?.setMatrixAt(index, dummy.matrix);
      blooms.current?.setColorAt(index, new THREE.Color(flower.color));

      dummy.position.set(flower.x - 0.13, 1.51, flower.z + 0.05);
      dummy.scale.set(0.18, 0.07, 0.10);
      dummy.updateMatrix();
      leafClumps.current?.setMatrixAt(index, dummy.matrix);
    });
    [planters.current, stems.current, blooms.current, leafClumps.current].forEach((mesh) => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [beds, flowers]);

  return (
    <group>
      <instancedMesh ref={planters} args={[undefined, undefined, beds.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#b98268" roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={stems} args={[undefined, undefined, flowers.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial color="#5a9f4f" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={blooms} args={[undefined, undefined, flowers.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={leafClumps} args={[undefined, undefined, flowers.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 7, 6]} />
        <meshStandardMaterial color="#74bb57" roughness={0.88} />
      </instancedMesh>
    </group>
  );
};

const CityLamp: React.FC<{ position: Pos }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.12, 0]} castShadow>
      <cylinderGeometry args={[0.18, 0.22, 0.24, 10]} />
      <meshStandardMaterial color="#a87969" roughness={0.72} />
    </mesh>
    <mesh position={[0, 0.92, 0]} castShadow>
      <cylinderGeometry args={[0.055, 0.075, 1.48, 8]} />
      <meshStandardMaterial color="#805b72" metalness={0.32} roughness={0.48} />
    </mesh>
    <mesh position={[0, 1.72, 0]}>
      <octahedronGeometry args={[0.22, 0]} />
      <meshStandardMaterial color="#ffe49b" emissive="#ffbd60" emissiveIntensity={1.1} roughness={0.28} />
    </mesh>
    <mesh position={[0, 1.91, 0]}>
      <coneGeometry args={[0.2, 0.16, 6]} />
      <meshStandardMaterial color="#bd7b6b" roughness={0.58} />
    </mesh>
    <pointLight position={[0, 1.72, 0]} color="#ffd58c" intensity={0.28} distance={3.5} decay={2} />
  </group>
);

const TownDock: React.FC = () => (
  <group position={[4.85, 0.84, 5.38]} rotation={[0, -0.12, 0]}>
    {[-0.62, -0.22, 0.18, 0.58].map((x) => (
      <mesh key={x} position={[x, 0.08, 0]} castShadow>
        <boxGeometry args={[0.34, 0.16, 1.45]} />
        <meshStandardMaterial color="#bd8056" roughness={0.76} />
      </mesh>
    ))}
    {[-0.52, 0.52].map((x) => (
      <mesh key={x} position={[x, -0.08, 0.58]}>
        <cylinderGeometry args={[0.08, 0.1, 0.55, 8]} />
        <meshStandardMaterial color="#8b5b47" roughness={0.82} />
      </mesh>
    ))}
  </group>
);

export const CenterCity3D: React.FC = () => {
  const players = useGameStore((state) => state.players);
  const boatRef = useRef<THREE.Group>(null);
  const lastBoatUpdate = useRef(0);

  useFrame(({ clock }) => {
    if (!boatRef.current || clock.elapsedTime - lastBoatUpdate.current < 1 / 30) return;
    lastBoatUpdate.current = clock.elapsedTime;
    const t = clock.elapsedTime;
    boatRef.current.position.x = 3.0 + Math.sin(t * 0.42) * 0.24;
    boatRef.current.position.y = 0.78 + Math.sin(t * 1.5) * 0.06;
    boatRef.current.rotation.y = -0.3 + Math.sin(t * 0.42) * 0.08;
  });

  const landmarkPlots: Pos[] = [
    [-6.25, 1.02, -5.45], [-6.2, 0.92, 5.35], [6.15, 0.92, -5.3], [6.0, 0.92, 5.3],
  ];

  return (
    <group>
      {/* Turquoise lagoon foundation with visible channels between raised green landforms. */}
      <RoundedBox args={[15.7, 0.52, 15.7]} radius={0.45} smoothness={6} position={[0, 0.46, 0]} receiveShadow castShadow>
        <meshPhysicalMaterial color="#42c5e6" roughness={0.22} metalness={0.16} clearcoat={1} clearcoatRoughness={0.12} />
      </RoundedBox>

      {/* Organic, connected land districts replace the old rectangular grass slabs. */}
      <Island position={[0, 0.72, 0.15]} size={[12.2, 0.68, 10.6]} top="#80c966" cliff="#796ab0" rotation={0.015} />
      <Island position={[-1.0, 1.04, -2.65]} size={[5.35, 0.72, 5.05]} top="#a9e96b" cliff="#8c78c0" />
      <Island position={[-5.05, 0.78, -1.1]} size={[3.55, 0.68, 3.6]} top="#a4e66b" cliff="#8574bd" rotation={-0.08} />
      <Island position={[3.55, 0.83, -1.45]} size={[4.35, 0.70, 3.7]} top="#a5e76a" cliff="#917bc2" rotation={0.04} />
      <Island position={[-3.8, 0.72, 3.15]} size={[4.0, 0.60, 3.25]} top="#b2e975" cliff="#8171b8" rotation={-0.06} />
      <Island position={[1.9, 0.74, 3.12]} size={[4.15, 0.62, 3.45]} top="#b4ed73" cliff="#8d7bc5" rotation={0.04} />

      <CityPaths />

      {/* Castle district. */}
      <Castle />
      <House position={[-5.0, 1.31, -1.65]} roof="#8b84d8" wall="#f7d9c3" scale={0.82} />
      <House position={[-4.0, 1.31, -0.55]} roof="#ee7962" wall="#fff0d5" scale={0.78} awning />
      <House position={[2.85, 1.37, -2.1]} roof="#8c80d5" wall="#ffdfbd" scale={0.86} />
      <House position={[4.2, 1.37, -1.0]} roof="#eb795e" wall="#f9e4cc" scale={0.82} awning />
      <House position={[-4.7, 1.21, 2.45]} roof="#ee7961" wall="#fff0d5" scale={0.75} awning />
      <House position={[-3.45, 1.21, 3.6]} roof="#9686dc" wall="#f7dfc7" scale={0.72} />
      <House position={[1.0, 1.24, 2.72]} roof="#ee8664" wall="#fff0d5" scale={0.73} awning />
      <House position={[2.5, 1.24, 3.48]} roof="#f17c5e" wall="#ffdfbd" scale={0.75} />
      <House position={[-2.55, 1.26, -3.75]} roof="#e98a65" wall="#ffead0" scale={0.66} />
      <House position={[4.75, 1.18, 1.7]} roof="#8b84d8" wall="#f8ddc5" scale={0.68} />
      <House position={[0.15, 1.20, 4.55]} roof="#f18b68" wall="#fff0d5" scale={0.62} />
      <House position={[-5.15, 1.22, -3.25]} roof="#f08a62" wall="#fff0d5" scale={0.58} awning />
      <House position={[-3.55, 1.22, -4.65]} roof="#8d83d6" wall="#f8dfc5" scale={0.57} />
      <House position={[3.55, 1.22, -3.75]} roof="#ee805f" wall="#fff0d5" scale={0.62} awning />
      <House position={[5.15, 1.18, 0.85]} roof="#9684d8" wall="#ffe3c5" scale={0.58} />
      <House position={[3.85, 1.18, 4.8]} roof="#ed8669" wall="#fff0d5" scale={0.56} />

      {/* A compact market street and orchard make the town read as one place. */}
      <MarketStall position={[-1.05, 1.24, 4.0]} color="#8e8bdd" />
      <MarketStall position={[0.25, 1.24, 4.18]} color="#ef8467" />
      <MarketStall position={[1.55, 1.24, 4.1]} color="#f2b15f" />
      <MarketStall position={[5.0, 1.17, 2.6]} color="#e87c69" />
      <MarketStall position={[-4.5, 1.18, 1.35]} color="#f0ad5d" />
      <MarketStall position={[3.8, 1.18, 0.8]} color="#8d88d7" />
      <OrchardInstances />
      <FlowerGarden />

      {/* Trees scattered around the house lanes. */}
      <TreeInstances />

      {/* A little blue fountain and arched bridges connect the districts. */}
      <Fountain />
      <Bridge position={[2.55, 1.22, 1.28]} rotation={0.32} length={2.55} />
      <Bridge position={[-2.72, 1.18, 1.05]} rotation={-0.28} length={2.3} />
      <CannonFort position={[-5.55, 1.21, 3.3]} />
      <CityLamp position={[-6.05, 1.12, -0.55]} />
      <CityLamp position={[-2.65, 1.16, -5.05]} />
      <CityLamp position={[5.8, 1.12, -1.75]} />
      <CityLamp position={[-4.85, 1.0, 5.0]} />
      <CityLamp position={[4.35, 1.0, 4.15]} />

      {/* A small timber dock gives the boat a clear harbor context. */}
      <TownDock />

      {/* A toy sailing boat gently rocks through the front-right channel. */}
      <group ref={boatRef} position={[3, 0.78, 5.25]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.36, 1.05, 4]} />
          <meshStandardMaterial color="#fff0d8" roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[0.38, 0.22, 0.34]} />
          <meshStandardMaterial color="#e76b5e" roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.68, 0]}>
          <coneGeometry args={[0.26, 0.48, 3]} />
          <meshStandardMaterial color="#fff7e9" roughness={0.52} />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.018, 0.025, 0.78, 6]} />
          <meshStandardMaterial color="#a76a50" />
        </mesh>
      </group>

      {/* Live player landmark upgrades remain visible on the outer terraces. */}
      {players.map((player, index) => player.landmarkLevel > 0 ? (
        <LandmarkTower key={player.id} position={landmarkPlots[index % landmarkPlots.length]} color={player.color} level={player.landmarkLevel} />
      ) : null)}

      {/* The sky clouds are kept outside the city silhouette so they never cover buildings. */}
      <mesh position={[0.1, 5.4, -2.2]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshPhysicalMaterial color="#64eaff" emissive="#2ccfff" emissiveIntensity={1.2} roughness={0.12} />
      </mesh>
      <pointLight position={[0, 4.9, -2.0]} color="#74eeff" intensity={1.1} distance={8} />
    </group>
  );
};

export default CenterCity3D;
