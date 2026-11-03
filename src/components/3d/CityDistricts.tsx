import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ROOF_TERRACOTTA = '#e0533c';
const ROOF_TEAL = '#1e7b85';
const ROOF_PURPLE = '#704284';
const WALL_CREAM = '#fff8ee';
const WALL_WARM = '#fdeecd';
const WALL_BRICK = '#eb9078';
const STONE_PAVEMENT = '#eddcc4';
const STONE_BALUSTRADE = '#f4e9db';
const WATER_TURQUOISE = '#14b8a6';
const SAKURA_PINK_LIGHT = '#ffaec9';
const SAKURA_PINK_MID = '#f472b6';
const SAKURA_PINK_DEEP = '#ec4899';
const GOLD_ACCENT = '#facc15';
const WOOD_DECK = '#ab784e';
const WOOD_DARK = '#78350f';

export const CityDistricts: React.FC = () => {
  const boatRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (boatRef.current) {
      boatRef.current.position.y = 0.28 + Math.sin(t * 1.6) * 0.02;
      boatRef.current.rotation.z = Math.sin(t * 1.4) * 0.04;
      boatRef.current.rotation.x = Math.cos(t * 1.1) * 0.03;
    }
  });

  return (
    <group>
      {/* 1. CENTRAL PLAZA & FOUNTAIN */}
      <group position={[0, 0.32, -0.2]}>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[2.0, 2.05, 0.06, 32]} />
          <meshStandardMaterial color={STONE_PAVEMENT} roughness={0.7} />
        </mesh>

        <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.35, 1.42, 0.2, 32]} />
          <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <torusGeometry args={[1.38, 0.06, 12, 32]} />
          <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.4} />
        </mesh>

        <mesh position={[0, 0.21, 0]}>
          <cylinderGeometry args={[1.28, 1.28, 0.04, 32]} />
          <meshPhysicalMaterial
            color={WATER_TURQUOISE}
            roughness={0.06}
            metalness={0.1}
            transmission={0.65}
            ior={1.33}
            clearcoat={1}
          />
        </mesh>

        <mesh position={[0, 0.38, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.38, 0.36, 16]} />
          <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.5} />
        </mesh>

        <mesh position={[0, 0.58, 0]} castShadow>
          <cylinderGeometry args={[0.72, 0.62, 0.14, 24]} />
          <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.66, 0]}>
          <cylinderGeometry args={[0.66, 0.66, 0.03, 24]} />
          <meshPhysicalMaterial color={WATER_TURQUOISE} roughness={0.06} transmission={0.6} clearcoat={1} />
        </mesh>

        <mesh position={[0, 0.82, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.24, 0.38, 16]} />
          <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.08, 0.14, 0.45, 12]} />
          <meshStandardMaterial color="#bae6fd" transparent opacity={0.85} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.34, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.9} roughness={0.1} />
        </mesh>
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, jidx) => (
          <group key={`jet-${jidx}`} rotation={[0, angle, 0]}>
            <mesh position={[0.48, 0.6, 0]} rotation={[0, 0, -Math.PI / 4]}>
              <cylinderGeometry args={[0.035, 0.05, 0.6, 8]} />
              <meshStandardMaterial color="#e0f2fe" transparent opacity={0.75} roughness={0.1} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 2. CANAL & HARBOR */}
      <group position={[0, 0.26, 2.2]}>
        <mesh ref={waterRef} position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[13.6, 0.06, 2.6]} />
          <meshPhysicalMaterial
            color={WATER_TURQUOISE}
            roughness={0.05}
            metalness={0.12}
            transmission={0.7}
            ior={1.333}
            clearcoat={1}
            clearcoatRoughness={0.08}
          />
        </mesh>

        <mesh position={[0, 0.06, -1.35]} receiveShadow>
          <boxGeometry args={[13.8, 0.1, 0.16]} />
          <meshStandardMaterial color={STONE_PAVEMENT} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.06, 1.35]} receiveShadow>
          <boxGeometry args={[13.8, 0.1, 0.16]} />
          <meshStandardMaterial color={STONE_PAVEMENT} roughness={0.7} />
        </mesh>

        <group position={[-3.6, 0.08, 0]}>
          <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.16, 2.9]} />
            <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.6, 0.6, 1.65, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.6} />
          </mesh>
          {[-0.75, 0.75].map((bx, bi) => (
            <mesh key={`bridge-w-rail-${bi}`} position={[bx, 0.32, 0]} castShadow>
              <boxGeometry args={[0.1, 0.18, 2.8]} />
              <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.5} />
            </mesh>
          ))}
        </group>

        <group position={[3.6, 0.08, 0]}>
          <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.16, 2.9]} />
            <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.6, 0.6, 1.65, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.6} />
          </mesh>
          {[-0.75, 0.75].map((bx, bi) => (
            <mesh key={`bridge-e-rail-${bi}`} position={[bx, 0.32, 0]} castShadow>
              <boxGeometry args={[0.1, 0.18, 2.8]} />
              <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.5} />
            </mesh>
          ))}
        </group>

        <group position={[1.8, 0.06, 0.6]}>
          <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.08, 1.4]} />
            <meshStandardMaterial color={WOOD_DECK} roughness={0.8} />
          </mesh>
          {[-0.52, 0.52].map((px, pi) => (
            <mesh key={`post-${pi}`} position={[px, 0.14, 0.62]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.32, 8]} />
              <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
            </mesh>
          ))}
        </group>

        <group ref={boatRef} position={[-0.8, 0.02, 0.1]} rotation={[0, 0.25, 0]}>
          <mesh position={[0, 0.04, 0]} castShadow>
            <boxGeometry args={[0.42, 0.16, 1.1]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.125, 0]}>
            <boxGeometry args={[0.36, 0.02, 0.98]} />
            <meshStandardMaterial color="#d4a373" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.72, 0.05]} castShadow>
            <cylinderGeometry args={[0.025, 0.03, 1.25, 8]} />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.75, -0.22]} rotation={[0, 0.1, 0]} castShadow>
            <coneGeometry args={[0.36, 0.95, 3]} />
            <meshStandardMaterial color="#fefefe" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.65, 0.28]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[0.22, 0.7, 3]} />
            <meshStandardMaterial color="#fefefe" roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* 3. RESIDENTIAL CAFE DISTRICT */}
      <group position={[-4.5, 0.34, -0.4]}>
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 1.4, 2.2]} />
            <meshStandardMaterial color={WALL_CREAM} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.85, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.3, 0.9, 2.1]} />
            <meshStandardMaterial color={WALL_WARM} roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.65, 0]} rotation={[0, 0, 0]} castShadow>
            <coneGeometry args={[1.8, 1.1, 4]} />
            <meshStandardMaterial color={ROOF_TERRACOTTA} roughness={0.4} />
          </mesh>
          <mesh position={[0.7, 2.8, -0.4]} castShadow>
            <boxGeometry args={[0.32, 0.9, 0.32]} />
            <meshStandardMaterial color={WALL_BRICK} roughness={0.7} />
          </mesh>

          <mesh position={[0, 1.15, 1.2]} rotation={[0.3, 0, 0]} castShadow>
            <boxGeometry args={[2.1, 0.12, 0.65]} />
            <meshStandardMaterial color="#be185d" roughness={0.4} />
          </mesh>
          {[-0.6, 0, 0.6].map((sx, si) => (
            <mesh key={`awning-s-${si}`} position={[sx, 1.17, 1.2]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.22, 0.13, 0.66]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
          ))}

          {[-0.6, 0.6].map((wx, wi) => (
            <group key={`win-box-${wi}`} position={[wx, 1.7, 1.08]}>
              <mesh castShadow>
                <boxGeometry args={[0.42, 0.5, 0.05]} />
                <meshStandardMaterial color="#38bdf8" roughness={0.2} />
              </mesh>
              <mesh position={[0, -0.3, 0.08]} castShadow>
                <boxGeometry args={[0.48, 0.14, 0.14]} />
                <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
              </mesh>
              <mesh position={[0, -0.22, 0.09]}>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color="#f472b6" roughness={0.6} />
              </mesh>
            </group>
          ))}
        </group>

        <group position={[0.4, 0.02, 1.8]}>
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[2.4, 0.04, 1.8]} />
            <meshStandardMaterial color={STONE_PAVEMENT} roughness={0.75} />
          </mesh>

          {[-0.65, 0.65].map((ux, ui) => (
            <group key={`parasol-${ui}`} position={[ux, 0, ui === 0 ? 0.35 : -0.25]} rotation={[0, ui * 0.4, 0.08]}>
              <mesh position={[0, 0.65, 0]} castShadow>
                <cylinderGeometry args={[0.025, 0.025, 1.3, 8]} />
                <meshStandardMaterial color={WOOD_DARK} roughness={0.6} />
              </mesh>
              <mesh position={[0, 1.25, 0]} castShadow>
                <coneGeometry args={[0.65, 0.35, 12]} />
                <meshStandardMaterial color="#f43f5e" roughness={0.35} />
              </mesh>
              <mesh position={[0, 1.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.64, 0.03, 8, 16]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, 0.32, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.22, 0.04, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={0.3} />
              </mesh>
              {[-0.26, 0.26].map((cx, ci) => (
                <mesh key={`chair-${ci}`} position={[cx, 0.18, 0]} castShadow>
                  <boxGeometry args={[0.12, 0.22, 0.12]} />
                  <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      </group>

      {/* 4. COMMERCIAL DISTRICT & BANK */}
      <group position={[4.6, 0.34, -0.4]}>
        <group position={[0, 0, 0]}>
          <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.5, 2.0, 2.2]} />
            <meshStandardMaterial color={WALL_CREAM} roughness={0.5} />
          </mesh>

          <mesh position={[0, 2.45, 0.2]} rotation={[0, 0, 0]} castShadow>
            <coneGeometry args={[1.9, 0.9, 4]} />
            <meshStandardMaterial color={ROOF_TERRACOTTA} roughness={0.4} />
          </mesh>

          <group position={[0, 2.95, 0.6]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.1, 24]} />
              <meshPhysicalMaterial
                color={GOLD_ACCENT}
                metalness={0.95}
                roughness={0.15}
                clearcoat={1}
                emissive="#f59e0b"
                emissiveIntensity={0.2}
              />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <boxGeometry args={[0.08, 0.58, 0.04]} />
              <meshStandardMaterial color="#78350f" metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.12, 0.06]}>
              <boxGeometry args={[0.26, 0.07, 0.04]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
            <mesh position={[0, -0.12, 0.06]}>
              <boxGeometry args={[0.26, 0.07, 0.04]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
          </group>

          {[-0.9, -0.3, 0.3, 0.9].map((colX, cIdx) => (
            <mesh key={`col-${cIdx}`} position={[colX, 0.95, 1.15]} castShadow>
              <cylinderGeometry args={[0.1, 0.12, 1.9, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
          ))}

          {[0, 1, 2].map((stepIdx) => (
            <mesh key={`bstep-${stepIdx}`} position={[0, 0.04 * (3 - stepIdx), 1.25 + stepIdx * 0.16]} receiveShadow>
              <boxGeometry args={[2.3, 0.06, 0.18]} />
              <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.6} />
            </mesh>
          ))}
        </group>

        <group position={[-0.4, 0.02, 1.8]}>
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.7, 1.1]} />
            <meshStandardMaterial color={WALL_WARM} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.85, 0.2]} rotation={[0.25, 0, 0]} castShadow>
            <boxGeometry args={[1.7, 0.1, 0.9]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.4} />
          </mesh>
          {[-0.45, 0.45].map((cx, ci) => (
            <mesh key={`canopy-s-${ci}`} position={[cx, 0.87, 0.2]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[0.28, 0.11, 0.92]} />
              <meshStandardMaterial color="#ef4444" roughness={0.4} />
            </mesh>
          ))}
        </group>
      </group>

      {/* 5. GARDEN PAVILION & SAKURA */}
      <group position={[2.6, 0.34, 0.6]}>
        <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[1.1, 1.15, 0.12, 24]} />
          <meshStandardMaterial color={STONE_BALUSTRADE} roughness={0.5} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const angle = (idx * Math.PI * 2) / 6;
          const gx = Math.cos(angle) * 0.82;
          const gz = Math.sin(angle) * 0.82;
          return (
            <mesh key={`gaz-col-${idx}`} position={[gx, 0.72, gz]} castShadow>
              <cylinderGeometry args={[0.06, 0.07, 1.2, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.92, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial
            color={ROOF_TEAL}
            metalness={0.3}
            roughness={0.25}
            clearcoat={0.8}
          />
        </mesh>
        <mesh position={[0, 2.58, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {[
        { position: [-2.4, 0.36, -2.2], scale: 1.15 },
        { position: [2.4, 0.36, -2.2], scale: 1.15 },
        { position: [-1.8, 0.32, 0.4], scale: 0.95 },
        { position: [4.4, 0.32, 1.4], scale: 0.9 },
        { position: [-6.2, 0.32, -0.6], scale: 1.0 },
      ].map((tree, tidx) => (
        <group key={`sakura-${tidx}`} position={tree.position as any} scale={tree.scale}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.22, 1.0, 8]} />
            <meshStandardMaterial color="#6b4423" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.35, 0]} castShadow>
            <sphereGeometry args={[0.78, 12, 12]} />
            <meshStandardMaterial color={SAKURA_PINK_LIGHT} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[-0.42, 1.15, 0.25]} castShadow>
            <sphereGeometry args={[0.55, 10, 10]} />
            <meshStandardMaterial color={SAKURA_PINK_MID} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0.42, 1.2, -0.2]} castShadow>
            <sphereGeometry args={[0.58, 10, 10]} />
            <meshStandardMaterial color={SAKURA_PINK_DEEP} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0.1, 1.7, 0.1]} castShadow>
            <sphereGeometry args={[0.45, 10, 10]} />
            <meshStandardMaterial color={SAKURA_PINK_LIGHT} roughness={0.8} flatShading />
          </mesh>
        </group>
      ))}

      {[
        [-1.6, 0.32, -0.8],
        [1.6, 0.32, -0.8],
        [-1.6, 0.32, 0.8],
        [1.6, 0.32, 0.8],
        [-3.6, 0.32, 1.0],
        [3.6, 0.32, 1.0],
      ].map((lPos, lIdx) => (
        <group key={`lamp-${lIdx}`} position={lPos as any}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 1.0, 8]} />
            <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.06, 0.18, 6]} />
            <meshStandardMaterial color="#1f2937" metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.075, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#f59e0b" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export default CityDistricts;
