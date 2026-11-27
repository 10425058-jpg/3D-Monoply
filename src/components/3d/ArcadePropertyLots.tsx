import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three-stdlib';
import * as THREE from 'three';
import { BOARD_SPACES } from '../../data/boardData';
import type { ArcadeLevel } from '../../types/game';
import { usePresentationEvents } from '../../presentation/PresentationProvider';
import type { PresentationEvent } from '../../presentation/effectEvents';
import { useSceneState } from '../../presentation/SceneStore';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { isArcadeOwnerTintMaterial, prepareArcadeRoofForOwnerTint } from './arcadeOwnerRoofMaterial';
import { useInvalidateBoardShadow } from './BoardShadowLight';
import { smoothStep } from '../../presentation/animationMath';
import {
  ARCADE_PROPERTY_STAGES, ARCADE_CONSTRUCTION_MS, CONSTRUCTION_MS,
  arcadeConstructionPose, arcadePlotPlacement, arcadePropertyAsset,
} from './arcadePropertyLayout';

type Site = ReturnType<typeof arcadePlotPlacement> & {
  spaceId: number;
  ownerId: number;
  color: string;
  mortgaged: boolean;
};
type Stage = typeof ARCADE_PROPERTY_STAGES[number];
type Construction = { event: PresentationEvent; duration: number };
type ModelPart = { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4; roof: boolean };
type StageModel = { parts: ModelPart[] | null; request: Promise<ModelPart[] | null> };
const STREET_IDS = BOARD_SPACES.filter(space => space.type === 'property').map(space => space.id);
const NO_RAYCAST = () => {};
const settledPose = arcadeConstructionPose(CONSTRUCTION_MS, CONSTRUCTION_MS);

/** The Blender generator exports the same palette and embedded atlas for every stage.
 * Reuse the first loaded materials, so only one atlas goes to the GPU.
 */
const palette = new Map<string, THREE.Material>();
let paletteAtlas: THREE.Texture | undefined;
function sharedMaterial(source: THREE.Material) {
  const cached = palette.get(source.name);
  if (cached) return cached;
  const material = prepareArcadeRoofForOwnerTint(source);
  if (material instanceof THREE.MeshStandardMaterial && material.map) {
    paletteAtlas ??= material.map;
    material.map = paletteAtlas;
  }
  palette.set(source.name, material);
  return material;
}

const models = new Map<Stage, StageModel>();
function loadStage(stage: Stage) {
  const cached = models.get(stage);
  if (cached) return cached;
  const url = new URL(arcadePropertyAsset(stage, 'glb'), document.baseURI).href;
  // An unavailable decorative asset should leave the active game rendering.
  const entry: StageModel = {
    parts: null,
    request: new GLTFLoader().loadAsync(url).then(({ scene }) => {
      const parts: ModelPart[] = [];
      scene.updateMatrixWorld(true);
      scene.traverse(node => {
        if (node instanceof THREE.Mesh && !Array.isArray(node.material)) {
          parts.push({ geometry: node.geometry, material: sharedMaterial(node.material), matrix: node.matrixWorld.clone(),
            roof: isArcadeOwnerTintMaterial(node.material.name) });
        }
      });
      if (!parts.length) throw new Error(`Missing Arcade geometry for ${stage}`);
      entry.parts = parts;
      return parts;
    }).catch(() => {
      models.delete(stage);
      return null;
    }),
  };
  models.set(stage, entry);
  return entry;
}

function LotFallback({ sites, level }: { sites: readonly Site[]; level: ArcadeLevel }) {
  return <group name="arcade-lot-loading">
    {sites.map(site => <group key={site.spaceId} name={`arcade-fallback-${site.spaceId}`}
      userData={{ level, ownerId: site.ownerId, color: site.color }}
      position={site.position} rotation={[0, site.rotationY, 0]}>
      <mesh position={[0, .037, 0]} raycast={NO_RAYCAST}>
        <boxGeometry args={[1.36, .074, .60]} /><meshStandardMaterial color="#ded1b6" />
      </mesh>
      <mesh position={[-.55, .117, 0]} raycast={NO_RAYCAST}>
        <boxGeometry args={[.11, .10, .20]} /><meshStandardMaterial color={site.color} />
      </mesh>
      {level === 0 ? <mesh position={[.08, .10, 0]} raycast={NO_RAYCAST}>
        <boxGeometry args={[.75, .07, .39]} /><meshStandardMaterial color="#88a45f" />
      </mesh> : <>
        <mesh position={[0, .125 + level * .111, 0]} raycast={NO_RAYCAST}>
          <boxGeometry args={[.63 + level * .12, .16 + level * .24, .405]} />
          <meshStandardMaterial color="#eedbb9" />
        </mesh>
        <mesh position={[0, .31 + level * .22, 0]} scale={[1, 1, .50]} raycast={NO_RAYCAST}>
          <cylinderGeometry args={[level === 2 ? .32 : .02, .57, .22 + level * .023, 4]} />
          <meshStandardMaterial color={site.color} />
        </mesh>
        {level === 3 && [-.46, .46].map(x => <mesh key={x} position={[x, 1.04, 0]} raycast={NO_RAYCAST}>
          <coneGeometry args={[.16, .42, 8]} /><meshStandardMaterial color={site.color} />
        </mesh>)}
      </>}
    </group>)}
  </group>;
}

