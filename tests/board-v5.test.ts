import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BOARD_SPACES,getSpaceTransform} from '../src/data/boardData';
import {CONTENT} from '../backend/src/game/content';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/board-catalog-main-v5.json',import.meta.url),'utf8'));

test('V5 preserves every established board name, price, rent, color and exact space transform',()=>{
  assert.deepEqual(BOARD_SPACES,baseline.spaces);
  assert.deepEqual(BOARD_SPACES.map(s=>getSpaceTransform(s.id)),baseline.transforms);
});
test('shared presentation maps all 40 spaces to the unchanged central-castle@1 server catalog',()=>{
  assert.equal(CONTENT.version,'central-castle@1');
  for(const client of BOARD_SPACES){
    const server=CONTENT.spaces[client.id];
    for(const field of ['id','name','type','price','rent','taxAmount'] as const)assert.deepEqual(client[field],server[field],`${client.id}: ${field}`);
  }
});
