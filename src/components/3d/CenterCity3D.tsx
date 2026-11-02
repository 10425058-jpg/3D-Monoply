import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type TreeProps = {
  position: [number, number, number];
  scale?: number;
  canopy?: string;
};

const Tree: React.FC<TreeProps> = ({ position, scale = 1, canopy = '#267b54' }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0.34, 0]}>
      <cylinderGeometry args={[0.07, 0.12, 0.68, 7]} />
      <meshStandardMaterial color="#65432f" roughness={0.92} />
    </mesh>
    <mesh position={[0, 0.82, 0]}>
      <dodecahedronGeometry args={[0.52, 0]} />
      <meshStandardMaterial color={canopy} roughness={0.86} />
    </mesh>
  </group>
);

const StreetLamp: React.FC<{ position: [number, number, number]; scale?: number }> = ({
  position,
  scale = 1,
}) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0.62, 0]} castShadow>
      <cylinderGeometry args={[0.035, 0.055, 1.24, 8]} />
      <meshStandardMaterial color="#303b4b" metalness={0.82} roughness={0.25} />
    </mesh>
    <mesh position={[0, 1.27, 0]} castShadow>
      <cylinderGeometry args={[0.12, 0.075, 0.13, 10]} />
      <meshStandardMaterial color="#b88a42" metalness={0.75} roughness={0.28} />
    </mesh>
    <mesh position={[0, 1.39, 0]} castShadow>
      <sphereGeometry args={[0.105, 12, 12]} />
      <meshStandardMaterial
        color="#ffe6a0"
        emissive="#ffbd55"
        emissiveIntensity={1.8}
        roughness={0.22}
      />
    </mesh>
  </group>
);

type BuildingProps = {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  floors: number;
  accent?: string;
  crown?: 'flat' | 'spire' | 'stepped';
};

const Building: React.FC<BuildingProps> = ({
  position,
  size,
  color,
  floors,
  accent = '#67c8f2',
  crown = 'flat',
}) => {
  const [width, height, depth] = size;
  const windowHeight = Math.min(0.16, height / (floors * 3.4));
  const windowWidth = Math.min(0.15, width / 5.4);
  const floorGap = height / (floors + 0.25);

  // Merge every lit window into one geometry per building to reduce draw calls.
  const windowGeometry = useMemo(() => {
    const positions: number[] = [];
    const addQuad = (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
      d: [number, number, number]
    ) => {
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    };

    for (let floor = 0; floor < floors; floor += 1) {
      const y = 0.3 + floor * floorGap;
      for (let column = 0; column < 3; column += 1) {
        const x = -width / 2 + ((column + 1) * width) / 4;
        const z = -depth / 2 + ((column + 1) * depth) / 4;
        const halfW = windowWidth / 2;
        const halfH = windowHeight / 2;
        const front = depth / 2 + 0.012;
        const back = -depth / 2 - 0.012;
        const right = width / 2 + 0.012;
        const left = -width / 2 - 0.012;

        addQuad(
          [x - halfW, y - halfH, front],
          [x + halfW, y - halfH, front],
          [x + halfW, y + halfH, front],
          [x - halfW, y + halfH, front]
        );
        addQuad(
          [x - halfW, y - halfH, back],
          [x + halfW, y - halfH, back],
          [x + halfW, y + halfH, back],
          [x - halfW, y + halfH, back]
        );
        addQuad(
          [right, y - halfH, z - halfW],
          [right, y - halfH, z + halfW],
          [right, y + halfH, z + halfW],
          [right, y + halfH, z - halfW]
        );
        addQuad(
          [left, y - halfH, z - halfW],
          [left, y - halfH, z + halfW],
          [left, y + halfH, z + halfW],
          [left, y + halfH, z - halfW]
        );
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [depth, floors, floorGap, height, width, windowHeight, windowWidth]);

  React.useEffect(() => () => windowGeometry.dispose(), [windowGeometry]);

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.55}
          roughness={0.28}
          clearcoat={0.8}
          clearcoatRoughness={0.18}
        />
      </mesh>
      <mesh geometry={windowGeometry}>
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.38}
          roughness={0.42}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, height + 0.035, 0]} castShadow>
        <boxGeometry args={[width + 0.12, 0.09, depth + 0.12]} />
        <meshStandardMaterial color="#9eafc2" metalness={0.72} roughness={0.23} />
      </mesh>
      {crown === 'stepped' && (
        <>
          <mesh position={[0, height + 0.24, 0]} castShadow>
            <boxGeometry args={[width * 0.72, 0.34, depth * 0.72]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.26} />
          </mesh>
          <mesh position={[0, height + 0.43, 0]}>
            <boxGeometry args={[width * 0.48, 0.06, depth * 0.48]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
      {crown === 'spire' && (
        <>
          <mesh position={[0, height + 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.23, 0.62, 8]} />
            <meshStandardMaterial color="#aabbd0" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, height + 0.88, 0]}>
            <cylinderGeometry args={[0.012, 0.035, 0.48, 8]} />
            <meshStandardMaterial color="#e8a36c" emissive="#e46d54" emissiveIntensity={0.55} />
          </mesh>
        </>
      )}
    </group>
  );
};

