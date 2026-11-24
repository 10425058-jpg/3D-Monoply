import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {tileOutline,ownerEdgeLayout} from '../src/components/3d/boardVisualState';
import {tileAtlasRect,badgeAtlasRect} from '../src/components/3d/boardTileAtlas';
import {BOARD_SPACES,getSpaceTransform} from '../src/data/boardData';

test('all forty label UVs have non-overlapping inset cells and stay clear of owner badges',()=>{
  const rects=BOARD_SPACES.map(s=>tileAtlasRect(s.id));
  for(const [i,[x,y,w,h]] of rects.entries()){
    assert.ok(x>=0&&y>64/1024&&x+w<=1&&y+h<=1,`tile ${i}`);
    for(const [j,[u,v,a,b]] of rects.entries())if(j!==i)assert.ok(x+w<=u||u+a<=x||y+h<=v||v+b<=y);
  }
  for(let i=0;i<7;i++){const [x,y,w,h]=badgeAtlasRect(i);assert.ok(x>=0&&y>0&&x+w<=1&&y+h<64/1024);}
});

test('ownership rails leave title, color band, mortgage and interaction outline readable on every deed',()=>{
  for(const s of BOARD_SPACES.filter(s=>['property','railroad','utility'].includes(s.type))){
    const tf=getSpaceTransform(s.id),edges=ownerEdgeLayout(tf.width,tf.depth);
    assert.equal(edges.length,2);
    for(const e of edges){assert.ok(Math.abs(e.x)-e.width/2>.75);assert.ok(Math.abs(e.x)+e.width/2<tf.width/2-.0375);assert.ok(e.depth<tf.depth);}
  }
});

test('selected, hovered, auction, purchasable and occupied states have distinct stable priorities',()=>{
  const base={selected:false,hovered:false,auction:false,landed:false,purchasable:false};
  assert.equal(tileOutline(base),null);
  const colors=[tileOutline({...base,selected:true}),tileOutline({...base,hovered:true}),tileOutline({...base,auction:true}),tileOutline({...base,landed:true,purchasable:true}),tileOutline({...base,landed:true})];
  assert.equal(new Set(colors).size,5);
  assert.equal(tileOutline({...base,selected:true,hovered:true,landed:true}),colors[0]);
});

test('all board labels use only the tile world rotation; the atlas must not counter-rotate north/east text',()=>{
  const source=readFileSync(new URL('../src/components/3d/boardTileAtlas.ts',import.meta.url),'utf8');
  const detailSource=readFileSync(new URL('../src/components/3d/BoardTileDetails.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/rotate\(Math\.PI\)/,'tile artwork must not be turned 180 degrees in the canvas atlas');
  assert.doesNotMatch(source,/s\.id\s*>=\s*20/,'north/east tiles must not be flipped by ID');
  assert.doesNotMatch(detailSource,/flip\s*\?\s*Math\.PI/,'instanced labels must not get a second 180-degree turn');
  assert.doesNotMatch(detailSource,/id\s*>=\s*20/,'owner and mortgage badges must follow the same tile rotation');
  // Text is painted upright with the canvas top pointing along local -Z.
  // Each edge has exactly one quarter-turn to face the board's interior.
  const localTop=new THREE.Vector3(0,0,-1),up=new THREE.Vector3(0,1,0);
  for(const s of BOARD_SPACES.filter(s=>s.id%10!==0)){
    const tf=getSpaceTransform(s.id);
    const top=localTop.clone().applyAxisAngle(up,tf.rotationY);
    const inside=new THREE.Vector3(...tf.innerStripDirection);
    assert.ok(top.distanceTo(inside)<1e-9,`space ${s.id} should read toward the center`);
  }
});


test('sidebar uses the same authoritative identity color for the portrait and card',()=>{
  const sidebar=readFileSync(new URL('../src/components/ui/PlayerSidebar.tsx',import.meta.url),'utf8');
  const avatars=readFileSync(new URL('../src/components/ui/Avatars.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/fantasy-hud.css',import.meta.url),'utf8');
  assert.match(sidebar, /<CharacterAvatar character=\{player\.name\} color=\{player\.color\}/);
  assert.match(sidebar, /'--player-color': player\.color/);
  assert.match(avatars, /stroke=\{color\} strokeWidth="4"/);
  assert.equal((avatars.match(/\{portraitBackground\}/g)??[]).length,4);
  assert.doesNotMatch(avatars,/id="bg-(?:you|vic|art|ele)"/);
  assert.match(css,/\.kingdom-player\.is-active \{ border-color: var\(--player-color\)/);
  assert.match(css,/\.player-portrait \{[^\n]*box-shadow: 0 0 0 2px var\(--player-color\)/);
});