type PropertyStageProps = {
  stage: Stage; level: ArcadeLevel; sites: readonly Site[]; quality: string; active: ReadonlyMap<number, Construction>;
};

function PropertyStage(props: PropertyStageProps) {
  const [parts, setParts] = useState(() => models.get(props.stage)?.parts ?? null);
  useEffect(() => {
    let mounted = true;
    void loadStage(props.stage).request.then(result => {
      if (mounted) setParts(result);
    });
    return () => { mounted = false; };
  }, [props.stage]);
  return parts ? <PropertyBatch {...props} parts={parts} /> : <LotFallback sites={props.sites} level={props.level} />;
}

function PropertyBatch({ stage, level, sites, quality, active, parts }: PropertyStageProps & { parts: ModelPart[] }) {
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const animated = useRef(new Set<number>());
  const pose = useMemo(() => ({ actor: new THREE.Object3D(), matrix: new THREE.Matrix4(), color: new THREE.Color() }), []);
  const invalidateShadow = useInvalidateBoardShadow();
  const shadows = quality === 'high';
  const place = (site: Site, slot: number, shape: ReturnType<typeof arcadeConstructionPose>) => {
    pose.actor.position.fromArray(site.position);
    pose.actor.rotation.y = site.rotationY;
    pose.actor.scale.set(shape.width, shape.height, shape.width);
    pose.actor.updateMatrix();
    const roofDelay = level === 2 ? .13 * Math.sin(shape.t * Math.PI) * (1 - shape.t) : 0;
    parts.forEach((part, index) => {
      pose.matrix.multiplyMatrices(pose.actor.matrix, part.matrix);
      if (part.roof) pose.matrix.elements[13] -= roofDelay;
      meshes.current[index]?.setMatrixAt(slot, pose.matrix);
    });
  };
  useLayoutEffect(() => {
    animated.current.clear();
    sites.forEach((site, slot) => {
      place(site, slot, settledPose);
      parts.forEach(({ material }, index) => {
        if (isArcadeOwnerTintMaterial(material.name)) {
          pose.color.set(site.color);
          if (site.mortgaged) pose.color.lerp(new THREE.Color('#80738d'), .52);
        } else {
          pose.color.set(site.mortgaged ? '#cec8d4' : '#ffffff');
        }
        meshes.current[index]?.setColorAt(slot, pose.color);
      });
    });
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    if (shadows) invalidateShadow();
  }, [parts, sites, invalidateShadow, shadows]);
  useLayoutEffect(() => {
    if (shadows) return invalidateShadow;
  }, [invalidateShadow, shadows]);
  useEffect(() => {
    const owned = meshes.current.filter((mesh): mesh is THREE.InstancedMesh => !!mesh);
    return () => owned.forEach(releaseInstanceBuffers);
  }, [parts, sites.length]);
  useFrame(() => {
    if (!active.size && !animated.current.size) return;
    const now = performance.now();
    let changed = false;
    sites.forEach((site, slot) => {
      const construction = active.get(site.spaceId);
      const elapsed = construction ? now - construction.event.createdAt : Infinity;
      const shape = construction && elapsed < construction.duration ? arcadeConstructionPose(elapsed, construction.duration, level) : settledPose;
      if (shape.t < 1) {
        animated.current.add(site.spaceId);
      } else if (!animated.current.delete(site.spaceId)) {
        return;
      }
      place(site, slot, shape);
      changed = true;
    });
    if (changed) {
      for (const mesh of meshes.current) if (mesh) mesh.instanceMatrix.needsUpdate = true;
      if (shadows) invalidateShadow();
    }
  });
  return <group name={`arcade-stage-${stage}`} userData={{ level, sites }}>
    {parts.map(({ geometry, material }, index) => <instancedMesh key={index} ref={mesh => { meshes.current[index] = mesh; }}
      name={material.name} args={[geometry, material, sites.length]} matrixAutoUpdate={false} dispose={null} raycast={NO_RAYCAST}
      castShadow={shadows && (material.name === 'Arcade Painted limestone' || material.name === 'Arcade Glazed slate')}
      receiveShadow={quality !== 'low'} />)}
  </group>;
}