const ObservationTower: React.FC = () => (
  <group position={[-1.15, 0.48, -2.3]}>
    <mesh position={[0, 2.2, 0]} castShadow>
      <cylinderGeometry args={[0.12, 0.34, 4.4, 16]} />
      <meshStandardMaterial color="#b7c5d9" metalness={0.72} roughness={0.22} />
    </mesh>
    <mesh position={[0, 3.75, 0]} castShadow>
      <cylinderGeometry args={[0.38, 0.2, 0.55, 16]} />
      <meshStandardMaterial color="#263f64" metalness={0.8} roughness={0.18} />
    </mesh>
    <mesh position={[0, 4.1, 0]} castShadow>
      <cylinderGeometry args={[1.05, 0.78, 0.34, 32]} />
      <meshPhysicalMaterial color="#1b4671" metalness={0.8} roughness={0.18} clearcoat={1} />
    </mesh>
    <mesh position={[0, 4.31, 0]} castShadow>
      <torusGeometry args={[0.91, 0.045, 10, 48]} />
      <meshStandardMaterial color="#67d7f3" emissive="#178cc4" emissiveIntensity={0.75} metalness={0.65} />
    </mesh>
    <mesh position={[0, 4.55, 0]} castShadow>
      <cylinderGeometry args={[0.65, 0.9, 0.18, 32]} />
      <meshStandardMaterial color="#d9e5f1" metalness={0.75} roughness={0.2} />
    </mesh>
    <mesh position={[0, 5.3, 0]} castShadow>
      <cylinderGeometry args={[0.025, 0.055, 1.35, 8]} />
      <meshStandardMaterial color="#eb685c" emissive="#b9363d" emissiveIntensity={0.45} />
    </mesh>
    <mesh position={[0, 5.99, 0]}>
      <sphereGeometry args={[0.075, 12, 12]} />
      <meshStandardMaterial color="#ffcb76" emissive="#ff9e4a" emissiveIntensity={1.4} />
    </mesh>
    <pointLight position={[0, 4.1, 0]} color="#3fbbe8" intensity={1.4} distance={5} />
  </group>
);

const FerrisWheel: React.FC = () => {
  const wheelRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (wheelRef.current) wheelRef.current.rotation.z = clock.getElapsedTime() * 0.19;
  });

  const gondolas = Array.from({ length: 10 }).map((_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    return {
      key: i,
      position: [Math.cos(angle) * 1.34, Math.sin(angle) * 1.34, 0] as [number, number, number],
      color: ['#f7b84f', '#e66d78', '#54b9e7', '#8dcf92', '#d7a7ef'][i % 5],
    };
  });

  return (
    <group position={[-4.45, 0.45, 2.0]}>
      <mesh position={[-0.78, 1.12, 0]} rotation={[0, 0, 0.28]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 2.3, 8]} />
        <meshStandardMaterial color="#a9bacd" metalness={0.8} roughness={0.24} />
      </mesh>
      <mesh position={[0.78, 1.12, 0]} rotation={[0, 0, -0.28]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 2.3, 8]} />
        <meshStandardMaterial color="#a9bacd" metalness={0.8} roughness={0.24} />
      </mesh>
      <group ref={wheelRef} position={[0, 2.02, 0]}>
        <mesh>
          <torusGeometry args={[1.35, 0.055, 10, 48]} />
          <meshStandardMaterial color="#ef7b8e" metalness={0.55} roughness={0.25} emissive="#a82c64" emissiveIntensity={0.22} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.18, 0.022, 8, 48]} />
          <meshStandardMaterial color="#f8d38a" metalness={0.72} roughness={0.2} />
        </mesh>
        {Array.from({ length: 10 }).map((_, i) => {
          const angle = (i / 10) * Math.PI * 2;
          return (
            <mesh key={i} rotation={[0, 0, angle - Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 2.7, 7]} />
              <meshStandardMaterial color="#f3c16e" metalness={0.65} roughness={0.25} />
            </mesh>
          );
        })}
        {gondolas.map((gondola) => (
          <group key={gondola.key} position={gondola.position}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[0.28, 0.22, 0.22]} />
              <meshStandardMaterial color={gondola.color} metalness={0.32} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.04, 0]} castShadow>
              <boxGeometry args={[0.3, 0.06, 0.24]} />
              <meshStandardMaterial color="#e8edf4" metalness={0.55} roughness={0.2} />
            </mesh>
          </group>
        ))}
        <mesh>
          <cylinderGeometry args={[0.18, 0.18, 0.22, 16]} />
          <meshStandardMaterial color="#f7d27b" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[2.8, 0.24, 1.15]} />
        <meshStandardMaterial color="#35495e" metalness={0.45} roughness={0.32} />
      </mesh>
      <pointLight position={[0, 2.1, 0.35]} color="#ff7baf" intensity={0.8} distance={4} />
    </group>
  );
};

