import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Quality = 'low' | 'balanced' | 'high';
type Vec3 = [number, number, number];

// Sky Dome with Dreamy Pastel Sunset Gradient (lavender, violet, golden sunset)
const SkyDome: React.FC = () => (
  <mesh scale={180} frustumCulled={false} renderOrder={-1000}>
    <sphereGeometry args={[1, 32, 24]} />
    <shaderMaterial
      side={THREE.BackSide}
      depthWrite={false}
      depthTest={false}
      uniforms={{
        uZenith: { value: new THREE.Color('#3b2874') },
        uUpperSky: { value: new THREE.Color('#674894') },
        uHorizonPink: { value: new THREE.Color('#f0a8c8') },
        uSunsetGold: { value: new THREE.Color('#ffd699') },
        uBottom: { value: new THREE.Color('#55407a') },
      }}
      vertexShader={`
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `}
      fragmentShader={`
        uniform vec3 uZenith;
        uniform vec3 uUpperSky;
        uniform vec3 uHorizonPink;
        uniform vec3 uSunsetGold;
        uniform vec3 uBottom;
        varying vec3 vWorldPosition;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float y = dir.y;

          // Multi-stop pastel fantasy sky gradient
          vec3 sky;
          if (y < 0.0) {
            sky = mix(uBottom, uSunsetGold, smoothstep(-0.25, 0.0, y));
          } else if (y < 0.18) {
            sky = mix(uSunsetGold, uHorizonPink, smoothstep(0.0, 0.18, y));
          } else if (y < 0.45) {
            sky = mix(uHorizonPink, uUpperSky, smoothstep(0.18, 0.45, y));
          } else {
            sky = mix(uUpperSky, uZenith, smoothstep(0.45, 0.9, y));
          }

          // Gentle warm atmospheric glow near the horizon center
          float horizonGlow = exp(-pow((y - 0.08) * 5.0, 2.0));
          sky += vec3(0.18, 0.10, 0.05) * horizonGlow;

          gl_FragColor = vec4(sky, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `}
    />
  </mesh>
);

// Floating Islands with Spired Castles visible in the horizon background
const ISLAND_CONFIGS: Array<{ position: Vec3; scale: number; rotY: number }> = [
  // Upper left background islands
  { position: [-21, 6.2, -18], scale: 1.25, rotY: 0.4 },
  { position: [-28, 9.8, -12], scale: 1.4, rotY: -0.2 },
  // Upper right background islands
  { position: [21, 6.8, -17], scale: 1.3, rotY: -0.5 },
  { position: [29, 10.2, -10], scale: 1.5, rotY: 0.3 },
  // Far distant accent islands
  { position: [-12, 11.5, -28], scale: 1.1, rotY: 0.8 },
  { position: [14, 12.0, -27], scale: 1.15, rotY: -0.6 },
];

