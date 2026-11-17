import {test} from 'node:test';
import assert from 'node:assert/strict';
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