const RollerCoaster: React.FC = () => {
  const trainRef = useRef<THREE.Group>(null);
  const path = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-2.15, 0.55, 0.9),
          new THREE.Vector3(-1.85, 1.7, 0.55),
          new THREE.Vector3(-1.15, 3.0, -0.2),
          new THREE.Vector3(-0.2, 4.15, -0.8),
          new THREE.Vector3(0.85, 4.35, -0.75),
          new THREE.Vector3(1.75, 3.25, -0.15),
          new THREE.Vector3(2.18, 1.7, 0.6),
          new THREE.Vector3(2.1, 0.62, 1.1),
          new THREE.Vector3(1.1, 0.52, 1.55),
          new THREE.Vector3(-0.5, 0.58, 1.6),
          new THREE.Vector3(-2.15, 0.55, 0.9),
        ],
        false,
        'catmullrom',
        0.18
      ),
    []
  );
  const supportPoints = useMemo(() => path.getPoints(12).filter((_, index) => index % 3 === 0), [path]);

  useFrame(({ clock }) => {
    if (!trainRef.current) return;
    const progress = (clock.getElapsedTime() * 0.035) % 1;
    const point = path.getPointAt(progress);
    const ahead = path.getPointAt((progress + 0.008) % 1);
    trainRef.current.position.copy(point);
    trainRef.current.lookAt(ahead);
  });

  return (
    <group position={[4.45, 0.28, -3.35]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[5.9, 0.2, 3.7]} />
        <meshStandardMaterial color="#26364b" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <boxGeometry args={[5.65, 0.035, 3.45]} />
        <meshStandardMaterial color="#46576a" roughness={0.68} />
      </mesh>

      {/* Twin rails and cross ties */}
      <mesh>
        <tubeGeometry args={[path, 56, 0.055, 6, false]} />
        <meshStandardMaterial color="#d95b55" metalness={0.65} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0, 0.14]}>
        <tubeGeometry
          args={[
            new THREE.CatmullRomCurve3(path.getPoints(48).map((point) => new THREE.Vector3(point.x, point.y, point.z + 0.15))),
            56,
            0.045,
            6,
            false,
          ]}
        />
        <meshStandardMaterial color="#e7b46e" metalness={0.72} roughness={0.22} />
      </mesh>
      {supportPoints.map((point, index) => (
        <mesh key={index} position={[point.x, Math.max(0.12, point.y / 2), point.z]} castShadow>
          <cylinderGeometry args={[0.035, 0.055, Math.max(0.2, point.y), 7]} />
          <meshStandardMaterial color="#b94b4c" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}

      {/* Animated coaster train */}
      <group ref={trainRef}>
        {[0, 1, 2].map((car) => (
          <group key={car} position={[0, 0.12, car * 0.32]}>
            <mesh castShadow>
              <boxGeometry args={[0.38, 0.24, 0.42]} />
              <meshStandardMaterial color={car === 0 ? '#f4c35f' : '#e86b60'} metalness={0.35} roughness={0.24} />
            </mesh>
            <mesh position={[0, 0.16, -0.02]}>
              <boxGeometry args={[0.31, 0.13, 0.25]} />
              <meshStandardMaterial color="#26364c" metalness={0.6} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>
      <pointLight position={[0, 1.1, 0]} color="#f07860" intensity={0.65} distance={5} />
    </group>
  );
};

const CircusTent: React.FC = () => {
  const stripeCount = 12;
  return (
    <group position={[2.55, 0.38, 3.2]}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.34, 1.42, 0.28, 32]} />
        <meshStandardMaterial color="#8b4d4b" roughness={0.72} />
      </mesh>
      {Array.from({ length: stripeCount }).map((_, index) => {
        const angle = (index / stripeCount) * Math.PI * 2;
        return (
          <mesh key={index} position={[0, 0.98, 0]} rotation={[0, angle, 0]} castShadow>
            <cylinderGeometry args={[0.035, 1.31, 1.68, 1, 1, false, 0, (Math.PI * 2) / stripeCount]} />
            <meshStandardMaterial color={index % 2 === 0 ? '#d65b57' : '#f2e5d0'} roughness={0.65} />
          </mesh>
        );
      })}
      <mesh position={[0, 1.84, 0]} castShadow>
        <coneGeometry args={[0.16, 0.45, 12]} />
        <meshStandardMaterial color="#e8c77e" metalness={0.28} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.1, 0]} rotation={[0, 0, 0.12]}>
        <coneGeometry args={[0.035, 0.5, 6]} />
        <meshStandardMaterial color="#d95850" />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <torusGeometry args={[1.29, 0.035, 8, 36]} />
        <meshStandardMaterial color="#e7c27d" metalness={0.65} roughness={0.25} />
      </mesh>
      <pointLight position={[0, 0.9, 0]} color="#ffb86e" intensity={0.75} distance={3.8} />
    </group>
  );
};