function ConstructionBurst({ site, construction, quality }: { site: Site; construction: Construction; quality: string }) {
  const { event, duration } = construction;
  const level = event.developmentLevel!;
  const hotel = level === 3;
  const count = quality === 'low' || level === 0 ? 0 : (quality === 'high' ? 6 : 4) + level * 2;
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const crown = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = sparks.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return () => releaseInstanceBuffers(mesh);
  }, [count]);
  useFrame(() => {
    const progress = (performance.now() - event.createdAt) / duration;
    if (!group.current || !ring.current) return;
    group.current.visible = progress < 1;
    if (progress >= 1) return;
    const strength = level === 1 ? 1 - smoothStep(progress) : Math.sin(progress * Math.PI);
    ring.current.scale.set(.68 + progress * .22, .28 + progress * .16, 1);
    ring.current.material.opacity = strength * (level === 0 ? .46 : .84);
    if (crown.current) {
      const reveal = smoothStep((progress - .38) / .62);
      crown.current.position.y = .37 + reveal * 1.32;
      crown.current.scale.set(.43 + reveal * .34, .27 + reveal * .22, 1);
      crown.current.material.opacity = Math.sin(reveal * Math.PI) * .74;
    }
    if (sparks.current) {
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count + progress * (level > 1 ? 1.2 : .45);
        const loft = level === 1 ? .31 * Math.sin(Math.PI * progress) : (level === 2 ? .62 : 1.3) * smoothStep(progress);
        dummy.position.set(Math.cos(angle) * (.27 + progress * .58), .09 + loft * (.65 + (i % 4) * .14),
          Math.sin(angle) * (.15 + progress * .29));
        dummy.rotation.set(progress * 2, angle, i);
        dummy.scale.setScalar(strength * (i % 3 === 0 ? .076 : .043));
        dummy.updateMatrix();
        sparks.current.setMatrixAt(i, dummy.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
    }
  });
  return <group ref={group} position={site.position} rotation={[0, site.rotationY, 0]}
    name={`arcade-construction-${site.spaceId}`} userData={{ spaceId: site.spaceId, level: event.developmentLevel }}>
    <mesh ref={ring} position={[0, .118, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
      <ringGeometry args={[.92, 1, 32]} />
      <meshBasicMaterial color={hotel ? '#fff2aa' : '#ffcb61'} transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} forceSinglePass />
    </mesh>
    {hotel && <mesh ref={crown} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
      <ringGeometry args={[.90, 1, 32]} />
      <meshBasicMaterial color="#ffe47f" transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} forceSinglePass />
    </mesh>}
    {count > 0 && <instancedMesh ref={sparks} args={[undefined, undefined, count]} frustumCulled={false} raycast={NO_RAYCAST}>
      <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color={level === 1 ? '#dfb994' : '#ffe5a4'} toneMapped={false} />
    </instancedMesh>}
  </group>;
}

export function ArcadePropertyLots({ quality, reduced, visible }: { quality: string; reduced: boolean; visible: boolean }) {
  const events = usePresentationEvents();
  const properties = useSceneState(s => s.properties);
  const colors = useSceneState(s => s.players.map(player => `${player.id}:${player.color}`).join('|'));
  const hovered = useSceneState(s => s.hoveredSpaceId);
  const selected = useSceneState(s => s.selectedSpaceId);
  const speed = useSceneState(s => s.gameSpeed);
  const mountedAt = useRef(performance.now());
  const byLevel = useMemo(() => {
    const levels: [Site[], Site[], Site[], Site[]] = [[], [], [], []];
    const ownerColors = new Map(colors.split('|').map(entry => entry.split(':') as [string, string]));
    for (const spaceId of STREET_IDS) {
      const property = properties[spaceId];
      if (!property || property.ownerId === null || property.developmentLevel === undefined) continue;
      levels[property.developmentLevel]?.push({
        ...arcadePlotPlacement(spaceId, hovered, selected),
        color: ownerColors.get(String(property.ownerId)) ?? '#e9c36d',
        ownerId: property.ownerId,
        mortgaged: property.isMortgaged,
        spaceId,
      });
    }
    return levels;
  }, [colors, hovered, properties, selected]);
  const active = useMemo(() => {
    const result = new Map<number, Construction>();
    if (reduced || !visible) return result;
    const now = performance.now();
    for (const event of events) {
      if (event.kind !== 'construction' || event.createdAt < mountedAt.current || event.spaceId === undefined || event.developmentLevel === undefined) continue;
      const property = properties[event.spaceId];
      if (!property || property.ownerId !== event.playerId || property.developmentLevel !== event.developmentLevel) continue;
      const duration = ARCADE_CONSTRUCTION_MS[event.developmentLevel] / speed;
      if (now - event.createdAt >= duration) continue;
      result.set(event.spaceId, { event, duration });
    }
    return result;
  }, [events, properties, reduced, speed, visible]);
  return <group name="arcade-property-buildings">
    {ARCADE_PROPERTY_STAGES.map((stage, index) => {
      const level = index as ArcadeLevel;
      const sites = byLevel[level];
      return sites.length > 0
        ? <PropertyStage key={stage} stage={stage} level={level} sites={sites} quality={quality} active={active} />
        : null;
    })}
    {byLevel.flatMap(sites => sites.flatMap(site => {
      const construction = active.get(site.spaceId);
      return construction ? <ConstructionBurst key={construction.event.id} site={site} construction={construction} quality={quality} /> : [];
    }))}
  </group>;
}
