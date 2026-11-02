import React, { useLayoutEffect, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';

type Pos = [number, number, number];
const GOLD = '#ffd36c';
const CREAM = '#fff0d8';

const Island: React.FC<{position: Pos; size: [number, number, number]; top?: string; cliff?: string; rotation?: number}> = ({
  position, size, top = '#9fe15c', cliff = '#8272bd', rotation = 0,
}) => (
  <group position={position} rotation={[0, rotation, 0]}>
    <RoundedBox args={size} radius={0.26} smoothness={5} castShadow receiveShadow>
      <meshStandardMaterial color={cliff} roughness={0.72} />
    </RoundedBox>
    <RoundedBox
      args={[size[0] - 0.12, 0.2, size[2] - 0.12]}
      radius={0.22}
      smoothness={5}
      position={[0, size[1] * 0.48 + 0.08, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={top} roughness={0.88} />
    </RoundedBox>
    <mesh position={[0, size[1] * 0.48 + 0.19, 0]}>
      <boxGeometry args={[size[0] - 0.48, 0.018, 0.035]} />
      <meshBasicMaterial color="#c8f17c" />
    </mesh>
  </group>
);

type TreeLayout = { position: Pos; scale: number; tone: string };

const TREE_LAYOUT: TreeLayout[] = [
  { position: [-6.25, 1.31, -2.0], scale: 0.74, tone: '#57b34b' },
  { position: [-5.9, 1.31, 0.0], scale: 0.82, tone: '#69c34e' },
  { position: [-2.75, 1.61, -4.3], scale: 0.8, tone: '#65bb4a' },
  { position: [1.25, 1.61, -4.45], scale: 0.72, tone: '#75c84e' },
  { position: [5.0, 1.37, -2.95], scale: 0.84, tone: '#62ba4b' },
  { position: [5.9, 1.26, 1.6], scale: 0.88, tone: '#72c64b' },
  { position: [3.85, 1.24, 4.15], scale: 0.72, tone: '#65b94c' },
  { position: [-1.0, 0.98, 4.9], scale: 0.76, tone: '#67c14e' },
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

      dummy.position.set(x, y + 0.83 * tree.scale, z);
      dummy.updateMatrix();
      canopies.current?.setMatrixAt(index, dummy.matrix);
      canopies.current?.setColorAt(index, new THREE.Color(tree.tone));

      dummy.position.set(x + 0.22 * tree.scale, y + 1.0 * tree.scale, z + 0.08 * tree.scale);
      dummy.scale.setScalar(tree.scale * 0.56);
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
      <instancedMesh ref={canopies} args={[undefined, undefined, TREE_LAYOUT.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[0.48, 1]} />
        <meshStandardMaterial vertexColors roughness={0.82} />
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
        <meshStandardMaterial vertexColors roughness={0.65} />
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
  useFrame(({ clock }) => {
    if (!ref.current) return;
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
  useFrame(({ clock }) => {
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

export const CenterCity3D: React.FC = () => {
  const players = useGameStore((state) => state.players);
  const boatRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!boatRef.current) return;
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

      {/* Multi-level floating grass islands. */}
      <Island position={[-1.0, 1.06, -2.65]} size={[5.35, 0.76, 5.05]} top="#9fe15c" cliff="#7c70bd" />
      <Island position={[-5.05, 0.78, -1.1]} size={[3.55, 0.72, 3.6]} top="#a6e968" cliff="#8374c2" rotation={-0.08} />
      <Island position={[3.55, 0.83, -1.45]} size={[4.35, 0.74, 3.7]} top="#a5e55c" cliff="#8c79c5" rotation={0.04} />
      <Island position={[-3.8, 0.72, 3.15]} size={[4.0, 0.64, 3.25]} top="#b1e967" cliff="#7e72bd" rotation={-0.06} />
      <Island position={[1.9, 0.74, 3.12]} size={[4.15, 0.66, 3.45]} top="#b4ed69" cliff="#8d7bc5" rotation={0.04} />
      <Island position={[5.65, 0.68, 3.25]} size={[2.5, 0.58, 3.1]} top="#a8e65f" cliff="#8a79bd" rotation={-0.05} />

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

      {/* Market stalls, planted beds and fruit trees bring scale to the village. */}
      <MarketStall position={[0.0, 1.24, 4.0]} color="#8e8bdd" />
      <MarketStall position={[1.35, 1.24, 4.15]} color="#ef8467" />
      <OrchardInstances />

      {/* Trees scattered around the house lanes. */}
      <TreeInstances />

      {/* A little blue fountain and arched bridges connect the districts. */}
      <Fountain />
      <Bridge position={[2.55, 1.22, 1.28]} rotation={0.32} length={2.55} />
      <Bridge position={[-2.72, 1.18, 1.05]} rotation={-0.28} length={2.3} />
      <CannonFort position={[-5.55, 1.21, 3.3]} />

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

      {/* Puffy clouds and floating crystals make the city feel magical, not gothic. */}
      <CloudInstances />
      <mesh position={[0.1, 5.4, -2.2]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshPhysicalMaterial color="#64eaff" emissive="#2ccfff" emissiveIntensity={1.2} roughness={0.12} />
      </mesh>
      <pointLight position={[0, 4.9, -2.0]} color="#74eeff" intensity={1.1} distance={8} />
    </group>
  );
};

export default CenterCity3D;
