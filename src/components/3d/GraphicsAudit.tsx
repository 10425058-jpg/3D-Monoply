import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getSpaceTransform } from '../../data/boardData';
import { royalTokenAsset } from '../../data/royalTokenAssets';
import { useSceneStore } from '../../presentation/SceneStore';
import { OWNER_PENNANT_MATERIAL } from './arcadePropertyLayout';
import { MAX_ORBIT_POLAR_ANGLE, MIN_ORBIT_DISTANCE, type BoardOrbitControls } from './BoardOrbitControls';

type ArcadeAuditBuilding = {
  spaceId: number; ownerId: number; level: number; color: string | null;
  position: number[]; scale: number[]; rotationY: number; parts: number;
  source: 'gltf' | 'fallback';
};

function islandScreenBounds(group: THREE.Object3D, camera: THREE.Camera, rect: DOMRect) {
  const bounds = new THREE.Box2();
  const vertex = new THREE.Vector3(), point = new THREE.Vector2();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const add = (world: THREE.Vector3) => {
    world.project(camera);
    bounds.expandByPoint(point.set(rect.left + (world.x + 1) * rect.width / 2, rect.top + (1 - world.y) * rect.height / 2));
  };
  group.traverseVisible(object => {
    if (object instanceof THREE.Mesh && object.parent?.name !== 'player-island-chain') {
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) add(vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
    } else if (object instanceof THREE.Sprite) {
      const center = object.getWorldPosition(new THREE.Vector3());
      const half = object.getWorldScale(new THREE.Vector3()).multiplyScalar(.5);
      for (const x of [-half.x, half.x]) for (const y of [-half.y, half.y]) {
        add(vertex.copy(center).addScaledVector(right, x).addScaledVector(up, y));
      }
    }
  });
  return { left: bounds.min.x, top: bounds.min.y, right: bounds.max.x, bottom: bounds.max.y };
}

