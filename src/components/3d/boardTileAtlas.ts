import * as THREE from 'three';
import {BOARD_SPACES} from '../../data/boardData';

export const TILE_ATLAS_SIZE=1024;
const CELL_W=128,CELL_H=192;
export function tileAtlasRect(id:number){return [id%8*CELL_W/1024,1-(Math.floor(id/8)+1)*CELL_H/1024,CELL_W/1024,CELL_H/1024];}
export function badgeAtlasRect(index:number){return [index*64/1024,0,64/1024,64/1024];}

/** One original immutable atlas; no network font or per-state texture painting. */
export function createBoardTileAtlas(anisotropy:number){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=TILE_ATLAS_SIZE;
  const c=canvas.getContext('2d')!;
  const ink='#352837',gold='#ad7e32';
  const text=(value:string,y:number,size:number,flip:boolean,color=ink)=>{
    c.save();c.translate(64,y);if(flip)c.rotate(Math.PI);c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=color;c.font=`700 ${size}px Arial, sans-serif`;c.fillText(value,0,0,116);c.restore();
  };
  const lines=(value:string,size:number)=>{
    c.font=`700 ${size}px Arial, sans-serif`;
    while(size>12&&value.split(' ').some(w=>c.measureText(w).width>114)){size--;c.font=`700 ${size}px Arial, sans-serif`;}
    const result:string[]=[];for(const word of value.split(' ')){
      const last=result.at(-1);if(last&&c.measureText(`${last} ${word}`).width<=114)result[result.length-1]+=` ${word}`;else result.push(word);
    }return {result,size};
  };
  const icon=(kind:string,flip:boolean)=>{
    c.save();c.translate(64,114);if(flip)c.rotate(Math.PI);c.strokeStyle=gold;c.fillStyle='#f2dfb9';c.lineWidth=2.5;c.lineJoin='round';
    c.beginPath();c.arc(0,0,24,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle=ink;c.fillStyle=ink;
    if(kind==='railroad'){
      c.fillRect(-17,-8,15,15);c.fillRect(-2,-2,21,9);c.fillRect(9,-13,6,12);
      for(const x of [-10,8]){c.beginPath();c.arc(x,11,5,0,Math.PI*2);c.fill();}c.beginPath();c.moveTo(-22,18);c.lineTo(23,18);c.stroke();
    }else if(kind==='chest'){
      c.strokeRect(-18,-11,36,25);c.beginPath();c.moveTo(-18,-3);c.lineTo(18,-3);c.stroke();c.fillRect(-3,-5,6,10);
    }else if(kind==='electric'){
      c.beginPath();c.moveTo(5,-20);c.lineTo(-13,3);c.lineTo(-1,3);c.lineTo(-5,20);c.lineTo(14,-5);c.lineTo(3,-5);c.closePath();c.fill();
    }else if(kind==='water'){
      c.fillStyle='#407f9c';c.beginPath();c.moveTo(0,-19);c.bezierCurveTo(-30,11,-4,27,10,11);c.bezierCurveTo(20,0,6,-10,0,-19);c.fill();
    }else if(kind==='tax'){
      for(const [x,y] of [[-9,6],[8,-3]] as const){c.beginPath();c.ellipse(x,y,10,5,0,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(x-10,y);c.lineTo(x-10,y+10);c.quadraticCurveTo(x,y+20,x+10,y+10);c.lineTo(x+10,y);c.stroke();}
    }else{c.font='700 40px Georgia, serif';c.textAlign='center';c.textBaseline='middle';c.fillText('?',0,2);}
    c.restore();
  };
  for(const s of BOARD_SPACES){
    c.save();c.translate(s.id%8*CELL_W,Math.floor(s.id/8)*CELL_H);
    const flip=s.id>=20;
    if(s.id%10===0){
      c.save();c.translate(64,96);if(flip)c.rotate(Math.PI);c.strokeStyle=gold;c.lineWidth=1.3;c.strokeRect(-55,-82,110,164);
      c.fillStyle='#f2dfb9';c.beginPath();c.arc(0,-19,34,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle=ink;c.fillStyle=ink;c.lineWidth=3;
      if(s.id===0){c.fillStyle='#b34b43';c.beginPath();c.moveTo(-28,-25);c.lineTo(7,-25);c.lineTo(7,-38);c.lineTo(30,-17);c.lineTo(7,4);c.lineTo(7,-9);c.lineTo(-28,-9);c.closePath();c.fill();}
      if(s.id===10){c.strokeRect(-22,-45,44,49);for(const x of [-12,0,12]){c.beginPath();c.moveTo(x,-45);c.lineTo(x,4);c.stroke();}}
      if(s.id===20){c.strokeRect(-26,-25,52,20);c.strokeRect(-14,-37,29,13);for(const x of [-17,17]){c.beginPath();c.arc(x,-2,6,0,Math.PI*2);c.fill();}}
      if(s.id===30){c.beginPath();c.moveTo(0,-50);c.lineTo(23,-39);c.lineTo(20,-12);c.quadraticCurveTo(0,12,-20,-12);c.lineTo(-23,-39);c.closePath();c.stroke();c.font='700 27px Arial';c.textAlign='center';c.fillText('!',0,-16);}
      c.textAlign='center';c.textBaseline='middle';c.fillStyle=ink;c.font='700 20px Arial';
      const title=s.id===10?['JAIL']:s.id===20?['FREE','PARKING']:s.id===30?['GO TO','JAIL']:['GO'];
      title.forEach((line,i)=>c.fillText(line,0,(s.id===0?52:35)+i*22,103));
      c.font='700 9px Arial';c.fillStyle=gold;if(s.id===0)c.fillText('BASE SALARY $200',0,69);if(s.id===10)c.fillText('JUST VISITING',0,62);
      c.restore();
    }else{
      const {result,size}=lines(s.name,s.type==='property'?18:17),middle=s.type==='property'?70:43;
      result.forEach((line,i)=>text(line,middle+((flip?result.length-1-i:i)-(result.length-1)/2)*(size+3),size,flip));
      if(s.type!=='property')icon(s.type==='utility'?(s.id===12?'electric':'water'):s.type,flip);
      if(s.price!==undefined||s.taxAmount!==undefined){
        text(s.taxAmount!==undefined?`PAY $${s.taxAmount}`:`$${s.price}`,166,20,flip);
      }
      c.strokeStyle='#b68b4844';c.lineWidth=.7;c.beginPath();c.moveTo(25,143);c.lineTo(103,143);c.stroke();
    }
    c.restore();
  }
  for(let i=0;i<7;i++){
    c.save();c.translate(i*64+32,992);c.fillStyle='#392442';c.strokeStyle='#dbb76c';c.lineWidth=3;
    c.beginPath();c.arc(0,0,25,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#fff1c9';c.font='700 23px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(i===6?'M':`P${i+1}`,0,1);c.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.name='Board V5 original labels 1024';texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,anisotropy);texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;return texture;
}