const ParkIsland: React.FC = () => {
  const trees: Array<[number, number, number, string, number]> = [
    [-1.85, -1.7, 0.72, '#247a50', 0.88],
    [-0.6, -2.05, 0.8, '#3c9659', 0.95],
    [1.2, -1.72, 0.68, '#267650', 0.82],
    [2.0, -0.2, 0.66, '#2b8658', 0.8],
    [-2.0, 0.4, 0.78, '#3b8e51', 0.92],
    [-1.3, 1.85, 0.72, '#2c8050', 0.85],
    [1.5, 1.72, 0.78, '#3c9659', 0.92],
    [2.35, 1.05, 0.62, '#27784b', 0.78],
    [0.3, 2.15, 0.55, '#4b9e5b', 0.78],
    [-2.35, -0.8, 0.6, '#478f54', 0.76],
  ];

  return (
    <group position={[4.35, 0.12, 0.42]}>
      {/* Layered garden island */}
      <mesh position={[0, 0.02, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.18, 3.55, 0.48, 48]} />
        <meshStandardMaterial color="#bd9f65" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.28, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.02, 3.2, 0.34, 48]} />
        <meshStandardMaterial color="#3b9c68" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <torusGeometry args={[2.88, 0.055, 8, 64]} />
        <meshStandardMaterial color="#a9e6ac" emissive="#4fae77" emissiveIntensity={0.16} />
      </mesh>

      {/* Winding paved paths */}
      <mesh position={[-0.2, 0.47, 0.45]} rotation={[0, 0, 0]}>
        <torusGeometry args={[1.35, 0.16, 5, 48]} />
        <meshStandardMaterial color="#d7c7a2" roughness={0.86} />
      </mesh>
      <mesh position={[0.05, 0.49, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshStandardMaterial color="#4fba79" roughness={0.8} />
      </mesh>

      {/* Small central pavilion */}
      <group position={[0.55, 0.48, 0.3]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.95, 0.5, 0.72]} />
          <meshStandardMaterial color="#d8e5e8" roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.58, 0]} castShadow>
          <coneGeometry args={[0.72, 0.48, 4]} />
          <meshStandardMaterial color="#327fc1" metalness={0.25} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.25, 0.37]}>
          <boxGeometry args={[0.28, 0.33, 0.025]} />
          <meshStandardMaterial color="#19324b" emissive="#24527b" emissiveIntensity={0.2} />
        </mesh>
      </group>

      {trees.map(([x, z, scale, color, _], index) => (
        <Tree key={index} position={[x, 0.45, z]} scale={scale} canopy={color} />
      ))}

      {/* Flower beds and benches */}
      {[
        [-1.25, 0.55, 0.45],
        [1.65, 0.48, 0.2],
        [0.1, 0.5, -1.75],
      ].map(([x, y, z], index) => (
        <group key={index} position={[x, y, z]}>
          <mesh>
            <cylinderGeometry args={[0.22, 0.25, 0.1, 12]} />
            <meshStandardMaterial color="#6b6747" />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <sphereGeometry args={[0.12, 10, 10]} />
            <meshStandardMaterial color={index % 2 === 0 ? '#f2b5a1' : '#e8d178'} />
          </mesh>
        </group>
      ))}
      <group position={[-0.8, 0.52, 1.05]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 0.13, 0]} castShadow>
          <boxGeometry args={[0.75, 0.08, 0.18]} />
          <meshStandardMaterial color="#7e4c33" />
        </mesh>
        <mesh position={[-0.28, 0.03, 0]}>
          <boxGeometry args={[0.06, 0.26, 0.18]} />
          <meshStandardMaterial color="#343e4b" />
        </mesh>
        <mesh position={[0.28, 0.03, 0]}>
          <boxGeometry args={[0.06, 0.26, 0.18]} />
          <meshStandardMaterial color="#343e4b" />
        </mesh>
      </group>
      <StreetLamp position={[-2.55, 0.48, 0.25]} scale={0.75} />
      <StreetLamp position={[1.95, 0.48, 1.7]} scale={0.75} />
    </group>
  );
};