/** Studio lighting for the actual runtime minted geometry, used by the capture script. */
function mintPreview(treasury: THREE.Object3D) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#e9d9be');
  studio.add(new THREE.HemisphereLight('#fff9ec', '#937577', 1.8));
  const key = new THREE.DirectionalLight('#fff3df', 2.6); key.position.set(-4, 7, 11); studio.add(key);
  const fill = new THREE.DirectionalLight('#dce9ff', 1.25); fill.position.set(6, 3, 5); studio.add(fill);
  for (const [row, values] of [[1, 5, 10], [20, 50, 100], [500, 1000]].entries()) {
    values.forEach((value, column) => {
      const source = treasury.getObjectByName(`island-minted-coin-${value}`);
      if (!(source instanceof THREE.InstancedMesh)) return;
      for (const side of [1, -1]) {
        const coin = new THREE.Mesh(source.geometry, source.material);
        const x = (column - (values.length - 1) / 2) * 3.94 - side * .965;
        coin.position.set(x, 2.28 * (1 - row) + .065 * side, side * .12);
        coin.rotation.set(side * Math.PI / 2 - .07, side * .28, 0, 'YXZ');
        coin.scale.setScalar(.94);
        studio.add(coin);
      }
    });
  }
  const camera = new THREE.OrthographicCamera(-6.20, 6.20, 3.55, -3.55, .1, 50);
  camera.position.set(0, 0, 14);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1610, 922, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  try {
    renderer.render(studio, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally { renderer.dispose(); renderer.forceContextLoss(); }
}

/** Explicit opt-in diagnostics. No instrumentation or globals in ordinary play. */
export const graphicsAuditEnabled = () => new URLSearchParams(window.location.search).has('graphicsAudit');

export function GraphicsAudit({ quality }: { quality: string }) {
  const store = useSceneStore();
  const state = useThree();
  useEffect(() => {
    const { gl, camera, scene } = state;
    const context = gl.getContext() as WebGL2RenderingContext;
    let timer = context.getExtension('EXT_disjoint_timer_query_webgl2');
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    const originalRender = gl.render;
    const originalAutoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    let renderMs = 0, passes = 0, previous = 0;
    let pending: WebGLQuery[] = [], latestGpu: number | null = null;
    let contextAvailable = true;
    const lost = () => { contextAvailable = false; pending = []; latestGpu = null; };
    const restored = () => {
      timer = context.getExtension('EXT_disjoint_timer_query_webgl2');
      context.getExtension('WEBGL_debug_renderer_info');
      contextAvailable = true;
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    const samples: Record<string, number | null>[] = [];
    const renderListeners = new Set<(frame: { at: number; renderMs: number }) => void>();
    let collecting = false;
    gl.render = function (...args: Parameters<typeof gl.render>) {
      const query = contextAvailable && timer && pending.length < 8 ? context.createQuery() : null;
      if (query) context.beginQuery(timer.TIME_ELAPSED_EXT, query);
      const start = performance.now();
      const boardFrame = renderListeners.size > 0 && contextAvailable && args[0] === scene &&
        args[1] === camera && gl.getRenderTarget() === null;
      try { originalRender.apply(gl, args); }
      finally {
        renderMs += performance.now() - start; passes++;
        if (query) { context.endQuery(timer.TIME_ELAPSED_EXT); pending.push(query); }
      }
      // A useFrame callback alone does not prove Three submitted the scene.
      if (boardFrame) {
        const at = performance.now();
        renderListeners.forEach(listener => listener({ at, renderMs: at - start }));
      }
    };
    const audit = {
      quality,
      environmentLayer(name: string, visible: boolean) {
        const object = scene.getObjectByName(name);
        if (!object || !['kingdom-valley', 'mountain-ranges', 'distant-islets', 'low-cloud-deck', 'kingdom-cloud-layers',
          'ancient-stone-bridges', 'distant-fantasy-kingdom', 'kingdom-waterways'].includes(name)) return false;
        object.visible = visible;
        return true;
      },
      hovered: [] as number[],
      environment() {
        const world = scene.getObjectByName('premium-fantasy-world');
        const waterfalls: Record<string, number> = {};
        let triangles = 0, meshes = 0, shadowCasters = 0, fallbacks = 0;
        world?.traverse(object => {
          if (object.name === 'environment-landmark-fallback') fallbacks++;
          if (!(object instanceof THREE.Mesh)) return;
          meshes++; if (object.castShadow) shadowCasters++;
          triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 *
            (object instanceof THREE.InstancedMesh ? object.count : 1);
          if (object.material instanceof THREE.ShaderMaterial && object.material.uniforms.uTime) {
            waterfalls[object.parent?.name ?? object.uuid] = object.material.uniforms.uTime.value;
          }
        });
        const airship = scene.getObjectByName('fantasy-airship');
        return { meshes, triangles, shadowCasters, waterfalls, fallbacks,
          landmarks: ['skyway-observatory', 'skyway-ruins', 'skyway-hamlet'].filter(name => !!world?.getObjectByName(name)),
          oldValleyPresent: !!scene.getObjectByName('kingdom-valley'),
          oldKingdomPresent: !!scene.getObjectByName('distant-fantasy-kingdom'),
          airship: airship ? { position: airship.position.toArray(), rotation: airship.rotation.toArray() } : null };
      },
      dice() {
        const faces:[number,number[]][]=[[1,[0,1,0]],[6,[0,-1,0]],[2,[0,0,1]],[5,[0,0,-1]],[3,[1,0,0]],[4,[-1,0,0]]];
        return [0,1].map(index=>{
          const die=scene.getObjectByName(`die-${index}`),q=die?.getWorldQuaternion(new THREE.Quaternion());
          const top=q?faces.map(([face,normal])=>({face,y:new THREE.Vector3().fromArray(normal).applyQuaternion(q).y})).sort((a,b)=>b.y-a.y)[0]:null;
          return {index,visible:die?.visible,scale:die?.scale.toArray(),face:top?.face,up:top?.y,position:die?.getWorldPosition(new THREE.Vector3()).toArray(),
            highlighted: scene.getObjectByName(`die-face-highlight-${index}`)?.visible === true};
        });
      },
      actors() {
        return {tokens:store.getState().players.map(p=>({id:p.id,tile:p.position,position:scene.getObjectByName(`token-${p.id}`)?.getWorldPosition(new THREE.Vector3()).toArray()})),
          buildings:Object.values(store.getState().properties).filter(p=>p.houses>0).map(p=>{
            const group=scene.getObjectByName(`buildings-${p.spaceId}`);return {spaceId:p.spaceId,level:p.houses,models:group?.children.length,
              position:group?.getWorldPosition(new THREE.Vector3()).toArray()};
          })};
      },
      royalTokens() {
        return store.getState().players.map(player => {
          const actor = scene.getObjectByName(`token-${player.id}`);
          const asset = royalTokenAsset(player.token);
          const model = asset && actor?.getObjectByName(asset.file);
          const ring = actor?.getObjectByName('player-identity-ring');
          actor?.updateWorldMatrix(true, false);
          const bounds = model && new THREE.Box3().setFromObject(model, true);
          let triangles = 0, drawMeshes = 0, shadowCasters = 0;
          const maps = new Set<THREE.Texture>();
          model?.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            drawMeshes++;
            if (object.castShadow) shadowCasters++;
            triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
            const material = object.material as THREE.MeshStandardMaterial;
            if (material.map) maps.add(material.map);
          });
          return {
            id: player.id, token: player.token, ai: player.isAI, tile: player.position,
            asset: model?.name, position: actor?.position.toArray(), heading: actor?.rotation.y,
            visible: actor?.visible === true,
            rippling: scene.getObjectByName(`token-ripple-${player.id}`)?.visible === true,
            trailing: scene.getObjectByName(`token-trail-${player.id}`)?.visible === true,
            bounds: bounds && { min: bounds.min.toArray(), max: bounds.max.toArray() },
            identityColor: ring instanceof THREE.Mesh ? `#${ring.material.color.getHexString()}` : null,
            triangles, drawMeshes, shadowCasters, textures: maps.size,
          };
        });
      },
      arcade() {
        const root = scene.getObjectByName('arcade-property-buildings');
        const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), color = new THREE.Color();
        let drawMeshes = 0, triangles = 0, shadowCasters = 0;
        const atlasIds = new Set<string>();
        const construction: { spaceId: number; level: number }[] = [];
        const buildings = root?.children.flatMap<ArcadeAuditBuilding>(group => {
          if (!group.visible) return [];
          if (group.name.startsWith('arcade-construction-')) {
            construction.push({ spaceId: group.userData.spaceId, level: group.userData.level });
            return [];
          }
          if (group.name === 'arcade-lot-loading') return group.children.map(plot => ({
            spaceId: Number(plot.name.slice('arcade-fallback-'.length)), level: Number(plot.userData.level),
            ownerId: Number(plot.userData.ownerId), color: String(plot.userData.color),
            position: plot.getWorldPosition(new THREE.Vector3()).toArray(), rotationY: plot.rotation.y,
            scale: plot.scale.toArray(), parts: plot.children.length, source: 'fallback' as const,
          }));
          const parts = group.children.filter((part): part is THREE.InstancedMesh =>
            part instanceof THREE.InstancedMesh && part.visible && part.count > 0);
          if (!parts.length) return [];
          drawMeshes += parts.length;
          let pennant: THREE.InstancedMesh | undefined;
          for (const part of parts) {
            const material = part.material as THREE.MeshStandardMaterial;
            if (material.name === OWNER_PENNANT_MATERIAL) pennant = part;
            else if (material.map) atlasIds.add(material.map.uuid);
            if (part.castShadow) shadowCasters++;
            triangles += (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) / 3 * part.count;
          }
          return (group.userData.sites as { spaceId: number; ownerId: number }[]).slice(0, parts[0].count).map(({ spaceId, ownerId }, slot) => {
            parts[0].getMatrixAt(slot, matrix);
            pennant?.getColorAt(slot, color);
            return { spaceId, ownerId, level: Number(group.userData.level), color: pennant ? `#${color.getHexString()}` : null,
              position: matrix.elements.slice(12, 15), scale: scale.setFromMatrixScale(matrix).toArray(),
              rotationY: Math.atan2(matrix.elements[8], matrix.elements[10]), parts: parts.length, source: 'gltf' as const };
          });
        }) ?? [];
        return { buildings, construction, drawMeshes, triangles, shadowCasters, atlasTextures: atlasIds.size };
      },
      board() {
        const root=scene.getObjectByName('board-tile-details-v5'),meshes:Record<string,number>={},textures=new Map<string,THREE.Texture>();
        root?.traverse(object=>{
          if(!(object instanceof THREE.InstancedMesh))return;meshes[object.name]=object.count;
          const map=(object.material as THREE.MeshBasicMaterial).map;if(map)textures.set(map.uuid,map);
        });
        return {meshes,textures:[...textures.values()].map(t=>({uuid:t.uuid,width:t.image.width,height:t.image.height,anisotropy:t.anisotropy,mipmaps:t.generateMipmaps}))};
      },
      islands(measureLayout = false) {
        const root = scene.getObjectByName('player-islands');
        const treasuries = root?.getObjectByName('island-treasuries')?.userData;
        const rect = gl.domElement.getBoundingClientRect();
        const cameraPoint = new THREE.Vector3();
        camera.updateMatrixWorld();
        if (measureLayout) root?.updateWorldMatrix(true, true);
        const islands = root?.children.filter(group => group.userData.edge).map(group => {
          const { seat, edge, statue, color } = group.userData;
          const model = group.getObjectByName(statue);
          const statueMount = group.getObjectByName('player-island-statue');
          const ground = group.getObjectByName('player-island-landscape');
          const plaque = group.getObjectByName('player-island-balance');
          const chain = group.getObjectByName('player-island-chain');
          const chainBounds = chain && new THREE.Box3().setFromObject(chain);
          group.getWorldPosition(cameraPoint).project(camera);
          const center = [rect.left + (cameraPoint.x + 1) * rect.width / 2, rect.top + (1 - cameraPoint.y) * rect.height / 2];
          let statueTriangles = 0, statueDraws = 0;
          model?.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            statueTriangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
            statueDraws++;
          });
          const layout = measureLayout && ground && statueMount && model && {
            footprint: new THREE.Box3().setFromObject(ground, true).getSize(new THREE.Vector3()).toArray(),
            statueScale: statueMount.scale.x,
            statueHeight: new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3()).y,
            rockDepth: group.position.y - new THREE.Box3().setFromObject(ground, true).min.y,
            screen: islandScreenBounds(group, camera, rect),
          };
          return { seat, edge, statue, color, statueTriangles, statueDraws, center, position: group.position.toArray(),
            plaque: plaque?.userData, displayedBalance: plaque?.children[0]?.userData.displayedBalance,
            coins: treasuries?.denominations, stacks: treasuries?.treasuries.find((entry: { seat: number }) => entry.seat === seat)?.stacks,
            links: chain?.userData.links, layout,
            chainBounds: chainBounds && { min: chainBounds.min.toArray(), max: chainBounds.max.toArray() } };
        }) ?? [];
        const money = root?.getObjectByName('player-island-money');
        const signals = money?.children.filter(node => node.name === 'island-money-signal').map(node => node.userData) ?? [];
        const flights: { value: number; count: number }[] = [];
        money?.getObjectByName('island-coin-flights')?.traverse(node => {
          if (node instanceof THREE.InstancedMesh && node.visible && node.name.startsWith('island-flying-coin-')) {
            flights.push({ value: Number(node.name.slice('island-flying-coin-'.length)), count: node.count });
          }
        });
        return { islands, signals, flights, transactions: money?.userData.transactions ?? [] };
      },
      mintPreview() {
        const treasury = scene.getObjectByName('island-treasuries');
        return treasury && mintPreview(treasury);
      },
      game() {
        const game = store.getState();
        return { turnPhase: game.turnPhase, currentPlayerIndex: game.currentPlayerIndex,
          selectedSpaceId: game.selectedSpaceId, hoveredSpaceId: game.hoveredSpaceId,
          cameraMode: game.cameraMode, dice: game.dice,
          players: game.players.map(({ id, position, money, landmarkLevel }) => ({ id, position, money, landmarkLevel })),
          properties: game.properties };
      },
      start() { samples.length = 0; collecting = true; previous = 0; },
      cues() {
        return scene.getObjectByName('presentation-effects')?.children
          .filter(object => object.visible && object.name.startsWith('effect-'))
          .map(object => object.name) ?? [];
      },
      stop() { collecting = false; return { samples: [...samples], metadata: audit.metadata() }; },
      observeRender(listener: (frame: { at: number; renderMs: number }) => void) {
        renderListeners.add(listener);
        return () => { renderListeners.delete(listener); };
      },
      frame() {
        if (contextAvailable && timer) {
          if (context.getParameter(timer.GPU_DISJOINT_EXT)) {
            pending.forEach(query => context.deleteQuery(query)); pending = []; latestGpu = null;
          } else while (pending.length && context.getQueryParameter(pending[0], context.QUERY_RESULT_AVAILABLE)) {
            const query = pending.shift()!;
            latestGpu = context.getQueryParameter(query, context.QUERY_RESULT) / 1e6;
            context.deleteQuery(query);
          }
        }
        const now = performance.now();
        if (collecting && previous && passes) samples.push({ frameMs: now - previous, renderCpuMs: renderMs,
          gpuMs: latestGpu, calls: gl.info.render.calls, triangles: gl.info.render.triangles, passes,
          textures: gl.info.memory.textures, geometries: gl.info.memory.geometries });
        previous = now; renderMs = 0; passes = 0; gl.info.reset();
      },
      camera(position: number[], target: number[], close = false) {
        const perspective = camera as THREE.PerspectiveCamera;
        perspective.clearViewOffset(); perspective.fov = 40; perspective.updateProjectionMatrix();
        const controls = state.get().controls as unknown as BoardOrbitControls;
        controls.minDistance = close ? .5 : MIN_ORBIT_DISTANCE;
        controls.maxPolarAngle = close ? 1.56 : MAX_ORBIT_POLAR_ANGLE;
        controls.setPose(new THREE.Vector3().fromArray(position), new THREE.Vector3().fromArray(target));
      },
      tiles() {
        camera.updateMatrixWorld();
        const city = scene.getObjectByName('center-city');
        const environment = scene.getObjectByName('premium-fantasy-world');
        const islands = scene.getObjectByName('player-islands');
        const ray = new THREE.Raycaster();
        return Array.from({ length: 40 }, (_, id) => {
          const [x, , z] = getSpaceTransform(id).position;
          const world = new THREE.Vector3(x, 0.4, z);
          const p = world.clone().project(camera);
          ray.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
          const cityHits:THREE.Intersection[]=[];
          city?.traverseVisible(object=>{
            if(object instanceof THREE.InstancedMesh)THREE.InstancedMesh.prototype.raycast.call(object,ray,cityHits);
            else if(object instanceof THREE.Mesh)THREE.Mesh.prototype.raycast.call(object,ray,cityHits);
          });
          const environmentHits: THREE.Intersection[] = [];
          environment?.traverseVisible(object => {
            // Production intentionally disables background raycasts for input.
            // Audit the actual opaque geometry rather than trusting that no-op.
            if (object instanceof THREE.InstancedMesh) THREE.InstancedMesh.prototype.raycast.call(object, ray, environmentHits);
            else if (object instanceof THREE.Mesh) THREE.Mesh.prototype.raycast.call(object, ray, environmentHits);
          });
          const islandHits: THREE.Intersection[] = [];
          islands?.traverseVisible(object => {
            if (object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh)) {
              THREE.Mesh.prototype.raycast.call(object, ray, islandHits);
            }
          });
          const tileMeshes = ['corner-tile-top', 'edge-tile-top'].map(name => scene.getObjectByName(name)).filter(Boolean) as THREE.Object3D[];
          const tileHit = ray.intersectObjects(tileMeshes)[0];
          const tileIds = tileHit?.object.name === 'corner-tile-top' ? [0, 10, 20, 30] : Array.from({ length: 40 }, (_, n) => n).filter(n => n % 10);
          const rect = gl.domElement.getBoundingClientRect();
          return { id, x: rect.left + (p.x + 1) * state.size.width / 2, y: rect.top + (1 - p.y) * state.size.height / 2, depth: p.z,
            pickableTileId: tileHit?.instanceId === undefined ? null : tileIds[tileHit.instanceId],
            occludedByPlayerIslands: islandHits.some(hit => hit.distance < camera.position.distanceTo(world) - .15),
            occludedByEnvironment: environmentHits.some(h => h.distance < camera.position.distanceTo(world) - .15),
            occludedByCity: cityHits.some(hit=>hit.distance < camera.position.distanceTo(world) - .15) };
        });
      },
      metadata() {
        const textures = new Set<THREE.Texture>();
        const buffers = new Set<THREE.BufferAttribute | THREE.InterleavedBuffer>();
        let instanceAttributeBytes = 0;
        let meshes = 0;
        scene.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          meshes++;
          for (const attribute of [...Object.values(object.geometry.attributes), object.geometry.index]) {
            if (attribute) buffers.add(attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data : attribute);
          }
          if (object instanceof THREE.InstancedMesh) {
            instanceAttributeBytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
          }
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => {
            Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
            if (material instanceof THREE.ShaderMaterial) Object.values(material.uniforms).forEach(uniform => {
              if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
            });
          });
        });
        return { quality, three: THREE.REVISION, userAgent: navigator.userAgent,
          renderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER),
          gpuTimerAvailable: !!timer, viewport: [state.size.width, state.size.height], dpr: gl.getPixelRatio(),
          drawingBuffer: gl.getDrawingBufferSize(new THREE.Vector2()).toArray(),
          fogRange: scene.fog instanceof THREE.Fog ? [scene.fog.near,scene.fog.far] : null,
          clipping: [camera.near,camera.far],
          camera: { position: camera.position.toArray(), fov: (camera as THREE.PerspectiveCamera).fov,
            view: (camera as THREE.PerspectiveCamera).view,
            target: (state.get().controls as any)?.target.toArray() },
          meshes, materialTextures: [...textures].map(t => ({ name: t.name, width: t.image?.width, height: t.image?.height,
            ...(t instanceof THREE.Data3DTexture ? { depth: t.image.depth } : {}) })),
          // Allocation estimates from actual scene buffers/images. WebGL does
          // not expose driver VRAM; these deliberately aren't labelled VRAM.
          allocationEstimates: {
            geometryAttributeBytes: [...buffers].reduce((sum, buffer) => sum + buffer.array.byteLength, 0),
            instanceAttributeBytes,
            textureRgbaBytes: [...textures].reduce((sum, texture) => sum + (texture instanceof THREE.Data3DTexture
              ? (texture.image.data?.byteLength ?? 0)
              : (texture.image?.width ?? 0) * (texture.image?.height ?? 0) * 4 * (texture.generateMipmaps ? 4 / 3 : 1)), 0),
          },
          memory: { ...gl.info.memory }, programs: gl.info.programs?.length };
      },
    };
    const unsubscribe = store.subscribe((next, previousState) => {
      if (next.hoveredSpaceId !== null && next.hoveredSpaceId !== previousState.hoveredSpaceId) audit.hovered.push(next.hoveredSpaceId);
      if (audit.hovered.length > 200) audit.hovered.shift();
    });
    (window as any).__graphicsAudit = audit;
    return () => {
      unsubscribe();
      renderListeners.clear();
      gl.domElement.removeEventListener('webglcontextlost', lost);
      gl.domElement.removeEventListener('webglcontextrestored', restored);
      gl.render = originalRender; gl.info.autoReset = originalAutoReset;
      pending.forEach(query => context.deleteQuery(query)); delete (window as any).__graphicsAudit;
    };
  }, [state, quality, store]);
  useFrame(() => (window as any).__graphicsAudit?.frame(), -100);
  return null;
}
