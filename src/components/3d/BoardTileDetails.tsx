import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {BOARD_SPACES,getSpaceTransform} from '../../data/boardData';
import {useSceneState,useSceneStore} from '../../presentation/SceneStore';
import {usePresentationEvents} from '../../presentation/PresentationProvider';
import {useMotionPreferences} from '../../presentation/useMotionPreferences';
import {releaseInstanceBuffers} from '../environment/instanceResources';
import {createBoardTileAtlas,tileAtlasRect,badgeAtlasRect} from './boardTileAtlas';
import {ownerEdgeLayout,tileOutline} from './boardVisualState';

/** Presentation only: original catalog, ownership and gameplay coordinates. */
export function BoardTileDetails({hoveredId}:{hoveredId:number|null}){
  const store=useSceneStore(), properties=useSceneState(s=>s.properties);
  const seatColors=useSceneState(s=>s.players.map(player=>`${player.id}:${player.color}`).join(';'));
  const selected=useSceneState(s=>s.selectedSpaceId),hovered=useSceneState(s=>s.hoveredSpaceId),auctionId=useSceneState(s=>s.auction?.spaceId);
  const landedId=useSceneState(s=>s.turnPhase==='LANDED_ACTION'?s.players[s.currentPlayerIndex]?.position:undefined);
  const landedCash=useSceneState(s=>s.turnPhase==='LANDED_ACTION'?s.players[s.currentPlayerIndex]?.money:undefined);
  const events=usePresentationEvents();
  const {reducedMotion}=useMotionPreferences();
  const ownerBadges=useRef(new Map<number,{index:number;matrix:THREE.Matrix4}>());
  const animated=useRef(new Set<number>());
  const badgePose=useMemo(()=>new THREE.Matrix4(),[]);
  const anisotropy=useThree(s=>s.gl.capabilities.getMaxAnisotropy());
  const labels=useRef<THREE.InstancedMesh>(null),bands=useRef<THREE.InstancedMesh>(null),dividers=useRef<THREE.InstancedMesh>(null);
  const badges=useRef<THREE.InstancedMesh>(null),ribbons=useRef<THREE.InstancedMesh>(null),frames=useRef<THREE.InstancedMesh>(null);
  const ownerEdges=useRef<THREE.InstancedMesh>(null),ownerHalos=useRef<THREE.InstancedMesh>(null);
  const resources=useMemo(()=>{
    const texture=createBoardTileAtlas(anisotropy),box=new THREE.BoxGeometry(1,1,1);
    const plane=(count:number)=>{const g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);g.setAttribute('atlasRect',new THREE.InstancedBufferAttribute(new Float32Array(count*4),4));return g;};
    const labelGeometry=plane(40),badgeGeometry=plane(56);
    const labelMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,toneMapped:false});
    labelMaterial.onBeforeCompile=shader=>{
      shader.vertexShader='attribute vec4 atlasRect;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n vMapUv = vMapUv * atlasRect.zw + atlasRect.xy;');
    };
    labelMaterial.customProgramCacheKey=()=> 'board-v5-atlas-uv';
    const bandMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.6,metalness:.03});
    const goldMaterial=new THREE.MeshStandardMaterial({color:'#d5b06d',roughness:.4,metalness:.56});
    const stateMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.52,metalness:.15});
    // Self-lit owner frame plus a wider additive halo, so ownership reads from the overview camera.
    const glowMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false});
    const haloMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.38,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
    return {texture,box,labelGeometry,badgeGeometry,labelMaterial,bandMaterial,goldMaterial,stateMaterial,glowMaterial,haloMaterial};
  },[anisotropy]);
  useEffect(()=>()=>{resources.texture.dispose();resources.box.dispose();resources.labelGeometry.dispose();resources.badgeGeometry.dispose();
    resources.labelMaterial.dispose();resources.bandMaterial.dispose();resources.goldMaterial.dispose();resources.stateMaterial.dispose();
    resources.glowMaterial.dispose();resources.haloMaterial.dispose();},[resources]);
  useEffect(()=>{const instances=[labels.current,bands.current,dividers.current,badges.current,ribbons.current,frames.current,ownerEdges.current,ownerHalos.current];return()=>instances.forEach(i=>{if(i)releaseInstanceBuffers(i);});},[]);
  useLayoutEffect(()=>{
    const players=store.getState().players;
    ownerBadges.current.clear();
    animated.current.clear();
    const dummy=new THREE.Object3D(),local=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);let bandCount=0,badgeCount=0,ribbonCount=0,frameCount=0,edgeCount=0,haloCount=0;
    const labelRects=resources.labelGeometry.getAttribute('atlasRect') as THREE.InstancedBufferAttribute;
    const badgeRects=resources.badgeGeometry.getAttribute('atlasRect') as THREE.InstancedBufferAttribute;
    for(const space of BOARD_SPACES){
      const tf=getSpaceTransform(space.id),id=space.id,isSelected=selected===id,isHovered=[hoveredId,hovered].includes(id);
      const y=isHovered ? .38 : isSelected ? .34 : .26,property=properties[id],owner=players.find(p=>p.id===property?.ownerId);
      const place=(mesh:THREE.InstancedMesh|null,index:number,x:number,z:number,width:number,height:number,depth:number,offsetY:number)=>{
        local.set(x,offsetY,z).applyAxisAngle(up,tf.rotationY);
        dummy.position.set(tf.position[0]+local.x,y+local.y,tf.position[2]+local.z);dummy.rotation.set(0,tf.rotationY,0);
        dummy.scale.set(width,height,depth);dummy.updateMatrix();mesh?.setMatrixAt(index,dummy.matrix);
      };
      place(labels.current,id,0,tf.isCorner?0:.27,tf.isCorner?2.65:1.65,1,tf.isCorner?2.65:2.05,.075);
      labelRects.setXYZW(id,...tileAtlasRect(id) as [number,number,number,number]);
      if(space.type==='property'){
        place(bands.current,bandCount,0,-tf.depth/2+.34,tf.width-.15,.035,.58,.068);
        bands.current?.setColorAt(bandCount,new THREE.Color(space.colorHex));
        place(dividers.current,bandCount,0,-tf.depth/2+.65,tf.width-.15,.014,.025,.086);bandCount++;
      }
      if(owner){
        // A mortgaged deed keeps its owner colour, faded toward grey.
        const ownerColor=new THREE.Color(owner.color);
        if(property?.isMortgaged)ownerColor.lerp(new THREE.Color('#8a8f99'),.6);
        place(ribbons.current,ribbonCount,0,tf.depth/2-.13,tf.width-.17,.025,.14,.073);
        ribbons.current?.setColorAt(ribbonCount++,ownerColor);
        for(const edge of ownerEdgeLayout(tf.width,tf.depth)){
          place(ownerEdges.current,edgeCount,edge.x,edge.z,edge.width,.014,edge.depth,.08);
          ownerEdges.current?.setColorAt(edgeCount++,ownerColor);
        }
        for(const edge of ownerEdgeLayout(tf.width,tf.depth,.17)){
          place(ownerHalos.current,haloCount,edge.x,edge.z,edge.width,.004,edge.depth,.078);
          ownerHalos.current?.setColorAt(haloCount++,ownerColor);
        }
        place(badges.current,badgeCount,-.57,tf.depth/2-.24,.31,1,.31,.091);
        ownerBadges.current.set(id,{index:badgeCount,matrix:dummy.matrix.clone()});
        badgeRects.setXYZW(badgeCount++,...badgeAtlasRect(players.findIndex(p=>p.id===owner.id)) as [number,number,number,number]);
      }
      if(property?.isMortgaged){
        place(badges.current,badgeCount,.57,tf.depth/2-.24,.31,1,.31,.092);
        badgeRects.setXYZW(badgeCount++,...badgeAtlasRect(6) as [number,number,number,number]);
      }
      const landed=landedId===id;
      const outline=tileOutline({selected:isSelected,hovered:isHovered,auction:auctionId===id,landed,
        purchasable:!!property&&property.ownerId===null&&(space.price??Infinity)<=(landedCash??-1)});
      if(outline){
        const color=new THREE.Color(outline);
        const w=tf.width-.075,d=tf.depth-.075;
        for(const [x,z,sx,sz] of [[0,-d/2,w,.035],[0,d/2,w,.035],[-w/2,0,.035,d],[w/2,0,.035,d]]){
          place(frames.current,frameCount,x,z,sx,.018,sz,.089);frames.current?.setColorAt(frameCount++,color);
        }
      }
    }
    labelRects.needsUpdate=true;badgeRects.needsUpdate=true;
    for(const [mesh,count] of [[labels.current,40],[bands.current,bandCount],[dividers.current,bandCount],[badges.current,badgeCount],[ribbons.current,ribbonCount],[frames.current,frameCount],[ownerEdges.current,edgeCount],[ownerHalos.current,haloCount]] as const){
      if(!mesh)continue;mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
    }
  },[resources,store,properties,seatColors,selected,hoveredId,hovered,auctionId,landedId,landedCash]);
  useFrame(()=>{
    // Gentle breathing glow on owned tiles; steady when reduced motion is on.
    resources.haloMaterial.opacity=reducedMotion?.38:.32+Math.sin(performance.now()/650)*.14;
    const mesh=badges.current;
    if(!mesh)return;
    const now=performance.now();
    const previous=animated.current;
    for(const id of previous){
      const badge=ownerBadges.current.get(id);
      if(badge)mesh.setMatrixAt(badge.index,badge.matrix);
    }
    if(previous.size)mesh.instanceMatrix.needsUpdate=true;
    previous.clear();
    if(reducedMotion)return;
    for(const event of events){
      if(event.kind!=='ownership'||event.spaceId===undefined)continue;
      const progress=(now-event.createdAt)/540;
      const badge=ownerBadges.current.get(event.spaceId);
      if(!badge||progress>=1)continue;
      const bounce=Math.sin(progress*Math.PI)*(1-progress);
      badgePose.copy(badge.matrix);
      const lift=badgePose.elements[13]+bounce*.16;
      const scale=1+bounce*.5;
      badgePose.elements[13]=lift;
      badgePose.elements[0]*=scale;badgePose.elements[2]*=scale;
      badgePose.elements[8]*=scale;badgePose.elements[10]*=scale;
      mesh.setMatrixAt(badge.index,badgePose);
      mesh.instanceMatrix.needsUpdate=true;
      previous.add(event.spaceId);
    }
  });
  return <group name="board-tile-details-v5">
    <instancedMesh ref={labels} args={[resources.labelGeometry,resources.labelMaterial,40]} name="board-full-name-labels" dispose={null} raycast={()=>{}}/>
    <instancedMesh ref={bands} args={[resources.box,resources.bandMaterial,22]} name="board-color-bands" dispose={null} raycast={()=>{}}/>
    <instancedMesh ref={dividers} args={[resources.box,resources.goldMaterial,22]} name="board-gold-dividers" dispose={null} raycast={()=>{}}/>
    <instancedMesh ref={badges} args={[resources.badgeGeometry,resources.labelMaterial,56]} name="board-owner-mortgage-marks" dispose={null} raycast={()=>{}}/>
    <instancedMesh ref={ribbons} args={[resources.box,resources.stateMaterial,28]} name="board-owner-trim" dispose={null} raycast={()=>{}}/>
    <instancedMesh ref={ownerHalos} args={[resources.box,resources.haloMaterial,112]} name="board-owner-glow" dispose={null} raycast={()=>{}}/>
    <instancedMesh ref={ownerEdges} args={[resources.box,resources.glowMaterial,112]} name="board-owner-edges" dispose={null} raycast={()=>{}}/>
    <instancedMesh ref={frames} args={[resources.box,resources.stateMaterial,20]} name="board-interaction-outlines" dispose={null} raycast={()=>{}}/>
  </group>;
}