const BackgroundIslands: React.FC<{ quality: Quality }> = () => {
  return (
    <group>
      {ISLAND_CONFIGS.map((island, idx) => (
        <group key={`bg-island-${idx}`} position={island.position} scale={island.scale} rotation={[0, island.rotY, 0]}>
          {/* Island Rock Plinth Base */}
          <mesh position={[0, -1.3, 0]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[3.2, 2.8, 8]} />
            <meshStandardMaterial color="#68568c" roughness={0.88} flatShading />
          </mesh>
          {/* Hanging moss under the island */}
          <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[2.8, 2.4, 0.6, 8]} />
            <meshStandardMaterial color="#554474" roughness={0.9} />
          </mesh>
          {/* Grassy Top Plateau */}
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[3.0, 3.2, 0.35, 12]} />
            <meshStandardMaterial color="#78ba4c" roughness={0.75} />
          </mesh>

          {/* Miniature Fantasy Castle on top */}
          <group position={[0, 0.25, 0]}>
            {/* Castle Keep */}
            <mesh position={[0, 0.9, 0]} castShadow>
              <boxGeometry args={[1.5, 1.4, 1.3]} />
              <meshStandardMaterial color="#f8edd8" roughness={0.6} />
            </mesh>
            {/* Castle Spires */}
            {[-0.65, 0.65].map((tx, tidx) => (
              <group key={`spire-${tidx}`} position={[tx, 0.7, 0]}>
                <mesh position={[0, 0.7, 0]} castShadow>
                  <cylinderGeometry args={[0.26, 0.3, 1.6, 12]} />
                  <meshStandardMaterial color="#fdf4e2" roughness={0.6} />
                </mesh>
                <mesh position={[0, 1.85, 0]} castShadow>
                  <coneGeometry args={[0.42, 0.95, 12]} />
                  <meshStandardMaterial color="#3672bf" roughness={0.3} metalness={0.1} />
                </mesh>
                {/* Spire Golden Finial */}
                <mesh position={[0, 2.4, 0]}>
                  <sphereGeometry args={[0.08, 8, 8]} />
                  <meshStandardMaterial color="#ffd54f" metalness={0.9} roughness={0.2} />
                </mesh>
              </group>
            ))}
            {/* Central Tower */}
            <mesh position={[0, 1.7, 0]} castShadow>
              <cylinderGeometry args={[0.32, 0.35, 1.2, 12]} />
              <meshStandardMaterial color="#f8edd8" roughness={0.6} />
            </mesh>
            <mesh position={[0, 2.55, 0]} castShadow>
              <coneGeometry args={[0.48, 1.1, 12]} />
              <meshStandardMaterial color="#3672bf" roughness={0.3} metalness={0.1} />
            </mesh>
          </group>

          {/* Miniature Trees on Island */}
          {[-1.6, 1.5, -0.2].map((treeX, treeIdx) => (
            <mesh key={`tree-${treeIdx}`} position={[treeX, 0.65, treeIdx === 2 ? 1.2 : 0.6]}>
              <sphereGeometry args={[0.55 + (treeIdx % 2) * 0.15, 8, 8]} />
              <meshStandardMaterial color={treeIdx % 2 === 0 ? '#ff9db6' : '#52b747'} roughness={0.7} />
            </mesh>
          ))}

          {/* Cascading Crystal Waterfall pouring off the cliff rim */}
          {(idx === 0 || idx === 2 || idx === 3) && (
            <group position={[1.2, 0, 0.4]}>
              <mesh position={[0, -2.2, 0]}>
                <cylinderGeometry args={[0.18, 0.34, 3.6, 8]} />
                <meshPhysicalMaterial
                  color="#67e8f9"
                  emissive="#0284c7"
                  emissiveIntensity={0.4}
                  transparent
                  opacity={0.8}
                  roughness={0.08}
                />
              </mesh>
              {/* Waterfall Splash Foam Cloud */}
              <mesh position={[0, -3.9, 0]}>
                <sphereGeometry args={[0.6, 8, 8]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.7} roughness={0.9} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
};

// Subtle magical rainbow arching across the horizon behind the central castle
const FantasyRainbow: React.FC = () => {
  return (
    <group position={[1.5, 5.0, -22]} rotation={[0, 0, 0.08]}>
      {[
        { r: 18.2, color: '#f87171' }, // Red
        { r: 17.8, color: '#fb923c' }, // Orange
        { r: 17.4, color: '#facc15' }, // Yellow
        { r: 17.0, color: '#4ade80' }, // Green
        { r: 16.6, color: '#38bdf8' }, // Cyan
        { r: 16.2, color: '#818cf8' }, // Indigo
        { r: 15.8, color: '#c084fc' }, // Violet
      ].map((band, bidx) => (
        <mesh key={`rainbow-${bidx}`}>
          <torusGeometry args={[band.r, 0.16, 6, 40, Math.PI * 0.72]} />
          <meshStandardMaterial
            color={band.color}
            transparent
            opacity={0.32}
            roughness={0.2}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};

// Whimsical Hot Air Balloon matching the concept art
const HotAirBalloon: React.FC = () => {
  const balloonRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (balloonRef.current) {
      balloonRef.current.position.y = 8.8 + Math.sin(t * 0.8) * 0.32;
      balloonRef.current.position.x = -0.5 + Math.cos(t * 0.4) * 0.25;
      balloonRef.current.rotation.y = Math.sin(t * 0.5) * 0.12;
    }
  });

  return (
    <group ref={balloonRef} position={[-0.5, 8.8, -16]} scale={1.25}>
      {/* Balloon Envelope Body */}
      <mesh position={[0, 1.4, 0]} scale={[1, 1.35, 1]}>
        <sphereGeometry args={[1.15, 24, 20]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.35} />
      </mesh>
      {/* Balloon White & Pink Stripe Bands */}
      <mesh position={[0, 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.12, 0.09, 8, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.88, 0.08, 8, 24]} />
        <meshStandardMaterial color="#f472b6" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.96, 0.08, 8, 24]} />
        <meshStandardMaterial color="#f472b6" roughness={0.3} />
      </mesh>
      {/* Lower Collar */}
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.42, 0.3, 0.38, 16]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>
      {/* Support Ropes */}
      {[-0.22, 0.22].map((rx, ri) => (
        <React.Fragment key={`rope-${ri}`}>
          <mesh position={[rx, -0.65, 0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[rx, -0.65, -0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
        </React.Fragment>
      ))}
      {/* Wicker Basket */}
      <mesh position={[0, -0.98, 0]} castShadow>
        <boxGeometry args={[0.46, 0.38, 0.46]} />
        <meshStandardMaterial color="#92400e" roughness={0.85} />
      </mesh>
    </group>
  );
};

// Soft Fluffy Background Clouds framing the board
const CLOUD_CONFIGS: Array<{ position: Vec3; scale: number }> = [
  // Horizon cloud clusters
  { position: [-17, 3.8, -15], scale: 2.1 },
  { position: [17, 4.0, -15], scale: 2.0 },
  { position: [-7, 5.8, -20], scale: 2.4 },
  { position: [8, 5.5, -19], scale: 2.3 },
  // Lateral background clouds
  { position: [-25, 7.5, -8], scale: 2.8 },
  { position: [26, 7.2, -7], scale: 2.7 },
  { position: [-22, 2.5, 6], scale: 2.2 },
  { position: [22, 2.2, 7], scale: 2.2 },
  // Foreground perimeter framing puffs (soft, out of way)
  { position: [-18, 0.2, 14], scale: 2.0 },
  { position: [18, 0.1, 14], scale: 2.0 },
];

const FluffyClouds: React.FC<{ quality: Quality }> = () => {
  return (
    <group>
      {CLOUD_CONFIGS.map((c, cidx) => (
        <group key={`cloud-${cidx}`} position={c.position} scale={c.scale}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[1.2, 12, 10]} />
            <meshStandardMaterial color="#fef5f9" roughness={0.92} flatShading />
          </mesh>
          <mesh position={[-0.85, -0.15, 0.2]}>
            <sphereGeometry args={[0.92, 10, 8]} />
            <meshStandardMaterial color="#fae4f2" roughness={0.92} flatShading />
          </mesh>
          <mesh position={[0.85, -0.12, -0.15]}>
            <sphereGeometry args={[0.95, 10, 8]} />
            <meshStandardMaterial color="#fff0f6" roughness={0.92} flatShading />
          </mesh>
          <mesh position={[0.2, 0.55, 0.1]}>
            <sphereGeometry args={[0.82, 10, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const FantasySkyBackground: React.FC<{ quality?: Quality }> = ({ quality = 'balanced' }) => (
  <group>
    <SkyDome />
    <FantasyRainbow />
    <BackgroundIslands quality={quality} />
    <HotAirBalloon />
    <FluffyClouds quality={quality} />
  </group>
);

export default FantasySkyBackground;