export const CenterCity3D: React.FC = () => {
  const boatRef = useRef<THREE.Group>(null);

  const buildings: BuildingProps[] = [
    { position: [-3.55, 0.47, -1.55], size: [0.95, 3.65, 0.92], color: '#294b6c', floors: 8, accent: '#74d2f2', crown: 'spire' },
    { position: [-2.25, 0.47, -2.5], size: [0.94, 4.6, 0.95], color: '#315e87', floors: 10, accent: '#f5ce86', crown: 'stepped' },
    { position: [-0.15, 0.47, -2.2], size: [0.9, 3.7, 0.88], color: '#263e62', floors: 9, accent: '#8ac8fb', crown: 'flat' },
    { position: [-3.65, 0.47, 0.05], size: [0.82, 2.75, 0.82], color: '#85614c', floors: 6, accent: '#ffd18c', crown: 'flat' },
    { position: [-2.35, 0.47, 0.18], size: [1.02, 3.15, 0.92], color: '#53637a', floors: 7, accent: '#b9e7f4', crown: 'stepped' },
    { position: [-0.95, 0.47, -0.72], size: [0.9, 2.95, 0.84], color: '#364f70', floors: 7, accent: '#ffd48b', crown: 'spire' },
    { position: [0.35, 0.47, -1.0], size: [0.75, 2.45, 0.78], color: '#47566b', floors: 6, accent: '#8bd5e7', crown: 'flat' },
    { position: [-1.65, 0.47, 1.45], size: [0.86, 2.2, 0.78], color: '#526175', floors: 5, accent: '#ffd08b', crown: 'flat' },
  ];

  useFrame(({ clock }) => {
    if (boatRef.current) {
      const time = clock.getElapsedTime();
      boatRef.current.position.x = 1.7 + Math.sin(time * 0.42) * 0.4;
      boatRef.current.position.z = 4.75 + Math.cos(time * 0.42) * 0.24;
      boatRef.current.rotation.y = Math.sin(time * 0.42) * 0.12;
    }
  });

  return (
    <group position={[0, 0.1, 0]}>
      {/* Deep teal lagoon with a layered island edge */}
      <mesh position={[0, -0.015, 0]} receiveShadow>
        <boxGeometry args={[16.15, 0.18, 16.15]} />
        <meshPhysicalMaterial color="#123e52" roughness={0.27} metalness={0.45} clearcoat={1} clearcoatRoughness={0.16} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[15.92, 0.025, 15.92]} />
        <meshStandardMaterial color="#176077" roughness={0.34} metalness={0.34} />
      </mesh>

      {/* Downtown district raised plaza */}
      <mesh position={[-1.65, 0.23, -0.72]} receiveShadow castShadow>
        <boxGeometry args={[7.75, 0.38, 7.4]} />
        <meshStandardMaterial color="#26384c" roughness={0.68} metalness={0.22} />
      </mesh>
      <mesh position={[-1.65, 0.435, -0.72]} receiveShadow>
        <boxGeometry args={[7.5, 0.045, 7.15]} />
        <meshStandardMaterial color="#344a5d" roughness={0.75} />
      </mesh>

      {/* Road grid and lane markings */}
      {[-4.55, -2.95, -1.35, 0.25].map((x, index) => (
        <mesh key={index} position={[x, 0.465, -0.72]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.035, 6.7]} />
          <meshBasicMaterial color="#d3b76e" transparent opacity={0.72} />
        </mesh>
      ))}
      {[-3.7, -1.95, -0.2, 1.35].map((z, index) => (
        <mesh key={index} position={[-1.65, 0.466, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.15, 0.035]} />
          <meshBasicMaterial color="#d3b76e" transparent opacity={0.62} />
        </mesh>
      ))}

      {/* Central city buildings */}
      {buildings.map((building, index) => (
        <Building key={index} {...building} />
      ))}
      <ObservationTower />

      {/* Rooftop details: vents and aerials */}
      {[
        [-3.5, 4.2, -1.55],
        [-2.2, 5.15, -2.5],
        [-0.15, 4.22, -2.2],
        [-3.65, 3.2, 0.05],
      ].map(([x, y, z], index) => (
        <group key={index} position={[x, y, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.23, 0.2, 0.2]} />
            <meshStandardMaterial color="#8fa5b7" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.12, 0.22, 0]}>
            <cylinderGeometry args={[0.012, 0.025, 0.36, 6]} />
            <meshStandardMaterial color="#d7b76e" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Waterfront promenade and bridge to the park */}
      <group position={[1.72, 0.48, 0.05]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.16, 0.86]} />
          <meshStandardMaterial color="#b7c0c4" roughness={0.5} />
        </mesh>
        {[-0.34, 0.34].map((z, index) => (
          <mesh key={index} position={[0, 0.24, z]} castShadow>
            <boxGeometry args={[2.55, 0.04, 0.045]} />
            <meshStandardMaterial color="#d9b66b" metalness={0.65} roughness={0.25} />
          </mesh>
        ))}
        {[-1.05, 1.05].map((x, index) => (
          <mesh key={index} position={[x, 0.12, 0]} castShadow>
            <boxGeometry args={[0.07, 0.38, 0.75]} />
            <meshStandardMaterial color="#60788b" metalness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Scenic amusement district */}
      <FerrisWheel />
      <RollerCoaster />
      <ParkIsland />
      <CircusTent />

      {/* Small waterfront houses, kiosks and boats */}
      <group position={[-4.2, 0.42, -3.55]}>
        <mesh position={[0, 0.38, 0]} castShadow>
          <boxGeometry args={[0.92, 0.75, 0.82]} />
          <meshStandardMaterial color="#bb8668" roughness={0.66} />
        </mesh>
        <mesh position={[0, 0.88, 0]}>
          <coneGeometry args={[0.72, 0.58, 4]} />
          <meshStandardMaterial color="#48566d" roughness={0.52} />
        </mesh>
        <mesh position={[0.18, 0.34, 0.42]}>
          <boxGeometry args={[0.2, 0.34, 0.025]} />
          <meshStandardMaterial color="#1d3750" emissive="#24567d" emissiveIntensity={0.22} />
        </mesh>
      </group>
      <group ref={boatRef} position={[1.7, 0.28, 4.75]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.38, 0.95, 4]} />
          <meshStandardMaterial color="#eee7d9" metalness={0.3} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.48, 0.2, 0.35]} />
          <meshStandardMaterial color="#d55e54" roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <coneGeometry args={[0.12, 0.34, 4]} />
          <meshStandardMaterial color="#f1e8d7" />
        </mesh>
      </group>

      {/* Detail lighting around the city edges */}
      <StreetLamp position={[-5.4, 0.13, -0.2]} scale={0.82} />
      <StreetLamp position={[-4.2, 0.13, 4.1]} scale={0.82} />
      <StreetLamp position={[0.8, 0.13, 4.9]} scale={0.82} />
      <StreetLamp position={[6.75, 0.13, -0.1]} scale={0.82} />

      {/* Small clusters of decorative shrubs */}
      {[
        [-5.3, 0.22, -2.2],
        [-5.0, 0.22, 1.0],
        [1.0, 0.22, -5.1],
        [6.3, 0.22, 3.1],
        [-0.5, 0.22, 5.8],
      ].map(([x, y, z], index) => (
        <group key={index} position={[x, y, z]}>
          <mesh castShadow>
            <sphereGeometry args={[0.28, 10, 10]} />
            <meshStandardMaterial color="#2c8057" roughness={0.86} />
          </mesh>
          <mesh position={[0.2, -0.02, 0.12]} castShadow>
            <sphereGeometry args={[0.2, 10, 10]} />
            <meshStandardMaterial color="#3e9a64" roughness={0.86} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export default CenterCity3D;
