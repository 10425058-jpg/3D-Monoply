import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getSpaceTransform } from '../../data/boardData';
import { useSceneStore } from '../../presentation/SceneStore';

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
    let collecting = false;
    gl.render = function (...args: Parameters<typeof gl.render>) {
      const query = contextAvailable && timer && pending.length < 8 ? context.createQuery() : null;
      if (query) context.beginQuery(timer.TIME_ELAPSED_EXT, query);
      const start = performance.now();
      try { originalRender.apply(gl, args); }
      finally {
        renderMs += performance.now() - start; passes++;
        if (query) { context.endQuery(timer.TIME_ELAPSED_EXT); pending.push(query); }
      }
    };
    const audit = {
      quality,
      environmentLayer(name: string, visible: boolean) {
        const object = scene.getObjectByName(name);
        if (!object || !['kingdom-valley', 'mountain-ranges', 'kingdom-cloud-layers',
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
      game() {
        const game = store.getState();
        return { turnPhase: game.turnPhase, currentPlayerIndex: game.currentPlayerIndex,
          selectedSpaceId: game.selectedSpaceId, hoveredSpaceId: game.hoveredSpaceId,
          cameraMode: game.cameraMode, dice: game.dice,
          players: game.players.map(({ id, position, money, landmarkLevel }) => ({ id, position, money, landmarkLevel })),
          properties: game.properties };
      },
      start() { samples.length = 0; collecting = true; previous = 0; },
      stop() { collecting = false; return { samples: [...samples], metadata: audit.metadata() }; },
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
      camera(position: number[], target: number[]) {
        const perspective = camera as THREE.PerspectiveCamera;
        perspective.clearViewOffset(); perspective.fov = 40; perspective.updateProjectionMatrix();
        const controls = state.get().controls as { target: THREE.Vector3; update(): void } | null;
        camera.position.fromArray(position); controls?.target.fromArray(target);
        camera.lookAt(new THREE.Vector3().fromArray(target)); controls?.update(); camera.updateMatrixWorld();
      },
      tiles() {
        camera.updateMatrixWorld();
        const city = scene.getObjectByName('center-city');
        const environment = scene.getObjectByName('premium-fantasy-world');
        const ray = new THREE.Raycaster();
        return Array.from({ length: 40 }, (_, id) => {
          const [x, , z] = getSpaceTransform(id).position;
          const world = new THREE.Vector3(x, 0.4, z);
          const p = world.clone().project(camera);
          ray.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
          const hit = city ? ray.intersectObject(city, true)[0] : null;
          const environmentHits: THREE.Intersection[] = [];
          environment?.traverseVisible(object => {
            // Production intentionally disables background raycasts for input.
            // Audit the actual opaque geometry rather than trusting that no-op.
            if (object instanceof THREE.InstancedMesh) THREE.InstancedMesh.prototype.raycast.call(object, ray, environmentHits);
            else if (object instanceof THREE.Mesh) THREE.Mesh.prototype.raycast.call(object, ray, environmentHits);
          });
          const tileMeshes = ['corner-tile-top', 'edge-tile-top'].map(name => scene.getObjectByName(name)).filter(Boolean) as THREE.Object3D[];
          const tileHit = ray.intersectObjects(tileMeshes)[0];
          const tileIds = tileHit?.object.name === 'corner-tile-top' ? [0, 10, 20, 30] : Array.from({ length: 40 }, (_, n) => n).filter(n => n % 10);
          const rect = gl.domElement.getBoundingClientRect();
          return { id, x: rect.left + (p.x + 1) * state.size.width / 2, y: rect.top + (1 - p.y) * state.size.height / 2, depth: p.z,
            pickableTileId: tileHit?.instanceId === undefined ? null : tileIds[tileHit.instanceId],
            occludedByEnvironment: environmentHits.some(h => h.distance < camera.position.distanceTo(world) - .15),
            occludedByCity: !!hit && hit.distance < camera.position.distanceTo(world) - .15 };
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
          meshes, materialTextures: [...textures].map(t => ({ name: t.name, width: t.image?.width, height: t.image?.height })),
          // Allocation estimates from actual scene buffers/images. WebGL does
          // not expose driver VRAM; these deliberately aren't labelled VRAM.
          allocationEstimates: {
            geometryAttributeBytes: [...buffers].reduce((sum, buffer) => sum + buffer.array.byteLength, 0),
            instanceAttributeBytes,
            textureRgbaBytes: [...textures].reduce((sum, texture) => sum +
              (texture.image?.width ?? 0) * (texture.image?.height ?? 0) * 4 * (texture.generateMipmaps ? 4 / 3 : 1), 0),
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
      gl.domElement.removeEventListener('webglcontextlost', lost);
      gl.domElement.removeEventListener('webglcontextrestored', restored);
      gl.render = originalRender; gl.info.autoReset = originalAutoReset;
      pending.forEach(query => context.deleteQuery(query)); delete (window as any).__graphicsAudit;
    };
  }, [state, quality, store]);
  useFrame(() => (window as any).__graphicsAudit?.frame(), -100);
  return null;
}
